/**
 * Renovación / no-renovación de contrato — persistencia centralizada.
 *
 * Reglas:
 * - "renovar" extiende `fecha_fin` y marca `renovacion_confirmada_at`.
 * - "no_renovar" cambia `estado` a "finaliza_pronto" pero NO toca fechas.
 * - Toda acción deja entrada en `contrato_historial`.
 * - Nada se persiste sin que el caller lo confirme explícitamente.
 */
import { supabase } from "@/integrations/supabase/client";
import { logContratoEvento } from "@/lib/contratoHistorialEvents";

export interface RenovarContratoInput {
  userId: string;
  contratoId: string;
  propertyId: string;
  fechaFinActual: string; // YYYY-MM-DD
  prorrogaAnos: number;
}

export function calcularNuevaFechaFin(fechaFinActual: string, prorrogaAnos: number): string {
  const [y, m, d] = fechaFinActual.split("-").map(Number);
  const nueva = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  nueva.setUTCFullYear(nueva.getUTCFullYear() + (prorrogaAnos || 0));
  return nueva.toISOString().slice(0, 10);
}

export async function confirmarRenovacion(input: RenovarContratoInput): Promise<{ nuevaFechaFin: string }> {
  const { userId, contratoId, propertyId, fechaFinActual, prorrogaAnos } = input;
  const nuevaFechaFin = calcularNuevaFechaFin(fechaFinActual, prorrogaAnos);
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("contratos_arrendamiento")
    .update({
      fecha_fin: nuevaFechaFin,
      renovacion_confirmada_at: nowIso,
      estado: "vigente",
    } as any)
    .eq("id", contratoId)
    .eq("user_id", userId);
  if (error) throw error;

  await logContratoEvento({
    contratoId,
    propertyId,
    userId,
    tipo: "renovacion",
    titulo: "Contrato renovado",
    detalle: `Prórroga de ${prorrogaAnos} año(s). Nueva fecha fin: ${nuevaFechaFin}.`,
    metadata: {
      origen: "registro_manual",
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: false,
      renovacion: { fecha_fin_anterior: fechaFinActual, fecha_fin_nueva: nuevaFechaFin, prorroga_anos: prorrogaAnos },
    },
  });

  return { nuevaFechaFin };
}

export interface NoRenovarInput {
  userId: string;
  contratoId: string;
  propertyId: string;
  fechaFinActual: string;
  motivo?: string;
}

export async function marcarNoRenovacion(input: NoRenovarInput): Promise<void> {
  const { userId, contratoId, propertyId, fechaFinActual, motivo } = input;

  const { error } = await supabase
    .from("contratos_arrendamiento")
    .update({ estado: "finaliza_pronto" } as any)
    .eq("id", contratoId)
    .eq("user_id", userId);
  if (error) throw error;

  await logContratoEvento({
    contratoId,
    propertyId,
    userId,
    tipo: "no_renovacion",
    titulo: "Contrato marcado como no renovable",
    detalle: motivo || `El contrato finalizará el ${fechaFinActual}.`,
    metadata: {
      origen: "registro_manual",
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: false,
      no_renovacion: { fecha_fin: fechaFinActual, motivo: motivo || null },
    },
  });
}