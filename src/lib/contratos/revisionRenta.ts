/**
 * Revisión de renta — persistencia centralizada.
 *
 * Regla económica: las revisiones generan nuevos tramos en
 * `renta_actualizaciones` con `fecha_efectiva` en el futuro.
 * NUNCA modifican pagos existentes ni recalculan cobros históricos.
 * `finanzasEngine` / `fiscalPack` leen estos tramos automáticamente.
 */
import { supabase } from "@/integrations/supabase/client";
import { logContratoEvento } from "@/lib/contratoHistorialEvents";

export type TipoRevisionRenta = "ipc" | "personalizado" | "sin_cambio";

export interface RegistrarRevisionRentaInput {
  userId: string;
  contratoId: string;
  propertyId: string;
  tipo: TipoRevisionRenta;
  rentaActual: number;
  /** % a aplicar (ej. 3.1). Ignorado si tipo = "sin_cambio". */
  porcentaje?: number | null;
  /** YYYY-MM-DD. */
  fechaEfectiva: string;
  notas?: string;
}

export function calcularNuevaRenta(
  rentaActual: number,
  tipo: TipoRevisionRenta,
  porcentaje?: number | null,
): number {
  if (tipo === "sin_cambio") return rentaActual;
  const pct = Number(porcentaje) || 0;
  const nueva = rentaActual * (1 + pct / 100);
  return Math.round(nueva * 100) / 100;
}

/**
 * Inserta una entrada en `renta_actualizaciones` y deja trazabilidad
 * en `contrato_historial`. Lanza si falla la escritura principal.
 */
export async function registrarRevisionRenta(
  input: RegistrarRevisionRentaInput,
): Promise<{ importeNuevo: number }> {
  const { userId, contratoId, propertyId, tipo, rentaActual, porcentaje, fechaEfectiva, notas } = input;
  const importeNuevo = calcularNuevaRenta(rentaActual, tipo, porcentaje);

  const motivo: string =
    tipo === "ipc" ? "ipc" : tipo === "personalizado" ? "personalizado" : "sin_cambio";

  const { error } = await supabase.from("renta_actualizaciones").insert({
    user_id: userId,
    property_id: propertyId,
    contrato_id: contratoId,
    fecha_efectiva: fechaEfectiva,
    importe_anterior: rentaActual,
    importe_nuevo: importeNuevo,
    ipc_porcentaje: tipo === "sin_cambio" ? null : (porcentaje ?? null),
    motivo,
    notas: notas ?? null,
  } as any);
  if (error) throw error;

  await logContratoEvento({
    contratoId,
    propertyId,
    userId,
    tipo: "renta_historica_regularizada",
    titulo:
      tipo === "ipc"
        ? `Revisión de renta (IPC ${porcentaje ?? 0}%)`
        : tipo === "personalizado"
        ? `Revisión de renta (+${porcentaje ?? 0}%)`
        : "Revisión de renta sin cambio",
    detalle: `Renta anterior: ${rentaActual} € · Nueva renta: ${importeNuevo} € · Efectiva: ${fechaEfectiva}`,
    fechaEvento: fechaEfectiva,
    importeTotal: importeNuevo,
    metadata: {
      origen: "registro_manual",
      afecta_finanzas_actuales: tipo !== "sin_cambio",
      afecta_fiscalidad: tipo !== "sin_cambio",
      revision_tipo: tipo,
      porcentaje: tipo === "sin_cambio" ? null : porcentaje ?? null,
      importe_anterior: rentaActual,
      importe_nuevo: importeNuevo,
    },
  });

  return { importeNuevo };
}