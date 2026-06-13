import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Sprint 4.1 — OCR base.
// Recibe { documento_id } y JWT del usuario, descarga el archivo desde el
// bucket indicado en la fila `documentos`, lo manda a Gemini Vision vía
// Lovable AI Gateway y guarda `ocr_text` + estado. No extrae campos de
// negocio. No modifica entidades. Sólo texto plano + indexación.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORTED_IMAGE = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const SUPPORTED_PDF = new Set(["application/pdf"]);
const OCR_ENGINE = "google/gemini-2.5-flash";
const OCR_VERSION = "1";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ error: "Supabase env missing" }, 500);
  }
  if (!LOVABLE_API_KEY) {
    return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
  }

  let documentoId: string;
  try {
    const body = await req.json();
    documentoId = String(body?.documento_id || "").trim();
    if (!documentoId) throw new Error("documento_id requerido");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "bad request" }, 400);
  }

  // Cliente autenticado con JWT del usuario para validar ownership por RLS.
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Leer la fila con el JWT del usuario (RLS aplica)
  const { data: doc, error: selErr } = await userClient
    .from("documentos")
    .select("id, user_id, bucket, storage_path, mime_type, ocr_status")
    .eq("id", documentoId)
    .maybeSingle();

  if (selErr) return json({ error: selErr.message }, 403);
  if (!doc) return json({ error: "Documento no encontrado" }, 404);

  const mime = (doc.mime_type || "").toLowerCase();
  const isImage = SUPPORTED_IMAGE.has(mime);
  const isPdf = SUPPORTED_PDF.has(mime);

  if (!isImage && !isPdf) {
    await admin
      .from("documentos")
      .update({
        ocr_status: "skipped",
        ocr_error: `Tipo no soportado para OCR: ${mime || "desconocido"}`,
        ocr_engine: OCR_ENGINE,
        ocr_version: OCR_VERSION,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("id", documentoId);
    return json({ ok: true, status: "skipped" });
  }

  // 2) Marcar procesando (service role para evitar trigger races)
  await admin
    .from("documentos")
    .update({ ocr_status: "processing", ocr_error: null })
    .eq("id", documentoId);

  try {
    // 3) Descargar archivo del bucket con service role
    const { data: file, error: dlErr } = await admin.storage
      .from(doc.bucket)
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message || "No se pudo descargar el archivo");

    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(`Archivo demasiado grande para OCR (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB > 20 MB)`);
    }
    const b64 = toBase64(buf);

    // 4) Llamada a Lovable AI Gateway (Gemini Vision)
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OCR_ENGINE,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
              {
                type: "text",
                text:
                  "Transcribe íntegramente el texto visible de este documento en su idioma original. " +
                  "No resumas, no traduzcas, no interpretes. Mantén saltos de línea cuando exista " +
                  "estructura clara (párrafos, tablas, listas). Si no hay texto legible, responde " +
                  "literalmente: SIN_TEXTO.",
              },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) throw new Error("Rate limit en el motor OCR. Reintenta en unos segundos.");
      if (aiResp.status === 402) throw new Error("Sin créditos en Lovable AI. Recarga el workspace.");
      throw new Error(`AI gateway ${aiResp.status}: ${txt.slice(0, 300)}`);
    }

    const result = await aiResp.json();
    const raw: string = result?.choices?.[0]?.message?.content ?? "";
    const text = raw.trim();
    const finalText = text && text !== "SIN_TEXTO" ? text : "";

    await admin
      .from("documentos")
      .update({
        ocr_status: "ok",
        ocr_text: finalText,
        ocr_error: null,
        ocr_engine: OCR_ENGINE,
        ocr_version: OCR_VERSION,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("id", documentoId);

    return json({ ok: true, status: "ok", chars: finalText.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("ocr-documento error:", documentoId, msg);
    await admin
      .from("documentos")
      .update({
        ocr_status: "error",
        ocr_error: msg.slice(0, 500),
        ocr_engine: OCR_ENGINE,
        ocr_version: OCR_VERSION,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("id", documentoId);
    return json({ ok: false, status: "error", error: msg }, 200);
  }
});