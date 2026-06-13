import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { property, portal } = await req.json();

    if (!property || !portal) {
      return new Response(
        JSON.stringify({ success: false, error: 'property and portal are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const portalInstructions: Record<string, string> = {
      idealista: `Genera un anuncio optimizado para Idealista. Usa un título conciso (máx 60 caracteres), una descripción atractiva y profesional (máx 1500 caracteres). Destaca ubicación, características clave y estado. No incluyas precio en el título.`,
      fotocasa: `Genera un anuncio optimizado para Fotocasa. Título llamativo (máx 80 caracteres), descripción detallada (máx 2000 caracteres). Enfócate en el estilo de vida y comodidades del barrio.`,
      milanuncios: `Genera un anuncio para Milanuncios. Título directo con zona y tipo de vivienda (máx 50 caracteres). Descripción concisa y práctica (máx 1000 caracteres). Estilo informal pero profesional.`,
      wallapop: `Genera un anuncio para Wallapop. Título corto y directo (máx 40 caracteres). Descripción breve y con emojis moderados (máx 800 caracteres). Estilo cercano y moderno.`,
      pisos_com: `Genera un anuncio para Pisos.com. Título profesional (máx 70 caracteres). Descripción completa (máx 1800 caracteres) incluyendo todos los detalles técnicos disponibles.`,
      generico: `Genera un anuncio genérico copiable para cualquier portal inmobiliario. Título versátil (máx 80 caracteres). Descripción completa y profesional (máx 2000 caracteres).`,
    };

    const instruction = portalInstructions[portal] || portalInstructions.generico;

    const propertyDetails = [
      property.nombre_interno && `Nombre: ${property.nombre_interno}`,
      property.tipo_vivienda && `Tipo: ${property.tipo_vivienda}`,
      property.direccion_completa && `Dirección: ${property.direccion_completa}`,
      property.ciudad && `Ciudad: ${property.ciudad}`,
      property.provincia && `Provincia: ${property.provincia}`,
      property.codigo_postal && `CP: ${property.codigo_postal}`,
      property.superficie_m2 && `Superficie: ${property.superficie_m2} m²`,
      property.num_habitaciones && `Habitaciones: ${property.num_habitaciones}`,
      property.num_banos && `Baños: ${property.num_banos}`,
      property.tiene_ascensor && `Ascensor: Sí`,
      property.tiene_terraza && `Terraza: Sí`,
      property.tiene_balcon && `Balcón: Sí`,
      property.tiene_patio && `Patio: Sí`,
      property.tiene_aire_acondicionado && `Aire acondicionado: Sí (${property.tipo_aire_acondicionado || ''})`,
      property.tiene_calefaccion && `Calefacción: Sí (${property.tipo_calefaccion || ''})`,
      property.calificacion_energetica && `Certificado energético: ${property.calificacion_energetica}`,
      property.planta && `Planta: ${property.planta}`,
      property.tipo_suelos && `Suelos: ${property.tipo_suelos}`,
      property.estado_general && `Estado: ${property.estado_general}`,
      property.ano_construccion && `Año construcción: ${property.ano_construccion}`,
      property.urbanizacion && `Urbanización: ${property.urbanizacion}`,
    ].filter(Boolean).join('\n');

    const prompt = `${instruction}

Datos de la vivienda:
${propertyDetails}

IMPORTANTE:
- NO inventes datos que no estén proporcionados
- Responde SOLO en formato JSON con esta estructura exacta:
{
  "titulo": "...",
  "descripcion": "...",
  "caracteristicas_destacadas": ["...", "...", "..."]
}
- Las características destacadas son 3-5 puntos clave en formato bullet
- Escribe en español
- No incluyas el precio en el anuncio`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Eres un experto en marketing inmobiliario en España. Generas anuncios profesionales, atractivos y optimizados para cada portal.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `AI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo generar el anuncio. Inténtalo de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating ad:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
