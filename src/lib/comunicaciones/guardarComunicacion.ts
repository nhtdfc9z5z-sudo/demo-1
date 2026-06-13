import { supabase } from "@/integrations/supabase/client";

/**
 * Único punto de entrada para persistir una comunicación legal generada por IA.
 * - Sube el texto como archivo .txt al bucket `documentos`.
 * - Inserta el registro en `documentos` con categoría "comunicacion".
 * - Vincula opcionalmente al contrato (y al inmueble) vía `documento_vinculos`.
 *
 * NO se llama desde componentes vía supabase.from() directamente: este es el
 * único helper autorizado para escribir comunicaciones.
 */

export type ComunicacionCanal = "carta" | "burofax" | "email" | "whatsapp";
export type ComunicacionContexto =
  | "revision_renta"
  | "renovacion"
  | "no_renovacion"
  | "generico";

export interface GuardarComunicacionInput {
  userId: string;
  contratoId?: string | null;
  propertyId?: string | null;
  canal: ComunicacionCanal;
  contexto: ComunicacionContexto;
  texto: string;
  titulo?: string;
}

function sanitize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "comunicacion";
}

function defaultTitulo(canal: ComunicacionCanal, contexto: ComunicacionContexto): string {
  const ctxLabel: Record<ComunicacionContexto, string> = {
    revision_renta: "Revisión de renta",
    renovacion: "Renovación de contrato",
    no_renovacion: "No renovación de contrato",
    generico: "Comunicación",
  };
  const canalLabel: Record<ComunicacionCanal, string> = {
    carta: "Carta",
    burofax: "Burofax",
    email: "Email",
    whatsapp: "WhatsApp",
  };
  return `${canalLabel[canal]} - ${ctxLabel[contexto]}`;
}

export async function guardarComunicacion(input: GuardarComunicacionInput): Promise<{ id: string }> {
  if (!input.userId) throw new Error("userId requerido");
  if (!input.texto || !input.texto.trim()) throw new Error("texto vacío");

  const titulo = input.titulo?.trim() || defaultTitulo(input.canal, input.contexto);
  const filename = sanitize(`${titulo}-${new Date().toISOString().slice(0, 10)}.txt`);
  const path = `${input.userId}/comunicaciones/${Date.now()}-${filename}`;

  const blob = new Blob([input.texto], { type: "text/plain;charset=utf-8" });

  const { error: upErr } = await supabase.storage
    .from("documentos")
    .upload(path, blob, { contentType: "text/plain;charset=utf-8", upsert: false });
  if (upErr) throw upErr;

  const { data: doc, error: docErr } = await (supabase as any)
    .from("documentos")
    .insert({
      user_id: input.userId,
      nombre: `${titulo}.txt`,
      categoria: "comunicacion",
      mime_type: "text/plain",
      size_bytes: blob.size,
      bucket: "documentos",
      storage_path: path,
      origen_tipo: "comunicacion_legal",
      origen_id: input.contratoId || null,
      ocr_status: "skipped",
      notas: `Canal: ${input.canal} · Contexto: ${input.contexto}`,
    })
    .select("id")
    .single();
  if (docErr) throw docErr;

  const vinculos: Array<{ entidad_tipo: string; entidad_id: string }> = [];
  if (input.contratoId) vinculos.push({ entidad_tipo: "contrato", entidad_id: input.contratoId });
  if (input.propertyId) vinculos.push({ entidad_tipo: "activo", entidad_id: input.propertyId });

  if (vinculos.length > 0) {
    const { error: vErr } = await (supabase as any).from("documento_vinculos").insert(
      vinculos.map((v) => ({
        documento_id: doc.id,
        user_id: input.userId,
        entidad_tipo: v.entidad_tipo,
        entidad_id: v.entidad_id,
      })),
    );
    if (vErr) throw vErr;
  }

  return { id: doc.id as string };
}