/**
 * Fase 4 (defensiva) — Dedupe de pagos en lectura.
 *
 * Contexto: hoy `pagos_renta` se almacena con clave única
 * `(property_id, inquilino_id, mes, anio)`. Cuando un contrato tiene varios
 * inquilinos solidarios y la UI registra un pago por cada uno, el motor
 * financiero/fiscal acaba sumando la renta N veces.
 *
 * Esta utilidad NO modifica la base de datos. Solo agrega los pagos del
 * mismo (contrato, mes, año) en un único ingreso económico/fiscal cuando
 * el contrato funciona como "alquiler completo". Para modalidad
 * `habitaciones` (o casos explícitamente configurados como rentas
 * separadas) NO aplica dedupe.
 *
 * Reglas para modalidad `completo`:
 *  1. Ignorar pagos con importe 0 (no aportan ingreso).
 *  2. Si N == 0 → 0.
 *  3. Si conocemos `rentaEsperada`:
 *     a. Si hay ≥2 pagos con importe exactamente igual a la renta esperada
 *        ⇒ se interpretan como duplicados solidarios. Se cuenta UNA sola
 *        vez (= renta) y se emite warning `duplicado_renta_solidaria`.
 *     b. Si la suma de importes ≤ renta esperada ⇒ se acepta tal cual
 *        (caso de pagos parciales reales que completan o no la renta).
 *     c. Si la suma > renta esperada ⇒ se devuelve la suma pero se emite
 *        warning `excede_renta_esperada` para no inflar dashboard/fiscalidad
 *        sin trazabilidad.
 *  4. Si no conocemos `rentaEsperada` ⇒ suma directa, sin warnings.
 *
 * Para modalidad `habitaciones` ⇒ suma directa de los importes >0.
 *
 * Esta función es pura y no escribe en logs. El llamador decide si emitir
 * `captureAppError({ audit: true, ... })` a partir de los warnings.
 */

export type ModalidadAlquiler = "completo" | "habitaciones";

/** Pago mínimo necesario para deduplicar. */
export interface DedupePagoLike {
  id?: string;
  inquilino_id?: string;
  importe_pagado?: number | null;
  tipo_registro?: string | null;
  /** Sprint 3: contrato del que procede el pago (nullable durante backfill). */
  contrato_id?: string | null;
}

export type DedupeWarning =
  | "duplicado_renta_solidaria"
  | "excede_renta_esperada";

export interface DedupeResult<P extends DedupePagoLike> {
  /** Ingreso económico efectivo aplicable al periodo. */
  ingreso: number;
  /** Subconjunto de pagos retenidos tras dedupe. */
  pagosUsados: P[];
  /** Subconjunto de pagos descartados como duplicado. */
  pagosDescartados: P[];
  warnings: DedupeWarning[];
}

const EPS = 0.01;

/**
 * Infiera la modalidad de alquiler de un contrato. Hoy siempre devuelve
 * `completo` (la BD aún no tiene flag). Extensible para Sprint 3 cuando se
 * añada `contratos_arrendamiento.modalidad_alquiler`.
 */
export function inferModalidadAlquiler(
  contrato?: { modalidad_alquiler?: string | null } | null,
): ModalidadAlquiler {
  const raw = contrato?.modalidad_alquiler;
  if (raw === "habitaciones") return "habitaciones";
  return "completo";
}

/**
 * Sprint 3 — agrupador canónico por contrato.
 *
 * Agrupa una lista de pagos por `contrato_id`. Los pagos sin `contrato_id`
 * (legacy / pendientes de backfill) se agrupan bajo la clave especial
 * `__legacy__`, donde caerá el deduper Fase 4 como fallback.
 *
 * No realiza dedupe por sí solo: solo prepara las particiones para que el
 * llamador aplique `dedupePagosCompleto` por grupo, usando la modalidad y
 * renta esperada del contrato correspondiente.
 */
export const LEGACY_GROUP_KEY = "__legacy__";

/**
 * Sprint 3 — Fase F: deprecación gradual del deduper Fase 4.
 *
 * El deduper se mantiene como red de seguridad durante Sprint 3. Tras el
 * backfill (Fase B) y la reconciliación (Fase E), cualquier dedupe que se
 * dispare en el bucket `legacy_fase4` significa que aún hay pagos sin
 * `contrato_id`. Cuando la telemetría muestre 0 hits en 30 días, este
 * módulo se marcará como `removable` y se podrá eliminar.
 *
 * Estados:
 *  - `active`: deduper en uso real, telemetría informativa.
 *  - `monitoring`: hits residuales esperados, vigilamos métricas.
 *  - `removable`: 0 hits sostenidos, listo para borrar en próximo sprint.
 */
export const PAGOS_DEDUPE_FASE4_DEPRECATION = {
  status: "monitoring" as "active" | "monitoring" | "removable",
  since: "2026-05-27",
  replacedBy: "groupPagosPorContrato + detectarConflictoPagoCompleto",
  notes:
    "No extender. Sólo bugfix. Eliminar cuando dedupeTelemetry.snapshot().legacy_fase4_dedupes == 0 durante 30d.",
} as const;

/**
 * Telemetría in-memory del deduper. NO persiste por sí sola; el llamador
 * (finanzasEngine / fiscalPack) decide cuándo hacer `flushToAudit()` para
 * volcar el resumen a `error_logs`. No contiene PII: sólo contadores.
 */
export interface DedupeTelemetrySnapshot {
  legacy_fase4_groups: number;
  legacy_fase4_dedupes: number;
  por_contrato_groups: number;
  por_contrato_dedupes: number;
  warnings_total: number;
  started_at: string;
}

let _telemetry: DedupeTelemetrySnapshot = {
  legacy_fase4_groups: 0,
  legacy_fase4_dedupes: 0,
  por_contrato_groups: 0,
  por_contrato_dedupes: 0,
  warnings_total: 0,
  started_at: new Date().toISOString(),
};

export const dedupeTelemetry = {
  /** Registra el procesamiento de un grupo por el deduper. */
  recordGroup(opts: { bucket: "legacy_fase4" | "por_contrato"; deduped: boolean; warnings: number }) {
    if (opts.bucket === "legacy_fase4") {
      _telemetry.legacy_fase4_groups += 1;
      if (opts.deduped) _telemetry.legacy_fase4_dedupes += 1;
    } else {
      _telemetry.por_contrato_groups += 1;
      if (opts.deduped) _telemetry.por_contrato_dedupes += 1;
    }
    _telemetry.warnings_total += opts.warnings;
  },
  snapshot(): DedupeTelemetrySnapshot {
    return { ..._telemetry };
  },
  reset() {
    _telemetry = {
      legacy_fase4_groups: 0,
      legacy_fase4_dedupes: 0,
      por_contrato_groups: 0,
      por_contrato_dedupes: 0,
      warnings_total: 0,
      started_at: new Date().toISOString(),
    };
    _seenSignatures.clear();
    _seenAudits.clear();
  },
};

/**
 * H1 (hardening) — throttling de telemetría y audit logs.
 *
 * Para evitar spam por re-renders de finanzasEngine/fiscalPack, mantenemos
 * dos sets in-memory de firmas ya vistas:
 *  - `_seenSignatures` evita contar el mismo grupo N veces en `recordGroup`.
 *  - `_seenAudits` evita re-emitir el mismo audit log en la misma sesión.
 *
 * Se limpian con `dedupeTelemetry.reset()` (admin page) o naturalmente al
 * recargar la app.
 */
const _seenSignatures = new Set<string>();
const _seenAudits = new Set<string>();

export function shouldRecordGroup(signature: string): boolean {
  if (_seenSignatures.has(signature)) return false;
  _seenSignatures.add(signature);
  return true;
}

export function shouldEmitAudit(signature: string): boolean {
  if (_seenAudits.has(signature)) return false;
  _seenAudits.add(signature);
  return true;
}

export function groupPagosPorContrato<P extends DedupePagoLike>(
  pagos: P[],
): Map<string, P[]> {
  const out = new Map<string, P[]>();
  for (const p of pagos) {
    const k = p.contrato_id || LEGACY_GROUP_KEY;
    const arr = out.get(k);
    if (arr) arr.push(p);
    else out.set(k, [p]);
  }
  return out;
}

/**
 * Dedupe defensivo de pagos para un mismo (property/contrato, mes, año).
 * El llamador debe pre-filtrar los pagos al periodo correcto.
 */
export function dedupePagosCompleto<P extends DedupePagoLike>(
  pagos: P[],
  rentaEsperada: number | null,
  modalidad: ModalidadAlquiler = "completo",
): DedupeResult<P> {
  const nonZero = pagos.filter(p => Number(p.importe_pagado ?? 0) > 0);

  // Modalidad habitaciones → suma sin dedupe.
  if (modalidad === "habitaciones") {
    const ingreso = nonZero.reduce((s, p) => s + Number(p.importe_pagado ?? 0), 0);
    return { ingreso, pagosUsados: nonZero, pagosDescartados: [], warnings: [] };
  }

  if (nonZero.length === 0) {
    return { ingreso: 0, pagosUsados: [], pagosDescartados: [], warnings: [] };
  }

  const suma = nonZero.reduce((s, p) => s + Number(p.importe_pagado ?? 0), 0);

  // Sin renta conocida → no podemos detectar duplicidad. Devolvemos suma.
  if (rentaEsperada == null || rentaEsperada <= 0) {
    return { ingreso: suma, pagosUsados: nonZero, pagosDescartados: [], warnings: [] };
  }

  const renta = Number(rentaEsperada);

  // (a) Detectar duplicados exactos de la renta completa.
  const igualesRenta = nonZero.filter(p => Math.abs(Number(p.importe_pagado ?? 0) - renta) < EPS);
  if (igualesRenta.length >= 2) {
    // Tomamos uno como representativo, el resto como descartado.
    // Preferimos `pago_real` confirmado > histórico.
    const ordenados = [...igualesRenta].sort((a, b) => {
      const ar = (a.tipo_registro ?? "pago_real") === "pago_real" ? 0 : 1;
      const br = (b.tipo_registro ?? "pago_real") === "pago_real" ? 0 : 1;
      return ar - br;
    });
    const elegido = ordenados[0];
    const descartados = nonZero.filter(p => p !== elegido);
    // Si además de los duplicados hay otros importes < renta, los ignoramos
    // en este modo (no son "parciales que completan", la renta ya está
    // cubierta por uno de los duplicados). Quedan descartados con warning.
    return {
      ingreso: renta,
      pagosUsados: [elegido],
      pagosDescartados: descartados,
      warnings: ["duplicado_renta_solidaria"],
    };
  }

  // (b) Suma ≤ renta esperada → parcial / exacto, sin dedupe.
  if (suma <= renta + EPS) {
    return { ingreso: suma, pagosUsados: nonZero, pagosDescartados: [], warnings: [] };
  }

  // (c) Excede renta esperada sin duplicado evidente → no inflamos en
  // silencio. Devolvemos la suma + warning.
  return {
    ingreso: suma,
    pagosUsados: nonZero,
    pagosDescartados: [],
    warnings: ["excede_renta_esperada"],
  };
}
