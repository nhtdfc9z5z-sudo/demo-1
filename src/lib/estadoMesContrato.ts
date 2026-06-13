/**
 * Sprint 3.8 — Estado mensual por contrato (única fuente de verdad).
 *
 * Toda la app debe usar `getEstadoMesContrato` para responder a la pregunta:
 *   "¿En qué estado está el mes M/A del contrato C?"
 *
 * Reglas (no negociables):
 *   1. La unidad económica es `contrato_id`. Nunca se agrupa por inquilino.
 *   2. Meses anteriores a `fecha_inicio_control` ⇒ `no_gestionado` (sin deuda).
 *   3. Sólo cuentan como cobro real los pagos con `tipo_registro = 'pago_real'`
 *      y `afecta_finanzas_actuales !== false`.
 *   4. Los pagos `historico_reconstruido` / `regularizado` cubren visualmente
 *      el mes (estado "historico") pero NO suman a tesorería ni fiscalidad.
 *   5. Si conviven pago_real e histórico para el mismo mes ⇒ `inconsistente=true`
 *      (se muestra aviso, no se inventa deuda).
 *   6. La garantía de unicidad la da la DB: `UNIQUE (contrato_id, mes, anio)`.
 */

import type { Contrato } from "@/hooks/useContratos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import {
  calcularEstadoMesCalendario,
  calcularImporteEsperado,
  isPagoHistorico,
  isPagoRealEffective,
  type EstadoMesCalendarioResult,
  type RentaTramo,
} from "./rentaUtils";

export interface GetEstadoMesContratoParams {
  contrato: Pick<
    Contrato,
    | "id"
    | "renta_mensual"
    | "fecha_inicio"
    | "fecha_fin"
    | "fecha_inicio_control"
    | "created_at"
  >;
  mes: number; // 1-12
  anio: number;
  /** Todos los pagos del propietario; se filtra internamente por contrato_id. */
  pagos: Pick<
    PagoRenta,
    | "contrato_id"
    | "mes"
    | "anio"
    | "importe_pagado"
    | "tipo_registro"
    | "afecta_finanzas_actuales"
    | "propietario_confirmado"
    | "inquilino_notificado"
  >[];
  /** Tramos de `renta_actualizaciones` del contrato (opcional). */
  actualizaciones?: RentaTramo[] | null;
  /** Compensación no monetaria del mes (€). */
  compensado?: number;
  today?: Date;
}

export interface EstadoMesContratoResult extends EstadoMesCalendarioResult {
  contratoId: string;
  mes: number;
  anio: number;
  rentaEsperada: number;
  cobradoReal: number;
  cobradoHistorico: number;
  hasReal: boolean;
  hasHistorico: boolean;
  hasNotificado: boolean;
}

/**
 * Devuelve el estado canónico de un mes para un contrato concreto.
 * Es la única función que debe llamarse desde dashboard, calendario,
 * detalle de renta, balance, fiscalidad, alertas y exportaciones.
 */
export function getEstadoMesContrato(
  params: GetEstadoMesContratoParams,
): EstadoMesContratoResult {
  const {
    contrato,
    mes,
    anio,
    pagos,
    actualizaciones,
    compensado = 0,
    today = new Date(),
  } = params;

  // Regla 1: sólo pagos del contrato; ignorar legacy sin contrato_id.
  const pagosContrato = pagos.filter(
    (p) =>
      p.contrato_id === contrato.id && p.mes === mes && p.anio === anio,
  );

  const confirmadoReales = pagosContrato.filter(
    (p) => p.propietario_confirmado && isPagoRealEffective(p),
  );
  const confirmadoHistoricos = pagosContrato.filter(
    (p) => p.propietario_confirmado && isPagoHistorico(p),
  );
  const notificados = pagosContrato.filter(
    (p) => p.inquilino_notificado && !p.propietario_confirmado,
  );

  const cobradoReal = confirmadoReales.reduce(
    (s, p) => s + Number(p.importe_pagado || 0),
    0,
  );
  const cobradoHistorico = confirmadoHistoricos.reduce(
    (s, p) => s + Number(p.importe_pagado || 0),
    0,
  );

  // Renta esperada con tramos + prorrata + control (regla 2).
  const rentaBase =
    contrato.renta_mensual != null ? Number(contrato.renta_mensual) : 0;
  const esperado = calcularImporteEsperado(
    rentaBase,
    mes,
    anio,
    contrato.fecha_inicio,
    contrato.fecha_fin,
    actualizaciones ?? null,
    contrato.fecha_inicio_control ?? contrato.created_at ?? null,
  );

  const cal = calcularEstadoMesCalendario({
    contrato,
    mes,
    anio,
    rentaEsperada: esperado.importe || null,
    cobradoReal,
    cobradoHistorico,
    hasReal: confirmadoReales.length > 0,
    hasHistorico: confirmadoHistoricos.length > 0,
    hasNotificado: notificados.length > 0,
    compensado,
    today,
  });

  return {
    ...cal,
    contratoId: contrato.id,
    mes,
    anio,
    rentaEsperada: esperado.importe,
    cobradoReal,
    cobradoHistorico,
    hasReal: confirmadoReales.length > 0,
    hasHistorico: confirmadoHistoricos.length > 0,
    hasNotificado: notificados.length > 0,
  };
}

// ─── Sprint 3.8 — iteración por contrato (no por property_id) ──────
//
// Reglas:
//   • Iteramos `contratos` (no `properties`) cuando queremos calcular
//     deuda, renta esperada o estado mensual.
//   • Vivienda completa con varios inquilinos solidarios ⇒ 1 contrato ⇒ 1 renta.
//   • Habitaciones ⇒ varios contratos en el mismo inmueble ⇒ varias rentas.
//   • La agregación por activo es sólo para presentación visual.

/**
 * ¿El contrato está vigente económicamente en (mes, anio)?
 * - Activo: no archivado y `estado !== "finalizado"`.
 * - Rango: el mes cae entre `fecha_inicio` (o `fecha_inicio_control`) y `fecha_fin`.
 *   `fecha_inicio_control` no se evalúa aquí: el control fino lo hace
 *   `getEstadoMesContrato`, que devolverá `no_gestionado` si procede.
 */
export function isContratoActivoEnMes(
  contrato: Pick<
    Contrato,
    | "fecha_inicio"
    | "fecha_fin"
    | "archivado"
    | "estado"
  >,
  mes: number,
  anio: number,
): boolean {
  if (contrato.archivado) return false;
  if (contrato.estado === "finalizado") return false;
  const targetYM = anio * 12 + (mes - 1);
  if (contrato.fecha_inicio) {
    const d = new Date(contrato.fecha_inicio);
    if (!isNaN(d.getTime())) {
      const inicioYM = d.getFullYear() * 12 + d.getMonth();
      if (targetYM < inicioYM) return false;
    }
  }
  if (contrato.fecha_fin) {
    const d = new Date(contrato.fecha_fin);
    if (!isNaN(d.getTime())) {
      const finYM = d.getFullYear() * 12 + d.getMonth();
      if (targetYM > finYM) return false;
    }
  }
  return true;
}

export interface GetEstadosMesPorContratoParams {
  contratos: GetEstadoMesContratoParams["contrato"][];
  mes: number;
  anio: number;
  pagos: GetEstadoMesContratoParams["pagos"];
  /** Map contrato_id → tramos `renta_actualizaciones`. */
  actualizacionesByContrato?: Map<string, RentaTramo[]>;
  /** (contratoId, mes, anio) → compensación €. */
  compensadoEnMes?: (contratoId: string, mes: number, anio: number) => number;
  today?: Date;
  /** Filtra por estos property_id (presentación). Vacío = todos. */
  filterPropertyIds?: string[];
}

/**
 * Calcula el estado canónico de (mes, anio) para cada contrato activo en
 * ese periodo. Esta es la entrada que deben usar dashboard, calendario,
 * tesorería y exportaciones para presentar/sumar magnitudes mensuales.
 */
export function getEstadosMesPorContrato(
  params: GetEstadosMesPorContratoParams,
): EstadoMesContratoResult[] {
  const {
    contratos,
    mes,
    anio,
    pagos,
    actualizacionesByContrato,
    compensadoEnMes,
    today,
    filterPropertyIds,
  } = params;
  const filtros = filterPropertyIds && filterPropertyIds.length > 0
    ? new Set(filterPropertyIds)
    : null;

  const out: EstadoMesContratoResult[] = [];
  for (const c of contratos) {
    if (filtros && !filtros.has((c as any).property_id)) continue;
    if (!isContratoActivoEnMes(c as any, mes, anio)) continue;
    out.push(
      getEstadoMesContrato({
        contrato: c,
        mes,
        anio,
        pagos,
        actualizaciones: actualizacionesByContrato?.get(c.id) ?? null,
        compensado: compensadoEnMes ? compensadoEnMes(c.id, mes, anio) : 0,
        today,
      }),
    );
  }
  return out;
}

export interface AgregadoMesActivo {
  propertyId: string;
  contratos: EstadoMesContratoResult[];
  /** Renta esperada agregada (suma por contrato). */
  rentaEsperada: number;
  cobradoReal: number;
  cobradoHistorico: number;
  deuda: number;
  /** Peor estado visible (impago > pendiente > parcial > notificado > historico > pagado). */
  worstStatus:
    | "impago"
    | "pendiente"
    | "parcial"
    | "notificado"
    | "historico"
    | "pagado"
    | "no_gestionado"
    | undefined;
  inconsistente: boolean;
}

const STATUS_PRIORITY: Record<string, number> = {
  impago: 6,
  pendiente: 5,
  parcial: 4,
  notificado: 3,
  historico: 2,
  pagado: 1,
  no_gestionado: 0,
};

/**
 * Agrupa los estados por contrato bajo su `property_id` para fines de
 * presentación. No recalcula nada económico: sólo apila y reduce.
 */
export function agruparEstadosPorActivo(
  estados: EstadoMesContratoResult[],
  contratoToProperty: (contratoId: string) => string | null | undefined,
): AgregadoMesActivo[] {
  const buckets = new Map<string, AgregadoMesActivo>();
  for (const e of estados) {
    const pid = contratoToProperty(e.contratoId);
    if (!pid) continue;
    let agg = buckets.get(pid);
    if (!agg) {
      agg = {
        propertyId: pid,
        contratos: [],
        rentaEsperada: 0,
        cobradoReal: 0,
        cobradoHistorico: 0,
        deuda: 0,
        worstStatus: undefined,
        inconsistente: false,
      };
      buckets.set(pid, agg);
    }
    agg.contratos.push(e);
    agg.rentaEsperada += e.rentaEsperada;
    agg.cobradoReal += e.cobradoReal;
    agg.cobradoHistorico += e.cobradoHistorico;
    agg.deuda += e.deuda;
    if (e.inconsistente) agg.inconsistente = true;
    const s = (e.status ?? undefined) as AgregadoMesActivo["worstStatus"];
    const prev = agg.worstStatus;
    if (
      s &&
      (!prev || (STATUS_PRIORITY[s] ?? -1) > (STATUS_PRIORITY[prev] ?? -1))
    ) {
      agg.worstStatus = s;
    }
  }
  return Array.from(buckets.values());
}

