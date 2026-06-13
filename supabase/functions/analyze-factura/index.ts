import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Seguridad: verificación JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const userId = userData.user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const { imageBase64, mimeType, storage_path } = body as {
      imageBase64?: string; mimeType?: string; storage_path?: string;
    };

    // --- Seguridad: verificación de propiedad del archivo si llega storage_path ---
    if (storage_path !== undefined) {
      const expectedPrefix = `facturas/${userId}/`;
      if (typeof storage_path !== "string" || !storage_path.startsWith(expectedPrefix)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image data provided" }), { status: 400, headers: jsonHeaders });
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
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
              },
              {
                type: "text",
                text: `Analiza esta factura y extrae todos los datos que puedas encontrar: emisor, receptor, importes, fechas, etc.`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_factura",
              description: "Extrae los datos estructurados de la factura",
              parameters: {
                type: "object",
                properties: {
                  factura_emisor_nombre: { type: "string", description: "Nombre o razón social del emisor" },
                  factura_emisor_nif: { type: "string", description: "CIF/NIF del emisor" },
                  factura_receptor_nombre: { type: "string", description: "Nombre o razón social del receptor" },
                  factura_receptor_nif: { type: "string", description: "CIF/NIF del receptor" },
                  factura_numero: { type: "string", description: "Número de factura" },
                  factura_fecha: { type: "string", description: "Fecha de la factura (YYYY-MM-DD)" },
                  factura_base_imponible: { type: "number", description: "Base imponible" },
                  factura_iva_porcentaje: { type: "number", description: "Porcentaje de IVA" },
                  factura_cuota_iva: { type: "number", description: "Cuota de IVA" },
                  factura_total: { type: "number", description: "Total factura" },
                  factura_concepto: { type: "string", description: "Concepto principal de la factura en una frase corta" },
                  factura_detalle_lineas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Líneas descriptivas del detalle (conceptos breves, sin importes). Vacío si no aplica.",
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_factura" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      // No incluir el body en logs (puede contener datos sensibles del análisis).
      console.error("AI gateway error status:", response.status);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." }), {
          status: 429, headers: jsonHeaders,
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402, headers: jsonHeaders,
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No se pudo analizar la factura");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: jsonHeaders,
    });
  } catch (e) {
    // Log técnico mínimo, sin payload ni datos extraídos.
    console.error("analyze-factura error:", e instanceof Error ? e.message : "unknown");
    return new Response(JSON.stringify({ error: "Error procesando la factura" }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
