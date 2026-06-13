import type { CrearActivoInput } from "./types";
import { insertPropertyRow } from "./raw";

/**
 * Single entry point for creating an Activo (currently writes to `properties`).
 *
 * Specialised tables (edificios, garajes, trasteros, habitaciones, locales,
 * oficinas, terrenos) are wired through this same function in a follow-up
 * commit; for now non-vivienda types are stored in `properties` with their
 * `tipo_inmueble` set and any extra fields passed through `input.extra`.
 */
export async function crearActivo(input: CrearActivoInput): Promise<{ id: string }> {
  if (!input.nombre_interno?.trim()) {
    throw new Error("El nombre interno del activo es obligatorio.");
  }

  const row = {
    tipo_inmueble: input.tipo,
    nombre_interno: input.nombre_interno.trim(),
    // Structured address
    tipo_via: input.direccion.tipo_via || null,
    nombre_via: input.direccion.nombre_via || null,
    numero: input.direccion.numero || null,
    portal: input.direccion.portal || null,
    escalera: input.direccion.escalera || null,
    bloque: input.direccion.bloque || null,
    urbanizacion: input.direccion.urbanizacion || null,
    parcela: input.direccion.parcela || null,
    planta: input.direccion.planta || null,
    puerta: input.direccion.puerta || null,
    codigo_postal: input.direccion.codigo_postal || null,
    ciudad: input.direccion.municipio || input.direccion.ciudad || null,
    provincia: input.direccion.provincia || null,
    pais: input.direccion.pais || "España",
    latitud: null as number | null,
    longitud: null as number | null,
    // Common fields
    superficie_m2: input.superficie_m2 ?? null,
    ano_construccion: input.ano_construccion ?? null,
    ano_compra: input.ano_compra ?? null,
    valor_compra: input.valor_compra ?? null,
    valor_estimado: input.valor_estimado ?? null,
    referencia_catastral: input.referencia_catastral ?? null,
    num_habitaciones: input.num_habitaciones ?? null,
    num_banos: input.num_banos ?? null,
    ...(input.extra ?? {}),
  } as Record<string, unknown>;

  try {
    const created = await insertPropertyRow(row);
    return { id: created.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === "object" && "message" in e)
        ? String((e as any).message)
        : String(e);
    const hint = e && typeof e === "object" && "hint" in e
      ? String((e as any).hint) : "";
    throw new Error(`No se pudo crear el activo: ${msg}${hint ? " — " + hint : ""}`);
  }
}