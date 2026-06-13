import type { CrearInquilinoInput } from "./types";
import { insertInquilinoRow } from "./raw";

/**
 * Single entry point for creating an Inquilino.
 * An Inquilino can exist without an Activo (property_id is optional).
 */
export async function crearInquilino(input: CrearInquilinoInput): Promise<{ id: string }> {
  if (!input.nombre?.trim()) {
    throw new Error("El nombre del inquilino es obligatorio.");
  }

  const nombreCompleto = [input.nombre.trim(), (input.apellidos || "").trim()]
    .filter(Boolean)
    .join(" ");

  const row = {
    nombre: nombreCompleto,
    dni: input.nif?.trim() || null,
    email: input.email?.trim() || null,
    telefono: input.telefono?.trim() || null,
    property_id: input.property_id ?? null,
    estado: "activo",
    notas: input.notas ?? null,
  } as Record<string, unknown>;

  try {
    const created = await insertInquilinoRow(row);
    return { id: created.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === "object" && "message" in e)
        ? String((e as any).message)
        : String(e);
    const hint = e && typeof e === "object" && "hint" in e
      ? String((e as any).hint) : "";
    throw new Error(`No se pudo crear el inquilino: ${msg}${hint ? " — " + hint : ""}`);
  }
}