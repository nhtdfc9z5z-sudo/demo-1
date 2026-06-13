/**
 * Sprint 3 — Fase E: clasificador puro de pagos ambiguos para reconciliación.
 *
 * NO toca BD. Sólo lee snapshots en memoria (pagos, contratos, tramos,
 * personas) y produce una lista de `ReconciliacionItem` agrupada por
 * categoría. La capa I/O (hook) carga, presenta y, sólo tras
 * confirmación explícita por fila, aplica acciones seguras y deja
 * trazabilidad en `pagos_renta_reconciliacion`.
 *
 * Categorías:
 *  - duplicado_real:           >=2 pago_real para mismo (contrato|property, mes, año)
 *  - historico_fiscal_coincide: histórico con afecta_fiscalidad=true que coincide con un pago_real (caso PV6 570 vs 770)
 *  - pago_cero_solidario:      importe=0 de un solidario cuando otro pago real cubre el mes
 *  - excede_renta:             suma de pagos reales > renta esperada × tolerancia
 *  - sin_contrato_id:          pagos sin contrato_id (post-backfill)
 *
 * Reglas:
 *  - Nunca propone borrar ni fusionar automáticamente.
 *  - Acciones seguras se decide en UI, no en este módulo.
 *  - Logs deben construirse sin PII (sólo IDs y agregados).
 */

import { getRentaEnPeriodo, type RentaTramo } from "@/lib/rentaUtils";

export type ReconciliacionCategoria =
  | "duplicado_real"
  | "historico_fiscal_coincide"
  | "pago_cero_solidario"
  | "excede_renta"
  | "sin_contrato_id";

export type TipoRegistro =
  | "pago_real"
  | "historico_reconstruido"
  | "regularizado"
  | "pendiente"
  | null;

export interface PagoForReconciliacion {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  contrato_id: string | null;
  mes: number;
  anio: number;
  importe_pagado: number | null;
  tipo_registro: TipoRegistro;
  afecta_finanzas_actuales?: boolean | null;
  afecta_fiscalidad?: boolean | null;
}

export interface ContratoForReconciliacion {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  renta_mensual: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  modalidad_alquiler?: string | null;
}

export interface TramosPorContrato {
  [contratoId: string]: RentaTramo[];
}

export interface PersonasPorContrato {
  [contratoId: string]: string[]; // inquilino_id[]
}

export interface ReconciliacionItem {
  categoria: ReconciliacionCategoria;
  /** Pagos involucrados. El primero es el "principal". */
  pago_ids: string[];
  property_id: string | null;
  contrato_id: string | null;
  mes: number;
  anio: number;
  motivo: string;
  /** Datos para mostrar y para audit log (sin PII). */
  detalle: {
    importes: number[];
    tipos: TipoRegistro[];
    renta_esperada?: number | null;
    suma_real?: number;
  };
}

export interface ReconciliacionSummary {
  total: number;
  duplicado_real: ReconciliacionItem[];
  historico_fiscal_coincide: ReconciliacionItem[];
  pago_cero_solidario: ReconciliacionItem[];
  excede_renta: ReconciliacionItem[];
  sin_contrato_id: ReconciliacionItem[];
}

/** Tolerancia para "excede_renta": pequeña holgura por redondeos / proratas. */
export const EXCEDE_RENTA_TOLERANCIA = 1.05;

function groupKey(p: PagoForReconciliacion): string {
  // Si tenemos contrato, agrupamos por contrato; si no, por property
  // (fallback Fase 4). NUNCA mezclamos pagos de contratos distintos.
  const k = p.contrato_id ? `c:${p.contrato_id}` : `p:${p.property_id ?? "null"}`;
  return `${k}|${p.anio}-${String(p.mes).padStart(2, "0")}`;
}

function safeImporte(p: PagoForReconciliacion): number {
  return Number(p.importe_pagado ?? 0);
}

function findContrato(
  contratos: ContratoForReconciliacion[],
  contratoId: string | null,
): ContratoForReconciliacion | null {
  if (!contratoId) return null;
  return contratos.find((c) => c.id === contratoId) ?? null;
}

/**
 * Clasifica un conjunto de pagos y devuelve los items que requieren
 * decisión humana. NO incluye pagos sanos.
 */
export function buildReconciliacion(
  pagos: PagoForReconciliacion[],
  contratos: ContratoForReconciliacion[],
  tramosPorContrato: TramosPorContrato = {},
  personasPorContrato: PersonasPorContrato = {},
): ReconciliacionSummary {
  const summary: ReconciliacionSummary = {
    total: 0,
    duplicado_real: [],
    historico_fiscal_coincide: [],
    pago_cero_solidario: [],
    excede_renta: [],
    sin_contrato_id: [],
  };

  const pagosById = new Map(pagos.map((p) => [p.id, p]));
  const groups = new Map<string, PagoForReconciliacion[]>();
  for (const p of pagos) {
    const k = groupKey(p);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }

  // 5) sin_contrato_id (rápido, no requiere agrupar)
  for (const p of pagos) {
    if (!p.contrato_id) {
      summary.sin_contrato_id.push({
        categoria: "sin_contrato_id",
        pago_ids: [p.id],
        property_id: p.property_id,
        contrato_id: null,
        mes: p.mes,
        anio: p.anio,
        motivo: "Pago sin contrato_id asignado tras backfill",
        detalle: { importes: [safeImporte(p)], tipos: [p.tipo_registro] },
      });
    }
  }

  // 1-4) recorrer grupos
  for (const [, arr] of groups) {
    const realesNoZero = arr.filter(
      (p) => p.tipo_registro === "pago_real" && safeImporte(p) > 0,
    );
    const realesZero = arr.filter(
      (p) => p.tipo_registro === "pago_real" && safeImporte(p) === 0,
    );
    const historicosFiscales = arr.filter(
      (p) =>
        (p.tipo_registro === "historico_reconstruido" || p.tipo_registro === "regularizado") &&
        p.afecta_fiscalidad === true,
    );

    const first = arr[0];
    const contrato = findContrato(contratos, first.contrato_id);
    const rentaEsperada = contrato
      ? getRentaEnPeriodo(
          tramosPorContrato[contrato.id] ?? null,
          first.mes,
          first.anio,
          contrato.renta_mensual ?? null,
        )
      : null;

    // 1) duplicado_real: >=2 pagos reales con importe>0 en mismo grupo
    if (realesNoZero.length >= 2) {
      summary.duplicado_real.push({
        categoria: "duplicado_real",
        pago_ids: realesNoZero.map((p) => p.id),
        property_id: first.property_id,
        contrato_id: first.contrato_id,
        mes: first.mes,
        anio: first.anio,
        motivo: `${realesNoZero.length} pagos reales para el mismo periodo`,
        detalle: {
          importes: realesNoZero.map(safeImporte),
          tipos: realesNoZero.map((p) => p.tipo_registro),
          renta_esperada: rentaEsperada,
          suma_real: realesNoZero.reduce((s, p) => s + safeImporte(p), 0),
        },
      });
    }

    // 2) historico_fiscal_coincide: histórico con fiscalidad activa
    //    coincide con un pago_real del mismo periodo (PV6 570 vs 770).
    if (historicosFiscales.length > 0 && realesNoZero.length > 0) {
      for (const h of historicosFiscales) {
        summary.historico_fiscal_coincide.push({
          categoria: "historico_fiscal_coincide",
          pago_ids: [h.id, ...realesNoZero.map((p) => p.id)],
          property_id: h.property_id,
          contrato_id: h.contrato_id,
          mes: h.mes,
          anio: h.anio,
          motivo:
            "Histórico con afecta_fiscalidad=true coincide con pago real del mismo periodo",
          detalle: {
            importes: [safeImporte(h), ...realesNoZero.map(safeImporte)],
            tipos: [h.tipo_registro, ...realesNoZero.map((p) => p.tipo_registro)],
            renta_esperada: rentaEsperada,
            suma_real: realesNoZero.reduce((s, p) => s + safeImporte(p), 0),
          },
        });
      }
    }

    // 3) pago_cero_solidario: importe=0 (pago_real) cuando otro real cubre
    if (realesZero.length > 0 && realesNoZero.length > 0) {
      const solidariosIds = new Set(
        first.contrato_id ? personasPorContrato[first.contrato_id] ?? [] : [],
      );
      for (const z of realesZero) {
        const esSolidario =
          z.inquilino_id != null &&
          z.inquilino_id !== contrato?.inquilino_id &&
          solidariosIds.has(z.inquilino_id);
        if (!esSolidario && solidariosIds.size > 0) continue;
        summary.pago_cero_solidario.push({
          categoria: "pago_cero_solidario",
          pago_ids: [z.id, ...realesNoZero.map((p) => p.id)],
          property_id: z.property_id,
          contrato_id: z.contrato_id,
          mes: z.mes,
          anio: z.anio,
          motivo: "Pago a 0 € de inquilino solidario cuando otro pago cubre el mes",
          detalle: {
            importes: [0, ...realesNoZero.map(safeImporte)],
            tipos: [z.tipo_registro, ...realesNoZero.map((p) => p.tipo_registro)],
            renta_esperada: rentaEsperada,
            suma_real: realesNoZero.reduce((s, p) => s + safeImporte(p), 0),
          },
        });
      }
    }

    // 4) excede_renta: suma de reales > renta esperada × tolerancia
    if (rentaEsperada && rentaEsperada > 0 && realesNoZero.length > 0) {
      const suma = realesNoZero.reduce((s, p) => s + safeImporte(p), 0);
      if (suma > rentaEsperada * EXCEDE_RENTA_TOLERANCIA) {
        summary.excede_renta.push({
          categoria: "excede_renta",
          pago_ids: realesNoZero.map((p) => p.id),
          property_id: first.property_id,
          contrato_id: first.contrato_id,
          mes: first.mes,
          anio: first.anio,
          motivo: `Suma de pagos reales (${suma.toFixed(2)}) excede la renta esperada (${rentaEsperada.toFixed(2)})`,
          detalle: {
            importes: realesNoZero.map(safeImporte),
            tipos: realesNoZero.map((p) => p.tipo_registro),
            renta_esperada: rentaEsperada,
            suma_real: suma,
          },
        });
      }
    }
  }

  summary.total =
    summary.duplicado_real.length +
    summary.historico_fiscal_coincide.length +
    summary.pago_cero_solidario.length +
    summary.excede_renta.length +
    summary.sin_contrato_id.length;

  // Sanity check: todos los pago_ids referenciados existen
  for (const lst of [
    summary.duplicado_real,
    summary.historico_fiscal_coincide,
    summary.pago_cero_solidario,
    summary.excede_renta,
    summary.sin_contrato_id,
  ]) {
    for (const it of lst) {
      for (const id of it.pago_ids) {
        if (!pagosById.has(id)) {
          throw new Error(`Reconciliación referencia un pago inexistente: ${id}`);
        }
      }
    }
  }

  return summary;
}

/** Contexto agregado sin PII para auditoría. */
export function buildReconciliacionAuditContext(summary: ReconciliacionSummary) {
  return {
    total: summary.total,
    duplicado_real: summary.duplicado_real.length,
    historico_fiscal_coincide: summary.historico_fiscal_coincide.length,
    pago_cero_solidario: summary.pago_cero_solidario.length,
    excede_renta: summary.excede_renta.length,
    sin_contrato_id: summary.sin_contrato_id.length,
  };
}
