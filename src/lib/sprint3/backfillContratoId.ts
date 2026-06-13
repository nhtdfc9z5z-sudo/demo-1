/**
 * Sprint 3 — Fase B: backfill auditado de `pagos_renta.contrato_id`.
 *
 * Capa PURA: clasifica cada pago contra los contratos disponibles sin
 * tocar la base de datos. La capa I/O (hook) hace dry-run primero,
 * presenta el resumen al usuario y, sólo tras confirmación explícita,
 * aplica los `update` uno a uno.
 *
 * Reglas:
 *  - Match único de contrato vigente para (property_id, inquilino_id, mes/anio)
 *    → status `asignable` con `contrato_id_propuesto`.
 *  - 0 candidatos → `sin_contrato`.
 *  - >1 candidato → `ambiguo` (NUNCA se asigna automáticamente).
 *  - Pago ya tiene `contrato_id` → `ya_asignado` (no se toca).
 *  - Pago sin `inquilino_id` o `property_id` → `error_input`.
 *
 * Nunca borra ni fusiona pagos. Los logs de auditoría NO llevan PII
 * (importes detallados, nombres, DNIs); sólo claves agregadas
 * (pago_id, property_id, contrato_id, candidatos.length, mes, anio).
 */

export type BackfillStatus =
  | "ya_asignado"
  | "asignable"
  | "ambiguo"
  | "sin_contrato"
  | "error_input";

export interface PagoForBackfill {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  mes: number;
  anio: number;
  contrato_id?: string | null;
}

export interface ContratoForBackfill {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  archivado?: boolean | null;
}

/**
 * Personas extra de un contrato (inquilinos solidarios). Cuando un pago
 * viene de un inquilino que NO es el `contrato.inquilino_id` titular pero
 * sí aparece en `contrato_personas` con ese mismo `inquilino_id`, debe
 * considerarse candidato.
 */
export type PersonasPorContrato = Record<string, string[]>; // contrato_id -> [inquilino_id...]

export interface BackfillRow {
  pago_id: string;
  property_id: string | null;
  inquilino_id: string | null;
  mes: number;
  anio: number;
  status: BackfillStatus;
  contrato_id_actual?: string | null;
  contrato_id_propuesto?: string | null;
  /** Lista de candidatos cuando hay 0 o >1 match. */
  candidatos: string[];
  motivo?: string;
}

export interface BackfillSummary {
  total: number;
  asignables: number;
  ambiguos: number;
  sin_contrato: number;
  ya_asignados: number;
  errores: number;
  rows: BackfillRow[];
}

function lastDayOfMonth(anio: number, mes: number): string {
  // mes 1..12. Devuelve "YYYY-MM-DD" del último día.
  const d = new Date(Date.UTC(anio, mes, 0));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonth(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/** Vigencia del contrato en cualquier día del mes objetivo. */
function contratoCubreMes(c: ContratoForBackfill, anio: number, mes: number): boolean {
  if (c.archivado) return false;
  if (!c.fecha_inicio) return false;
  const lo = firstDayOfMonth(anio, mes);
  const hi = lastDayOfMonth(anio, mes);
  if (c.fecha_inicio > hi) return false;
  if (c.fecha_fin && c.fecha_fin < lo) return false;
  return true;
}

/** Clasifica un único pago contra los contratos disponibles. */
export function classifyPagoForBackfill(
  pago: PagoForBackfill,
  contratos: ContratoForBackfill[],
  personasPorContrato: PersonasPorContrato = {},
): BackfillRow {
  const base: BackfillRow = {
    pago_id: pago.id,
    property_id: pago.property_id,
    inquilino_id: pago.inquilino_id,
    mes: pago.mes,
    anio: pago.anio,
    status: "sin_contrato",
    contrato_id_actual: pago.contrato_id ?? null,
    candidatos: [],
  };

  if (pago.contrato_id) {
    return { ...base, status: "ya_asignado" };
  }
  if (!pago.property_id || !pago.inquilino_id) {
    return { ...base, status: "error_input", motivo: "pago sin property_id o inquilino_id" };
  }

  const candidatos = contratos.filter((c) => {
    if (c.property_id !== pago.property_id) return false;
    if (!contratoCubreMes(c, pago.anio, pago.mes)) return false;
    if (c.inquilino_id === pago.inquilino_id) return true;
    const extras = personasPorContrato[c.id] || [];
    return extras.includes(pago.inquilino_id!);
  });

  if (candidatos.length === 1) {
    return {
      ...base,
      status: "asignable",
      contrato_id_propuesto: candidatos[0].id,
      candidatos: [candidatos[0].id],
    };
  }
  if (candidatos.length > 1) {
    return {
      ...base,
      status: "ambiguo",
      candidatos: candidatos.map((c) => c.id),
      motivo: `${candidatos.length} contratos vigentes solapan en ${pago.mes}/${pago.anio}`,
    };
  }
  return { ...base, motivo: "no hay contrato vigente que cubra este mes" };
}

export function buildBackfillSummary(rows: BackfillRow[]): BackfillSummary {
  const summary: BackfillSummary = {
    total: rows.length,
    asignables: 0,
    ambiguos: 0,
    sin_contrato: 0,
    ya_asignados: 0,
    errores: 0,
    rows,
  };
  for (const r of rows) {
    if (r.status === "asignable") summary.asignables++;
    else if (r.status === "ambiguo") summary.ambiguos++;
    else if (r.status === "sin_contrato") summary.sin_contrato++;
    else if (r.status === "ya_asignado") summary.ya_asignados++;
    else if (r.status === "error_input") summary.errores++;
  }
  return summary;
}

/**
 * Construye el payload de auditoría (sin PII) que se envía a `error_logs`
 * vía `captureAppError({ audit: true })`. Mantiene una vista agregada del
 * dry-run; los detalles por fila se loguean por separado y de uno en uno
 * sólo cuando se aplica.
 */
export function buildAuditContext(summary: BackfillSummary, fase: "preview" | "apply") {
  return {
    fase,
    total: summary.total,
    asignables: summary.asignables,
    ambiguos: summary.ambiguos,
    sin_contrato: summary.sin_contrato,
    ya_asignados: summary.ya_asignados,
    errores: summary.errores,
  };
}
