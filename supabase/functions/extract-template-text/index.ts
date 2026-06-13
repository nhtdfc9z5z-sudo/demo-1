import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import mammoth from "https://esm.sh/mammoth@1.8.0";
import WordExtractor from "npm:word-extractor@1.0.4";
import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const base64ToBytes = (fileBase64: string) => {
  const binaryStr = atob(fileBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
};

const extractWordText = async (fileBase64: string, ext: string): Promise<string> => {
  const bytes = base64ToBytes(fileBase64);

  // 1) Try word-extractor first (.doc and .docx)
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(Buffer.from(bytes));
    const text = doc?.getBody?.() || "";
    if (text.trim()) return text;
  } catch (err) {
    console.error("word-extractor failed:", err);
  }

  // 2) Fallback for .docx with mammoth
  if (ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      const text = result.value || "";
      if (text.trim()) return text;
    } catch (err) {
      console.error("mammoth fallback failed:", err);
    }
  }

  throw new Error(
    ext === "doc"
      ? "No se pudo convertir el .doc automáticamente. Prueba a guardarlo como .docx desde Word y vuelve a subirlo."
      : "No se pudo extraer texto del documento Word."
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { fileBase64, mimeType, fileName } = await req.json();
    if (!fileBase64) throw new Error("No file data provided");

    const normalizedMime = (mimeType || "").toLowerCase();
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
    const isWord = ["doc", "docx"].includes(ext)
      || normalizedMime.includes("msword")
      || normalizedMime.includes("wordprocessingml");

    // Word docs -> extract text with dedicated parser
    if (isWord) {
      try {
        const rawText = await extractWordText(fileBase64, ext || "doc");

        // Normalize to clean markdown using AI (without changing legal content)
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: `Este es el texto extraído de una plantilla de contrato.
Devuélvelo en Markdown limpio preservando EXACTAMENTE el contenido legal:
- Mantén cláusulas, numeración y placeholders
- NO añadas ni elimines cláusulas
- NO resumas

Texto:
---
${rawText}
---

Devuelve solo el texto final.`,
              },
            ],
          }),
        });

        if (!response.ok) {
          // If formatting fails, return raw extracted text to avoid blocking user
          return new Response(JSON.stringify({ text: rawText }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || rawText;

        return new Response(JSON.stringify({ text }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (wordErr) {
        console.error("Word extraction error:", wordErr);
        return new Response(
          JSON.stringify({
            error: wordErr instanceof Error ? wordErr.message : "Error al procesar el archivo Word.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // PDF and images -> use multimodal model
    const supportedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (!supportedTypes.includes(normalizedMime)) {
      return new Response(
        JSON.stringify({
          error: `Formato no soportado (${normalizedMime || ext}). Usa PDF, Word (.doc/.docx) o imagen.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${fileBase64}` },
              },
              {
                type: "text",
                text: `Extrae el texto COMPLETO de este documento de plantilla de contrato.
Devuelve EXACTAMENTE el contenido del documento tal cual está escrito, preservando:
- Toda la estructura y formato (títulos, cláusulas, numeración)
- Todos los placeholders, campos vacíos, líneas en blanco (___), etc.
- Todo el texto legal y cláusulas

NO resumas, NO interpretes, NO añadas nada. Solo transcribe el contenido completo del documento en formato Markdown.
Si hay campos para rellenar, mantenlos como están (ej: "D./Dña. _______________", "[NOMBRE]", etc.)

Devuelve SOLO el texto del documento, sin comentarios ni explicaciones tuyas.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-template-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
