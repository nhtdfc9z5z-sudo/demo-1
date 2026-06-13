/**
 * Sprint 3.7 — Contrato como unidad económica única.
 *
 * Dado un (property_id, inquilino_id, mes, anio) resuelve qué contrato cubre
 * ese devengo. Es la única forma autorizada de obtener `contrato_id` antes
 * de un upsert en `pagos_renta` cuando el caller no lo conoce.
 *
 * Reglas:
 *  - El contrato debe ser del mismo `property_id`.
 *  - El inquilino debe figurar en `contrato_personas`.
 *  - El primer día del mes debe estar entre `fecha_inicio` (o null) y
 *    `fecha_fin` (o null).
 *  - Si hay 1 candidato → se devuelve. Si hay 0 → null. Si hay >1 → se
 *    elige el más reciente por `fecha_inicio DESC` y se audita.
 */

import { supabase } from "@/integrations/supabase/client";
import { captureAppError } from "@/lib/observability";

export async function resolverContratoIdParaPago(args: {
  propertyId: string;
  inquilinoId: string;
  mes: number;
  anio: number;
}): Promise<string | null> {
  const { propertyId, inquilinoId, mes, anio } = args;
  const devengo = `${anio}-${String(mes).padStart(2, "0")}-01`;

  // Buscar contratos del activo donde el inquilino figura como titular y
  // el periodo cae en su ventana de vigencia.
  const { data: links, error } = await supabase
    .from("contrato_personas")
    .select("contrato:contratos_arrendamiento!inner(id, fecha_inicio, fecha_fin, property_id)")
    .eq("inquilino_id", inquilinoId);

  if (error) {
    void captureAppError({
      event: "pagos_renta.resolver_contrato",
      message: "Fallo al resolver contrato_id para pago",
      severity: "error",
      audit: true,
      error,
      context: { mes, anio },
    });
    return null;
  }

  const candidatos = (links || [])
    .map((l: any) => l.contrato)
    .filter((c: any) => c && c.property_id === propertyId)
    .filter((c: any) => {
      const inicio = c.fecha_inicio ? new Date(c.fecha_inicio) : null;
      const fin = c.fecha_fin ? new Date(c.fecha_fin) : null;
      const d = new Date(devengo);
      // Fin del mes
      const finMes = new Date(anio, mes, 0);
      if (inicio && inicio > finMes) return false;
      if (fin && fin < d) return false;
      return true;
    });

  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0].id;

  // Ambigüedad: nos quedamos con el más reciente por fecha_inicio.
  const ordenados = [...candidatos].sort((a, b) => {
    const ai = a.fecha_inicio || "";
    const bi = b.fecha_inicio || "";
    return bi.localeCompare(ai);
  });
  void captureAppError({
    event: "pagos_renta.contrato_ambiguo",
    message: "Más de un contrato vigente para el devengo; se elige el más reciente",
    severity: "warning",
    audit: true,
    context: {
      mes, anio, property_id: propertyId, inquilino_id: inquilinoId,
      candidatos: candidatos.length,
    },
  });
  return ordenados[0].id;
}