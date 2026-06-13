import type { CrearContratoInput } from "./types";
import { insertContratoRow } from "./raw";
import { supabase } from "@/integrations/supabase/client";
import { calcularFechaFin } from "@/lib/contratos/duracion";

/**
 * Single entry point for creating a Contrato.
 * Creates the contract row plus contrato_personas rows for each tenant.
 */
export async function crearContrato(input: CrearContratoInput): Promise<{ id: string }> {
  if (!input.property_id) throw new Error("El contrato requiere un activo.");
  if (!input.inquilino_ids?.length) throw new Error("El contrato requiere al menos un inquilino.");
  if (!input.fecha_inicio) throw new Error("La fecha de inicio es obligatoria.");
  if (!Number.isFinite(input.renta_mensual) || input.renta_mensual <= 0) {
    throw new Error("La renta mensual debe ser mayor que 0.");
  }

  // Si hay duración explícita y no fecha_fin, la calculamos.
  let fechaFinEfectiva: string | null = input.fecha_fin ?? null;
  let duracionAnosEfectiva: number | null = null;
  if (!fechaFinEfectiva && input.duracion_n && input.duracion_unidad) {
    fechaFinEfectiva = calcularFechaFin(
      input.fecha_inicio,
      input.duracion_n,
      input.duracion_unidad,
    );
  }
  if (input.duracion_n && input.duracion_unidad === "anos") {
    duracionAnosEfectiva = input.duracion_n;
  }

  const contratoRow = {
    property_id: input.property_id,
    titulo: input.titulo?.trim() || "Contrato de arrendamiento",
    fecha_inicio: input.fecha_inicio,
    fecha_fin: fechaFinEfectiva,
    duracion_anos: duracionAnosEfectiva,
    renta_mensual: input.renta_mensual,
    fianza_importe: input.fianza_importe ?? null,
    deposito_garantia: input.deposito_garantia ?? null,
    archivo_url: input.pdf_url ?? null,
    estado: "vigente",
    notas: input.notas ?? null,
    fecha_inicio_control: input.fecha_inicio_control ?? null,
    tipo_contrato: input.tipo_contrato ?? "habitual",
    tipo_contrato_detalle: input.tipo_contrato_detalle ?? {},
    // Sincronización mínima con `modalidad_alquiler`: si el contrato es
    // por habitaciones, lo propagamos para que el motor económico
    // (pagosDedupe / proración / auditoría) lo trate como hoy.
    modalidad_alquiler: input.tipo_contrato === "habitaciones" ? "habitaciones" : "completo",
  } as Record<string, unknown>;

  try {
    const created = await insertContratoRow(contratoRow, {
      vincularInquilinos: input.inquilino_ids,
    });

    // Tramo histórico de renta: la renta inicial del contrato se mantuvo
    // hasta `fecha_efectiva`, y desde esa fecha rige `renta_mensual` actual.
    // Esto evita que la reconstrucción histórica aplique la renta actual a
    // meses antiguos (que generaría deuda ficticia).
    if (input.tramo_renta_inicial) {
      const t = input.tramo_renta_inicial;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: tErr } = await supabase
          .from("renta_actualizaciones")
          .insert({
            user_id: user.id,
            property_id: input.property_id,
            contrato_id: created.id,
            fecha_efectiva: t.fecha_efectiva,
            importe_anterior: t.importe_anterior,
            importe_nuevo: t.importe_nuevo,
            motivo: t.motivo ?? "alta_guiada",
            notas: t.notas ?? null,
          } as never);
        if (tErr) {
          // No abortamos la creación del contrato por esto; la renta vigente
          // ya está guardada en `renta_mensual` y el motor seguirá funcionando.
          console.error("No se pudo crear tramo de renta inicial:", tErr);
        }
      }
    }

    return { id: created.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === "object" && "message" in e)
        ? String((e as any).message)
        : String(e);
    const hint = e && typeof e === "object" && "hint" in e
      ? String((e as any).hint) : "";
    throw new Error(`No se pudo crear el contrato: ${msg}${hint ? " — " + hint : ""}`);
  }
}