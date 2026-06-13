import { supabase } from "@/integrations/supabase/client";

export const CATEGORIAS_GASTO_VALIDAS = [
  "ibi",
  "comunidad",
  "suministros",
  "seguro_vivienda",
  "seguro_impago",
  "reformas",
  "mantenimiento",
  "arreglos",
  "amortizacion",
  "compras",
  "honorarios",
  "otro",
] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO_VALIDAS)[number];

export interface CrearGastoInput {
  property_id: string;
  fecha: string; // YYYY-MM-DD — fecha operativa (tesorería)
  /** Fecha del documento (devengo fiscal). Si no se aporta, se usa `fecha`. */
  fecha_devengo?: string | null;
  importe: number;
  categoria: CategoriaGasto | string;
  proveedor?: string | null;
  concepto?: string | null;
  nif_proveedor?: string | null;
  /** ID del proveedor relacional (si se ha encontrado/creado). */
  proveedor_id?: string | null;
  /** Vínculo opcional a una factura formal (regla "un gasto en una sola tabla"). */
  factura_id?: string | null;
  /** Gasto compartido entre copropietarios. */
  gasto_compartido?: boolean;
  /** Porcentaje que asume el usuario (1–100). Solo se guarda el dato propio. */
  porcentaje_usuario?: number | null;
  /** Archivo opcional (PDF/imagen). Si se aporta se sube al bucket `facturas`. */
  archivo?: File | null;
  ocrProcesado?: boolean;
}

export interface CrearGastoResult {
  id: string;
  storage_path: string | null;
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

/**
 * Crea un gasto en `property_gastos` con validaciones de seguridad:
 * - user_id viene SIEMPRE de la sesión autenticada, nunca del input.
 * - property_id debe pertenecer al usuario autenticado.
 * - Archivo opcional se sube a `facturas/{user_id}/{gasto_id}/{filename}`.
 * - Si falla la subida del archivo, se elimina el gasto recién creado.
 */
export async function crearGasto(input: CrearGastoInput): Promise<CrearGastoResult> {
  // 1) Validaciones
  if (!input.property_id) throw new Error("Activo obligatorio");
  if (!input.fecha || !isValidIsoDate(input.fecha)) throw new Error("Fecha inválida");
  if (input.fecha_devengo != null && input.fecha_devengo !== "" && !isValidIsoDate(input.fecha_devengo)) {
    throw new Error("Fecha de devengo inválida");
  }
  if (typeof input.importe !== "number" || !(input.importe > 0)) {
    throw new Error("Importe debe ser mayor que 0");
  }
  if (!input.categoria) throw new Error("Categoría obligatoria");
  if (!CATEGORIAS_GASTO_VALIDAS.includes(input.categoria as CategoriaGasto)) {
    throw new Error("Categoría no válida");
  }
  if (input.gasto_compartido) {
    const p = Number(input.porcentaje_usuario);
    if (!(p > 0 && p <= 100)) {
      throw new Error("Porcentaje del usuario debe estar entre 1 y 100");
    }
  }

  // 2) Usuario autenticado
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("Sesión no válida");

  // 3) Verificar propiedad pertenece al usuario
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("id,user_id")
    .eq("id", input.property_id)
    .maybeSingle();
  if (propErr) throw new Error("No se pudo verificar el activo");
  if (!prop || prop.user_id !== userId) {
    throw new Error("El activo no pertenece al usuario autenticado");
  }

  // 4) Insertar gasto
  const insertRow = {
    user_id: userId,
    property_id: input.property_id,
    fecha: input.fecha,
    fecha_devengo: input.fecha_devengo || input.fecha,
    importe: input.importe,
    categoria: input.categoria,
    proveedor_id: input.proveedor_id || null,
    factura_id: input.factura_id || null,
    concepto: input.concepto?.trim() || null,
    notas: input.proveedor?.trim() || null,
    nif_proveedor: input.nif_proveedor?.trim() || null,
    ocr_procesado: !!input.ocrProcesado,
    recurrente: false,
    gasto_compartido: !!input.gasto_compartido,
    porcentaje_usuario: input.gasto_compartido ? Number(input.porcentaje_usuario) : null,
  } as Record<string, unknown>;

  const { data: gasto, error: insErr } = await supabase
    .from("property_gastos")
    .insert(insertRow as any)
    .select("id")
    .single();
  if (insErr || !gasto) {
    throw new Error(insErr?.message || "No se pudo crear el gasto");
  }
  const gastoId = (gasto as { id: string }).id;

  // 5) Subida archivo opcional
  let storagePath: string | null = null;
  if (input.archivo) {
    const safeName = input.archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${gastoId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("facturas")
      .upload(path, input.archivo, { contentType: input.archivo.type, upsert: false });
    if (upErr) {
      // rollback gasto
      await supabase.from("property_gastos").delete().eq("id", gastoId).eq("user_id", userId);
      throw new Error(`No se pudo subir el archivo: ${upErr.message}`);
    }
    storagePath = path;
    await supabase
      .from("property_gastos")
      .update({ storage_path: path } as any)
      .eq("id", gastoId)
      .eq("user_id", userId);

    // Registro ligero en property_documentos (categoría reservada `factura_gasto`)
    // sin duplicar el archivo: comparte `storage_path` y se elimina en cascada.
    try {
      await supabase.from("property_documentos").insert({
        user_id: userId,
        property_id: input.property_id,
        gasto_id: gastoId,
        categoria: "factura_gasto",
        nombre_archivo: input.archivo.name,
        storage_path: path,
        url: path,
      } as any);
    } catch {
      // No bloquea el flujo: el gasto y el archivo están ya guardados.
    }
  }

  return { id: gastoId, storage_path: storagePath };
}