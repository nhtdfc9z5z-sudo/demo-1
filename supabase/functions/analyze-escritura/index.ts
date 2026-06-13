import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { imageBase64, mimeType, source } = await req.json();
    if (!imageBase64) throw new Error("No document data provided");

    const isContrato = source === "contrato";

    const systemPrompt = isContrato
      ? `Analiza este contrato de arrendamiento y extrae los datos del INMUEBLE para crear una ficha de vivienda.
Presta especial atención a:
- Dirección completa del inmueble: calle (sin número), número/portal, planta, puerta, código postal, ciudad, provincia
- Tipo de vivienda (piso, casa, estudio, ático, dúplex, chalet, adosado, local)
- Superficie en m²
- Número de habitaciones y baños si se mencionan
- Referencia catastral si aparece
- Año de construcción si se menciona
- Equipamiento: ascensor, terraza, patio, balcón, calefacción, aire acondicionado
- Cuota de comunidad
- Quién paga cada suministro
- Datos de los arrendatarios (nombre, DNI, teléfono, email) - pueden ser varios
- Renta mensual, fianza, depósito de garantía
- Fechas de inicio y fin del contrato

IMPORTANTE: Los tratamientos de cortesía como "Don", "Doña", "D.", "Dña.", "D.ª", "Mr.", "Mrs.", "Sr.", "Sra." NO son parte del nombre. Nunca los incluyas en los campos de nombre. Extrae solo el nombre real.`
      : `Analiza estas escrituras de propiedad / nota simple y extrae los datos del INMUEBLE para crear una ficha de vivienda.
Presta especial atención a:
- Dirección completa del inmueble: calle (sin número), número/portal, planta, puerta, código postal, ciudad, provincia
- Tipo de vivienda (piso, casa, estudio, ático, dúplex, chalet, adosado, local)
- Superficie construida y útil en m²
- Número de habitaciones y baños si se mencionan
- Referencia catastral
- Año de construcción
- Valor de compra / precio de adquisición
- Año de compra / fecha de la escritura
- Datos registrales (tomo, libro, folio, finca)
- Si tiene garaje, trastero, terraza, patio
- Descripción de la finca`;

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
                image_url: { url: `data:${mimeType || "application/pdf"};base64,${imageBase64}` },
              },
              { type: "text", text: systemPrompt },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_property_data",
              description: "Extrae los datos del inmueble del documento para crear una ficha de vivienda",
              parameters: {
                type: "object",
                properties: {
                  nombre_interno: { type: "string", description: "Nombre descriptivo corto para la vivienda (ej: 'Piso Gran Vía', 'Casa Playa')" },
                  direccion_completa: { type: "string", description: "Nombre de la calle CON número (ej: 'Calle Gran Vía 12')" },
                  numero_portal: { type: "string", description: "Número del portal si es diferente al de la calle" },
                  planta: { type: "string", description: "Planta (ej: 3º, Bajo, Ático)" },
                  puerta: { type: "string", description: "Puerta/letra (ej: A, B, Izq, Dcha)" },
                  codigo_postal: { type: "string", description: "Código postal (5 dígitos)" },
                  ciudad: { type: "string", description: "Ciudad o municipio" },
                  provincia: { type: "string", description: "Provincia" },
                  tipo_vivienda: { type: "string", enum: ["piso", "casa", "estudio", "atico", "duplex", "chalet", "adosado", "local"], description: "Tipo de vivienda" },
                  superficie_m2: { type: "number", description: "Superficie en metros cuadrados (preferir superficie útil)" },
                  num_habitaciones: { type: "integer", description: "Número de habitaciones" },
                  num_banos: { type: "integer", description: "Número de baños" },
                  referencia_catastral: { type: "string", description: "Referencia catastral completa (20 caracteres)" },
                  ano_construccion: { type: "integer", description: "Año de construcción" },
                  tiene_ascensor: { type: "boolean" },
                  tiene_terraza: { type: "boolean" },
                  tiene_patio: { type: "boolean" },
                  tiene_balcon: { type: "boolean" },
                  tiene_calefaccion: { type: "boolean" },
                  tipo_calefaccion: { type: "string" },
                  tiene_aire_acondicionado: { type: "boolean" },
                  cuota_comunidad: { type: "number", description: "Cuota mensual de comunidad en euros" },
                  valor_compra: { type: "number", description: "Precio de compra/adquisición en euros" },
                  ano_compra: { type: "integer", description: "Año de compra" },
                  // Contract-specific fields
                  renta_mensual: { type: "number", description: "Renta mensual del contrato" },
                  fianza_importe: { type: "number", description: "Importe de la fianza legal" },
                  deposito_garantia: { type: "number", description: "Depósito de garantía adicional" },
                  fecha_inicio_contrato: { type: "string", description: "Fecha inicio contrato YYYY-MM-DD" },
                  fecha_fin_contrato: { type: "string", description: "Fecha fin contrato YYYY-MM-DD" },
                  agua_paga_inquilino: { type: "boolean" },
                  luz_paga_inquilino: { type: "boolean" },
                  gas_paga_inquilino: { type: "boolean" },
                  internet_paga_inquilino: { type: "boolean" },
                  ibi_paga_inquilino: { type: "boolean" },
                  basuras_paga_inquilino: { type: "boolean" },
                  arrendatarios: {
                    type: "array",
                    description: "Lista de arrendatarios/inquilinos del contrato",
                    items: {
                      type: "object",
                      properties: {
                        nombre: { type: "string" },
                        nif: { type: "string" },
                        telefono: { type: "string" },
                        email: { type: "string" },
                      },
                      required: ["nombre"],
                    },
                  },
                  otros_datos: { type: "string", description: "Cualquier otra información relevante no cubierta por los campos anteriores" },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_property_data" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No se pudo analizar el documento");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-escritura error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
