import { supabase } from "@/integrations/supabase/client";

/**
 * Eventos económicos de trazabilidad para `contrato_historial`.
 *
 * Regla de oro: el historial NO calcula finanzas, sólo documenta.
 * Toda la lógica económica vive en `pagos_renta` + `finanzasEngine`.
 */
export type HistorialEconomicoTipo =
  | "historico_economico_reconstruido"
  | "renta_historica_regularizada"
  | "pago_pendiente_historico"
  | "pago_real_registrado"
  | "renovacion"
  | "no_renovacion";

export interface HistorialEconomicoMeta {
  origen?:
    | "alta_guiada"
    | "reconstruccion_historica"
    | "registro_manual"
    | "importacion"
    | "banco"
    | "otro";
  meses_afectados?: Array<{ mes: number; anio: number; importe?: number | null }>;
  numero_meses?: number;
  importe_total?: number | null;
  afecta_finanzas_actuales?: boolean;
  afecta_fiscalidad?: boolean;
  actor_id?: string | null;
  pago_id?: string | null;
  // Free-form extras
  [k: string]: unknown;
}

export interface LogContratoEventoInput {
  contratoId: string;
  propertyId: string;
  userId: string;
  tipo: HistorialEconomicoTipo;
  titulo: string;
  detalle?: string;
  fechaEvento?: string; // YYYY-MM-DD
  importeTotal?: number | null;
  metadata?: HistorialEconomicoMeta;
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/** Resumen legible de un rango de meses para mostrar en UI. */
export function describeMeses(meses: Array<{ mes: number; anio: number }>): string {
  if (!meses.length) return "";
  const sorted = [...meses].sort((a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (sorted.length === 1) return `${MESES[first.mes - 1]} ${first.anio}`;
  return `${MESES[first.mes - 1]} ${first.anio} → ${MESES[last.mes - 1]} ${last.anio} (${sorted.length} meses)`;
}

/**
 * Inserta un evento económico en `contrato_historial`.
 * Documental: no recalcula nada y no falla la operación principal si hay error.
 */
export async function logContratoEvento(input: LogContratoEventoInput): Promise<void> {
  const meta: HistorialEconomicoMeta = {
    afecta_finanzas_actuales: false,
    afecta_fiscalidad: false,
    ...(input.metadata || {}),
  };
  if (meta.meses_afectados && meta.numero_meses == null) {
    meta.numero_meses = meta.meses_afectados.length;
  }
  if (input.importeTotal != null && meta.importe_total == null) {
    meta.importe_total = input.importeTotal;
  }

  const detalle =
    input.detalle ??
    (meta.meses_afectados ? describeMeses(meta.meses_afectados) : undefined);

  try {
    await supabase.from("contrato_historial").insert({
      user_id: input.userId,
      contrato_id: input.contratoId,
      property_id: input.propertyId,
      tipo: input.tipo,
      titulo: input.titulo,
      detalle: detalle ?? null,
      fecha_evento: input.fechaEvento ?? new Date().toISOString().slice(0, 10),
      importe_nuevo: input.importeTotal ?? null,
      metadata: meta,
    } as any);
    // Notifica a cualquier componente abierto (HistorialContratoSection)
    // para que recargue su lista sin esperar a una navegación.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("contrato-historial-changed", {
        detail: { contratoId: input.contratoId, propertyId: input.propertyId, tipo: input.tipo },
      }));
    }
  } catch (err) {
    // No bloqueamos el flujo principal por un fallo de trazabilidad.
    console.error("[contrato_historial] log error:", err);
  }
}

/** Etiquetas UI por tipo de evento económico. */
export const HISTORIAL_ECONOMICO_LABEL: Record<HistorialEconomicoTipo, string> = {
  historico_economico_reconstruido: "Histórico económico reconstruido",
  renta_historica_regularizada: "Renta histórica regularizada",
  pago_pendiente_historico: "Pago pendiente histórico",
  pago_real_registrado: "Cobro real registrado",
  renovacion: "Renovación de contrato",
  no_renovacion: "Contrato no renovable",
};