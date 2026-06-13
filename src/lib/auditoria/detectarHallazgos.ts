/**
 * Sprint 3.9 — Auditoría visible de datos legacy.
 *
 * Motor PURO: no llama a Supabase. Recibe los datos ya cargados por hooks
 * y devuelve una lista de hallazgos accionables.
 *
 * Reglas globales:
 *   • Nunca corrige automáticamente nada.
 *   • Nunca inventa deuda. No altera magnitudes.
 *   • Sólo describe el problema y propone acciones que el usuario confirma.
 *   • Reutiliza `getEstadoMesContrato` como única fuente de verdad para
 *     detectar inconsistencias mensuales (caso 8).
 */

import type { Contrato } from "@/hooks/useContratos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { ContratoPersona } from "@/hooks/useContratoPersonas";
import { getEstadoMesContrato, isContratoActivoEnMes } from "@/lib/estadoMesContrato";

export type HallazgoTipo =
  | "pago_sin_contrato_ambiguo"
  | "pago_sin_contrato_resoluble"
  | "pago_con_inquilino_sin_contrato"
  | "pago_sin_inquilino_ni_contrato"
  | "pago_duplicado"
  | "pago_real_e_historico"
  | "contrato_sin_fecha_inicio_control"
  | "contrato_sin_renta"
  | "activo_varios_contratos_completos"
  | "mes_inconsistente";

export type HallazgoAccion =
  | "asignar_contrato"
  | "marcar_historico"
  | "fusionar_duplicados"
  | "eliminar_pago"
  | "abrir_contrato"
  | "definir_fecha_control"
  | "definir_renta";

export interface Hallazgo {
  /** Identificador determinista — permite dedupe estable entre escaneos. */
  id: string;
  tipo: HallazgoTipo;
  severidad: "warning" | "error";
  titulo: string;
  detalle: string;
  propertyId?: string;
  contratoId?: string;
  inquilinoId?: string;
  pagoIds?: string[];
  /** Candidatos cuando hay que elegir contrato (caso 1 ambiguo / caso 7 resoluble). */
  contratosCandidatos?: string[];
  mes?: number;
  anio?: number;
  acciones: HallazgoAccion[];
}

export interface DetectarHallazgosParams {
  contratos: Pick<
    Contrato,
    | "id"
    | "property_id"
    | "renta_mensual"
    | "fecha_inicio"
    | "fecha_fin"
    | "fecha_inicio_control"
    | "estado"
    | "archivado"
    | "modalidad_alquiler"
    | "created_at"
  >[];
  contratoPersonas: Pick<
    ContratoPersona,
    "contrato_id" | "inquilino_id"
  >[];
  pagos: Pick<
    PagoRenta,
    | "id"
    | "property_id"
    | "inquilino_id"
    | "contrato_id"
    | "mes"
    | "anio"
    | "importe_pagado"
    | "tipo_registro"
    | "afecta_finanzas_actuales"
    | "propietario_confirmado"
    | "inquilino_notificado"
  >[];
  today?: Date;
}

const ESTADOS_VIGENTES = new Set(["vigente", "activo", "Vigente", "Activo"]);

function contratoEsActivoHoy(c: DetectarHallazgosParams["contratos"][number], today: Date): boolean {
  if (c.archivado) return false;
  if (c.estado && !ESTADOS_VIGENTES.has(c.estado) && c.estado !== "borrador") return false;
  const ini = c.fecha_inicio ? new Date(c.fecha_inicio) : null;
  const fin = c.fecha_fin ? new Date(c.fecha_fin) : null;
  if (ini && ini > today) return false;
  if (fin && fin < today) return false;
  return true;
}

function contratoCubreMes(
  c: DetectarHallazgosParams["contratos"][number],
  mes: number,
  anio: number,
): boolean {
  return isContratoActivoEnMes(c as any, mes, anio);
}

/**
 * Devuelve los contratos que podrían atribuirse a un pago legacy
 * (sin contrato_id) en función de property_id, inquilino_id y mes/año.
 */
function candidatosParaPagoLegacy(
  pago: DetectarHallazgosParams["pagos"][number],
  contratos: DetectarHallazgosParams["contratos"],
  personasPorContrato: Map<string, Set<string>>,
): string[] {
  const out: string[] = [];
  for (const c of contratos) {
    if (c.property_id !== pago.property_id) continue;
    if (!contratoCubreMes(c, pago.mes, pago.anio)) continue;
    if (pago.inquilino_id) {
      const persons = personasPorContrato.get(c.id);
      if (!persons || !persons.has(pago.inquilino_id)) continue;
    }
    out.push(c.id);
  }
  return out;
}

export interface DetectarHallazgosResult {
  hallazgos: Hallazgo[];
  agrupadosPorTipo: Record<HallazgoTipo, Hallazgo[]>;
  total: number;
}

export function detectarHallazgos(
  params: DetectarHallazgosParams,
): DetectarHallazgosResult {
  const { contratos, contratoPersonas, pagos, today = new Date() } = params;
  const hallazgos: Hallazgo[] = [];

  // Index: contrato → set(inquilinos)
  const personasPorContrato = new Map<string, Set<string>>();
  for (const cp of contratoPersonas) {
    if (!cp.inquilino_id) continue;
    let s = personasPorContrato.get(cp.contrato_id);
    if (!s) {
      s = new Set<string>();
      personasPorContrato.set(cp.contrato_id, s);
    }
    s.add(cp.inquilino_id);
  }
  const contratoById = new Map(contratos.map((c) => [c.id, c] as const));

  // ───── Caso 1 / 7: pagos sin contrato_id ─────
  for (const p of pagos) {
    if (p.contrato_id) continue;
    if (!p.inquilino_id) {
      hallazgos.push({
        id: `pago_sin_inq:${p.id}`,
        tipo: "pago_sin_inquilino_ni_contrato",
        severidad: "warning",
        titulo: "Pago sin contrato ni inquilino",
        detalle: `Pago de ${formatMes(p.mes, p.anio)} sin contrato ni inquilino vinculado. No afecta a finanzas ni fiscalidad hasta asignarlo.`,
        propertyId: p.property_id,
        pagoIds: [p.id],
        mes: p.mes,
        anio: p.anio,
        acciones: ["asignar_contrato", "marcar_historico", "eliminar_pago"],
      });
      continue;
    }
    const cand = candidatosParaPagoLegacy(p, contratos, personasPorContrato);
    if (cand.length === 0) {
      hallazgos.push({
        id: `pago_inq_sin_ctr:${p.id}`,
        tipo: "pago_con_inquilino_sin_contrato",
        severidad: "warning",
        titulo: "Pago de un inquilino sin contrato vigente",
        detalle: `El inquilino tiene un pago de ${formatMes(p.mes, p.anio)} pero no existe contrato vigente que lo cubra. Crea el contrato o marca el pago como histórico.`,
        propertyId: p.property_id,
        inquilinoId: p.inquilino_id,
        pagoIds: [p.id],
        mes: p.mes,
        anio: p.anio,
        acciones: ["marcar_historico", "eliminar_pago"],
      });
    } else if (cand.length === 1) {
      hallazgos.push({
        id: `pago_resoluble:${p.id}`,
        tipo: "pago_sin_contrato_resoluble",
        severidad: "warning",
        titulo: "Pago legacy asignable a un contrato",
        detalle: `Pago de ${formatMes(p.mes, p.anio)} sin contrato asignado. Hay un único contrato vigente compatible; puedes asignarlo manualmente.`,
        propertyId: p.property_id,
        inquilinoId: p.inquilino_id,
        pagoIds: [p.id],
        contratosCandidatos: cand,
        mes: p.mes,
        anio: p.anio,
        acciones: ["asignar_contrato", "marcar_historico"],
      });
    } else {
      hallazgos.push({
        id: `pago_ambiguo:${p.id}`,
        tipo: "pago_sin_contrato_ambiguo",
        severidad: "error",
        titulo: "Pago legacy con varios contratos posibles",
        detalle: `Hay ${cand.length} contratos vigentes compatibles con el pago de ${formatMes(p.mes, p.anio)}. No se atribuye automáticamente: elige tú a cuál pertenece.`,
        propertyId: p.property_id,
        inquilinoId: p.inquilino_id,
        pagoIds: [p.id],
        contratosCandidatos: cand,
        mes: p.mes,
        anio: p.anio,
        acciones: ["asignar_contrato", "marcar_historico", "eliminar_pago"],
      });
    }
  }

  // ───── Caso 2: duplicados por (contrato_id, mes, anio) ─────
  const pagosPorCMA = new Map<string, typeof pagos>();
  for (const p of pagos) {
    if (!p.contrato_id) continue;
    const k = `${p.contrato_id}|${p.mes}|${p.anio}`;
    const arr = pagosPorCMA.get(k) ?? ([] as typeof pagos);
    (arr as any).push(p);
    pagosPorCMA.set(k, arr);
  }
  for (const [k, lista] of pagosPorCMA.entries()) {
    if (lista.length <= 1) continue;
    const [contratoId, mesStr, anioStr] = k.split("|");
    const mes = Number(mesStr);
    const anio = Number(anioStr);
    const c = contratoById.get(contratoId);
    hallazgos.push({
      id: `dup:${k}`,
      tipo: "pago_duplicado",
      severidad: "error",
      titulo: `${lista.length} pagos para el mismo mes`,
      detalle: `Se han registrado ${lista.length} pagos para ${formatMes(mes, anio)} del mismo contrato. Sólo se cuenta uno: fusiona o elimina los duplicados.`,
      propertyId: c?.property_id,
      contratoId,
      pagoIds: lista.map((p) => p.id),
      mes,
      anio,
      acciones: ["fusionar_duplicados", "eliminar_pago"],
    });
  }

  // ───── Caso 3: pago_real y histórico conviviendo (mismo contrato/mes) ─────
  for (const [k, lista] of pagosPorCMA.entries()) {
    const hasReal = lista.some(
      (p) => p.propietario_confirmado && (p.tipo_registro === "pago_real" || (p.tipo_registro == null && p.afecta_finanzas_actuales !== false)),
    );
    const hasHist = lista.some(
      (p) => p.propietario_confirmado && (p.tipo_registro === "historico_reconstruido" || p.tipo_registro === "regularizado"),
    );
    if (hasReal && hasHist) {
      const [contratoId, mesStr, anioStr] = k.split("|");
      const mes = Number(mesStr);
      const anio = Number(anioStr);
      const c = contratoById.get(contratoId);
      hallazgos.push({
        id: `real_hist:${k}`,
        tipo: "pago_real_e_historico",
        severidad: "error",
        titulo: "Pago real e histórico en el mismo mes",
        detalle: `${formatMes(mes, anio)}: hay un cobro real y un registro histórico. Mantén sólo uno para evitar incoherencias.`,
        propertyId: c?.property_id,
        contratoId,
        pagoIds: lista.map((p) => p.id),
        mes,
        anio,
        acciones: ["marcar_historico", "eliminar_pago"],
      });
    }
  }

  // ───── Caso 4: contratos sin fecha_inicio_control con pagos históricos ─────
  const histPorContrato = new Map<string, number>();
  for (const p of pagos) {
    if (!p.contrato_id) continue;
    if (p.tipo_registro === "historico_reconstruido" || p.tipo_registro === "regularizado") {
      histPorContrato.set(p.contrato_id, (histPorContrato.get(p.contrato_id) ?? 0) + 1);
    }
  }
  for (const c of contratos) {
    if (c.archivado) continue;
    if (c.fecha_inicio_control) continue;
    if ((histPorContrato.get(c.id) ?? 0) === 0) continue;
    hallazgos.push({
      id: `sin_control:${c.id}`,
      tipo: "contrato_sin_fecha_inicio_control",
      severidad: "warning",
      titulo: "Contrato sin fecha de inicio de control",
      detalle: "Este contrato tiene pagos históricos pero no se ha fijado desde cuándo CapitalRent controla los cobros. Define la fecha para evitar deuda inventada.",
      propertyId: c.property_id,
      contratoId: c.id,
      acciones: ["definir_fecha_control", "abrir_contrato"],
    });
  }

  // ───── Caso 5: contratos vigentes sin renta_mensual ─────
  for (const c of contratos) {
    if (c.archivado) continue;
    if (!contratoEsActivoHoy(c, today)) continue;
    const r = c.renta_mensual;
    if (r == null || Number(r) <= 0) {
      hallazgos.push({
        id: `sin_renta:${c.id}`,
        tipo: "contrato_sin_renta",
        severidad: "error",
        titulo: "Contrato vigente sin renta mensual",
        detalle: "No se puede calcular renta esperada ni deuda mientras el contrato no tenga renta mensual definida.",
        propertyId: c.property_id,
        contratoId: c.id,
        acciones: ["definir_renta", "abrir_contrato"],
      });
    }
  }

  // ───── Caso 6: activo con varios contratos completos vigentes ─────
  const completosPorActivo = new Map<string, string[]>();
  for (const c of contratos) {
    if (!contratoEsActivoHoy(c, today)) continue;
    const modalidad = (c.modalidad_alquiler ?? "completo").toLowerCase();
    if (modalidad !== "completo") continue;
    const arr = completosPorActivo.get(c.property_id) ?? [];
    arr.push(c.id);
    completosPorActivo.set(c.property_id, arr);
  }
  for (const [propertyId, ids] of completosPorActivo.entries()) {
    if (ids.length <= 1) continue;
    hallazgos.push({
      id: `var_completos:${propertyId}`,
      tipo: "activo_varios_contratos_completos",
      severidad: "error",
      titulo: "Activo con varios contratos completos vigentes",
      detalle: `Este activo tiene ${ids.length} contratos completos vigentes a la vez. Si son habitaciones o subactivos, cambia la modalidad; si es un error, archiva el contrato sobrante.`,
      propertyId,
      acciones: ["abrir_contrato"],
    });
  }

  // ───── Caso 8: meses inconsistentes (vía getEstadoMesContrato) ─────
  // Horizonte: último año completo + meses futuros con pagos.
  const horizonteSet = new Set<string>();
  const yNow = today.getFullYear();
  const mNow = today.getMonth() + 1;
  for (let i = 0; i < 12; i++) {
    let m = mNow - i;
    let y = yNow;
    while (m <= 0) { m += 12; y -= 1; }
    horizonteSet.add(`${m}|${y}`);
  }
  for (const p of pagos) {
    if (!p.contrato_id) continue;
    horizonteSet.add(`${p.mes}|${p.anio}`);
  }
  for (const c of contratos) {
    if (c.archivado) continue;
    for (const k of horizonteSet) {
      const [mesStr, anioStr] = k.split("|");
      const mes = Number(mesStr);
      const anio = Number(anioStr);
      if (!isContratoActivoEnMes(c as any, mes, anio)) continue;
      const est = getEstadoMesContrato({
        contrato: c as any,
        mes,
        anio,
        pagos: pagos as any,
        today,
      });
      if (est.inconsistente) {
        // Evita doble aviso si ya lo cubrió pago_real_e_historico.
        const yaCubierto = hallazgos.some(
          (h) => h.tipo === "pago_real_e_historico"
            && h.contratoId === c.id && h.mes === mes && h.anio === anio,
        );
        if (yaCubierto) continue;
        hallazgos.push({
          id: `inc:${c.id}|${mes}|${anio}`,
          tipo: "mes_inconsistente",
          severidad: "warning",
          titulo: "Mes con estado inconsistente",
          detalle: `${formatMes(mes, anio)} del contrato muestra señales contradictorias. Revisa los pagos asociados.`,
          propertyId: c.property_id,
          contratoId: c.id,
          mes,
          anio,
          acciones: ["abrir_contrato"],
        });
      }
    }
  }

  // ───── Agrupado por tipo (para UI) ─────
  const agrupados = {} as Record<HallazgoTipo, Hallazgo[]>;
  for (const h of hallazgos) {
    (agrupados[h.tipo] ||= []).push(h);
  }
  return { hallazgos, agrupadosPorTipo: agrupados, total: hallazgos.length };
}

function formatMes(mes: number, anio: number): string {
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const m = MESES[(mes - 1) % 12] ?? String(mes);
  return `${m} ${anio}`;
}