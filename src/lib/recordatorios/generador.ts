/**
 * Sprint 4.3 — Generador puro de recordatorios internos.
 * Sin React, sin Supabase: recibe datos ya cargados y devuelve
 * candidatos deterministas (mismo input → mismo origen_id).
 * El hook se encarga de persistir y deduplicar contra la BD.
 */

export type RecordatorioTipo =
  | "renta_pendiente"
  | "contrato_vence"
  | "documento_vencido"
  | "documento_vence_pronto"
  | "ocr_fallido"
  | "auditoria_hallazgo"
  | "revision_renta_anualidad"
  | "renovacion_sugerida";

export type RecordatorioOrigenTipo =
  | "pago_renta"
  | "contrato"
  | "documento"
  | "auditoria";

export interface RecordatorioCandidato {
  tipo: RecordatorioTipo;
  origen_tipo: RecordatorioOrigenTipo;
  origen_id: string;
  titulo: string;
  descripcion?: string | null;
  fecha_objetivo?: string | null; // YYYY-MM-DD
  prioridad: 1 | 2 | 3 | 4; // 1 = más urgente
}

export interface GeneradorInputDocumento {
  id: string;
  nombre: string;
  ocr_status: string;
  fecha_vencimiento: string | null;
}

export interface GeneradorInputContrato {
  id: string;
  titulo?: string | null;
  fecha_inicio?: string | null;
  fecha_fin: string | null;
  estado?: string | null;
  prorroga_anos?: number | null;
  renovacion_automatica?: boolean | null;
  renovacion_confirmada_at?: string | null;
}

export interface GeneradorInputProperty {
  id: string;
  nombre_interno?: string | null;
}

export interface GeneradorInputInquilino {
  id: string;
  property_id: string;
  rol_inquilino?: string | null;
}

export interface GeneradorInputPago {
  property_id: string;
  mes: number;
  anio: number;
  importe_pagado: number | null;
  propietario_confirmado: boolean | null;
}

export interface GeneradorInputHallazgo {
  id: string;
  tipo: string;
  titulo?: string;
}

export interface GeneradorInputRentaActualizacion {
  contrato_id: string | null;
  fecha_efectiva: string;
}

export interface GeneradorRentaResolver {
  /** Devuelve la renta esperada mensual de una vivienda concreta (0 si no aplica). */
  (propertyId: string): number;
}

export interface GenerarRecordatoriosParams {
  now?: Date;
  documentos: GeneradorInputDocumento[];
  contratos: GeneradorInputContrato[];
  properties: GeneradorInputProperty[];
  inquilinos: GeneradorInputInquilino[];
  pagos: GeneradorInputPago[];
  hallazgos: GeneradorInputHallazgo[];
  resolveRentaEsperada: GeneradorRentaResolver;
  horizonteDiasDocs?: number; // por defecto 30
  horizonteDiasContratos?: number; // por defecto 90
  rentaActualizaciones?: GeneradorInputRentaActualizacion[];
}

const MS_DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  const ams = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bms - ams) / MS_DAY);
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function generarRecordatorios(
  params: GenerarRecordatoriosParams,
): RecordatorioCandidato[] {
  const now = params.now ?? new Date();
  const horizonteDocs = params.horizonteDiasDocs ?? 30;
  const horizonteContratos = params.horizonteDiasContratos ?? 90;
  const out: RecordatorioCandidato[] = [];

  // 1. Rentas pendientes del mes en curso.
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  for (const prop of params.properties) {
    const tenants = params.inquilinos.filter(
      (i) => i.property_id === prop.id && i.rol_inquilino !== "avalista",
    );
    if (tenants.length === 0) continue;
    const esperado = params.resolveRentaEsperada(prop.id) || 0;
    if (esperado <= 0) continue;
    const cobrado = params.pagos
      .filter(
        (p) =>
          p.property_id === prop.id &&
          p.mes === mes &&
          p.anio === anio &&
          p.propietario_confirmado,
      )
      .reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
    const falta = esperado - cobrado;
    if (falta > 0) {
      out.push({
        tipo: "renta_pendiente",
        origen_tipo: "pago_renta",
        origen_id: `${prop.id}:${anio}-${String(mes).padStart(2, "0")}`,
        titulo: `Renta pendiente · ${prop.nombre_interno || "Activo"}`,
        descripcion: `Faltan ${Math.round(falta).toLocaleString("es-ES")} € de ${String(mes).padStart(2, "0")}/${anio}.`,
        fecha_objetivo: toISODate(now),
        prioridad: 2,
      });
    }
  }

  // 2. Contratos próximos a vencer (≤ horizonte).
  for (const c of params.contratos) {
    if ((c.estado || "vigente") === "finalizado") continue;
    const fin = parseDate(c.fecha_fin);
    if (!fin) continue;
    const diff = daysBetween(now, fin);
    if (diff < 0 || diff > horizonteContratos) continue;
    out.push({
      tipo: "contrato_vence",
      origen_tipo: "contrato",
      origen_id: c.id,
      titulo: `Renovación · ${c.titulo || "Contrato"}`,
      descripcion: `Se renueva en ${diff} días (${toISODate(fin)}).`,
      fecha_objetivo: toISODate(fin),
      prioridad: diff <= 15 ? 2 : 3,
    });
  }

  // 3 + 4. Documentos vencidos y por vencer.
  for (const doc of params.documentos) {
    if (doc.ocr_status === "error") {
      out.push({
        tipo: "ocr_fallido",
        origen_tipo: "documento",
        origen_id: doc.id,
        titulo: `OCR fallido · ${doc.nombre}`,
        descripcion: "Reintenta el OCR o sustituye el archivo.",
        fecha_objetivo: null,
        prioridad: 4,
      });
    }
    const venc = parseDate(doc.fecha_vencimiento);
    if (!venc) continue;
    const diff = daysBetween(now, venc);
    if (diff < 0) {
      out.push({
        tipo: "documento_vencido",
        origen_tipo: "documento",
        origen_id: doc.id,
        titulo: `Documento vencido · ${doc.nombre}`,
        descripcion: `Caducó hace ${-diff} días.`,
        fecha_objetivo: toISODate(venc),
        prioridad: 1,
      });
    } else if (diff <= horizonteDocs) {
      out.push({
        tipo: "documento_vence_pronto",
        origen_tipo: "documento",
        origen_id: doc.id,
        titulo: `Documento por vencer · ${doc.nombre}`,
        descripcion: `Vence en ${diff} días.`,
        fecha_objetivo: toISODate(venc),
        prioridad: diff <= 7 ? 2 : 3,
      });
    }
  }

  // 6. Hallazgos auditoría.
  for (const h of params.hallazgos) {
    out.push({
      tipo: "auditoria_hallazgo",
      origen_tipo: "auditoria",
      origen_id: h.id,
      titulo: h.titulo || `Revisar dato legacy (${h.tipo})`,
      descripcion: "Aparece en la auditoría de datos legacy.",
      fecha_objetivo: null,
      prioridad: 4,
    });
  }

  // 7. Avisos de anualidad (revisión IPC) por contrato vigente.
  //    Se calculan 90 días antes de cada aniversario y se deduplican contra
  //    `renta_actualizaciones` (si ya hay actualización con fecha_efectiva
  //    dentro de los 60 días alrededor del aniversario → no avisamos).
  const actuByContrato = new Map<string, Date[]>();
  for (const a of params.rentaActualizaciones || []) {
    if (!a.contrato_id) continue;
    const d = parseDate(a.fecha_efectiva);
    if (!d) continue;
    const arr = actuByContrato.get(a.contrato_id) || [];
    arr.push(d);
    actuByContrato.set(a.contrato_id, arr);
  }

  for (const c of params.contratos) {
    if ((c.estado || "vigente") === "finalizado") continue;
    const ini = parseDate(c.fecha_inicio);
    if (!ini) continue;
    const fin = parseDate(c.fecha_fin);
    const ya = actuByContrato.get(c.id) || [];
    for (let n = 1; n <= 30; n++) {
      const ani = new Date(ini);
      ani.setFullYear(ani.getFullYear() + n);
      if (fin && ani > fin) break;
      const diff = daysBetween(now, ani);
      if (diff > 90) break;
      if (diff < -30) continue;
      // Dedupe: si ya hay actualización ±60 días del aniversario, saltar.
      const procesada = ya.some((d) => Math.abs(daysBetween(d, ani)) <= 60);
      if (procesada) continue;
      out.push({
        tipo: "revision_renta_anualidad",
        origen_tipo: "contrato",
        origen_id: `${c.id}:anualidad:${n}`,
        titulo: `Revisión de renta · anualidad ${n}`,
        descripcion: `Tu contrato cumple ${n} año${n === 1 ? "" : "s"} el ${toISODate(ani)}. Revisa si toca actualizar la renta (IPC u otro índice).`,
        fecha_objetivo: toISODate(ani),
        prioridad: diff <= 30 ? 2 : 3,
      });
    }
  }

  // 8. Renovación sugerida pendiente (post fecha_fin, sin confirmar).
  for (const c of params.contratos) {
    if ((c.estado || "vigente") === "finalizado") continue;
    if (!c.renovacion_automatica) continue;
    if (!(c.prorroga_anos && c.prorroga_anos > 0)) continue;
    if (c.renovacion_confirmada_at) continue;
    const fin = parseDate(c.fecha_fin);
    if (!fin) continue;
    const diff = daysBetween(now, fin);
    if (diff > 0) continue; // aún no ha vencido
    const propuestaFin = new Date(fin);
    propuestaFin.setFullYear(propuestaFin.getFullYear() + (c.prorroga_anos || 0));
    out.push({
      tipo: "renovacion_sugerida",
      origen_tipo: "contrato",
      origen_id: `${c.id}:renovacion`,
      titulo: `Renovación sugerida · ${c.titulo || "Contrato"}`,
      descripcion: `El contrato venció el ${toISODate(fin)}. La cláusula prevé prórroga hasta ${toISODate(propuestaFin)}. Confírmala para extenderlo.`,
      fecha_objetivo: toISODate(fin),
      prioridad: 1,
    });
  }

  return out;
}