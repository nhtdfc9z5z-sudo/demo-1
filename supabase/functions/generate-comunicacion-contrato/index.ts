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

    const payload = await req.json();
    const { tipo, datos, tipo_comunicacion, contexto, contrato, inmueble, inquilino, instrucciones_adicionales } = payload || {};

    let systemPrompt = "";
    let userPrompt = "";

    // ============================================================
    // NEW PATH: generic comunicacion legal (carta / burofax / email / whatsapp)
    // Activated when `contexto` or `tipo_comunicacion` is present.
    // Backward compatible: legacy callers using `tipo` + `datos` fall through.
    // ============================================================
    if (contexto || tipo_comunicacion) {
      const canal = (tipo_comunicacion || "carta") as "carta" | "burofax" | "email" | "whatsapp";
      const ctx = (contexto || "generico") as "revision_renta" | "renovacion" | "no_renovacion" | "generico";

      const propietarioBlock = datos?.propietario
        ? `Propietario: ${datos.propietario.nombre || ""} ${datos.propietario.apellidos || ""}, NIF: ${datos.propietario.nif || "N/A"}, Email: ${datos.propietario.email || "N/A"}, Teléfono: ${datos.propietario.telefono || "N/A"}, Domicilio: ${datos.propietario.domicilio || "N/A"}`
        : "Propietario: N/A";
      const inquilinoBlock = inquilino
        ? `Inquilino: ${inquilino.nombre || ""} ${inquilino.apellidos || ""}, DNI: ${inquilino.dni || "N/A"}, Email: ${inquilino.email || "N/A"}, Teléfono: ${inquilino.telefono || "N/A"}`
        : "Inquilino: N/A";
      const inmuebleBlock = inmueble
        ? `Inmueble: ${inmueble.nombre_interno || ""}, Dirección: ${inmueble.direccion_completa || "N/A"}, Ciudad: ${inmueble.ciudad || ""}, Provincia: ${inmueble.provincia || ""}, CP: ${inmueble.codigo_postal || ""}, Ref. Catastral: ${inmueble.referencia_catastral || ""}`
        : "Inmueble: N/A";
      const contratoBlock = contrato
        ? `Contrato: Título: ${contrato.titulo || ""}, Inicio: ${contrato.fecha_inicio || "N/A"}, Fin: ${contrato.fecha_fin || "N/A"}, Renta: ${contrato.renta_mensual || "N/A"} €/mes, Duración: ${contrato.duracion_anos || "N/A"} años, Prórroga: ${contrato.prorroga_anos || "N/A"} años, Preaviso (meses) en contrato: ${contrato.preaviso_meses ?? "N/A"}, Fianza: ${contrato.fianza_importe || "N/A"} €`
        : "Contrato: N/A";

      systemPrompt = `Eres un abogado especialista en derecho inmobiliario español (LAU 29/1994 y Código Civil). Redactas comunicaciones para el PROPIETARIO dirigidas al INQUILINO.

REGLAS ESTRICTAS:
- Tono formal, cordial y prudente. NUNCA agresivo, amenazante ni coercitivo.
- No admitir culpa del propietario ni hacer afirmaciones que puedan perjudicarle.
- Cita base legal SOLO cuando sea aplicable y verificable (LAU art. 18 actualización de renta; LAU art. 9-10 duración y prórrogas; LAU art. 27-28 resolución). Si dudas, usa lenguaje prudente y NO inventes artículos.
- Usa ÚNICAMENTE los datos proporcionados. Si un dato es "N/A" o falta, omite esa línea. NUNCA uses placeholders tipo "[Nombre]", "XXXX", "Tu nombre".
- Adapta el formato exactamente al canal solicitado:
  · carta / burofax → encabezado con remitente y destinatario, lugar y fecha, cuerpo, despedida, firma.
  · email → asunto en la primera línea ("Asunto: ...") + cuerpo en párrafos cortos + despedida cordial.
  · whatsapp → mensaje breve (máx ~6 líneas), sin encabezado formal, tono cercano pero correcto, sin emojis.
- Devuelve SOLO el texto listo para enviar, sin explicaciones meta ni notas.`;

      const dataBlock = `${propietarioBlock}\n${inquilinoBlock}\n${inmuebleBlock}\n${contratoBlock}`;
      const extras = instrucciones_adicionales ? `\nInstrucciones adicionales del propietario: ${instrucciones_adicionales}` : "";

      if (ctx === "revision_renta") {
        const r = datos || {};
        userPrompt = `Contexto: notificar al inquilino una revisión de renta.

${dataBlock}

Renta actual: ${r.renta_actual ?? "N/A"} €/mes
Tipo de revisión: ${r.tipo_revision || "ipc"} (ipc | personalizado | sin_cambio)
Porcentaje aplicado: ${r.porcentaje ?? 0}%
Nueva renta: ${r.nueva_renta ?? "N/A"} €/mes
Fecha efectiva: ${r.fecha_efectiva || "primer día del mes siguiente"}
Formato: ${canal}${extras}

Genera el texto. Si el tipo es "sin_cambio", redacta confirmando que la renta se mantiene este año, sin aplicar incremento.`;
      } else if (ctx === "renovacion") {
        const r = datos || {};
        userPrompt = `Contexto: confirmar al inquilino la renovación / prórroga del contrato.

${dataBlock}

Prórroga aplicada: ${r.prorroga_anos ?? contrato?.prorroga_anos ?? "N/A"} año(s)
Nueva fecha de finalización prevista: ${r.nueva_fecha_fin || "N/A"}
Formato: ${canal}${extras}

Tono positivo y agradecido por la continuidad. No impongas nuevas condiciones salvo que vengan en instrucciones_adicionales.`;
      } else if (ctx === "no_renovacion") {
        const r = datos || {};
        userPrompt = `Contexto: comunicar la voluntad de NO renovar el contrato al término de su vigencia.

${dataBlock}

Fecha de finalización del contrato: ${contrato?.fecha_fin || "N/A"}
Motivo (si lo aporta el propietario): ${r.motivo_no_renovacion || instrucciones_adicionales || "decisión del propietario, sin necesidad de motivar conforme a LAU"}
Formato: ${canal}${extras}

REGLA CRÍTICA: NUNCA menciones plazos de preaviso concretos en días o meses salvo que vengan expresamente en los datos del contrato (campo "Preaviso (meses) en contrato"). Si no existen datos suficientes, indica que se actuará conforme a lo dispuesto en el contrato y en la normativa aplicable, sin especificar cifras ni plazos concretos.

Menciona obligaciones recíprocas al término del contrato (devolución de llaves, estado de la vivienda, devolución de fianza) en términos generales. Tono respetuoso, sin reproches.`;
      } else {
        userPrompt = `Contexto: comunicación general propietario → inquilino.

${dataBlock}

Asunto / instrucciones del propietario: ${instrucciones_adicionales || "(no especificado)"}
Formato: ${canal}

Redacta de forma profesional, prudente y completa.`;
      }
    } else {
      // ====================== LEGACY PATH (unchanged) ======================
    const propietarioInfo = datos.propietario
      ? `Propietario: ${datos.propietario.nombre || ""} ${datos.propietario.apellidos || ""}, NIF: ${datos.propietario.nif || "N/A"}, Email: ${datos.propietario.email || "N/A"}, Teléfono: ${datos.propietario.telefono || "N/A"}, Domicilio: ${datos.propietario.domicilio || "N/A"}`
      : "";
    const inquilinoInfo = datos.inquilino
      ? `Inquilino: ${datos.inquilino.nombre || ""} ${datos.inquilino.apellidos || ""}, DNI: ${datos.inquilino.dni || "N/A"}, Email: ${datos.inquilino.email || "N/A"}, Teléfono: ${datos.inquilino.telefono || "N/A"}`
      : "";
    const viviendaInfo = datos.vivienda
      ? `Vivienda: ${datos.vivienda.nombre_interno || ""}, Dirección: ${datos.vivienda.direccion_completa || "N/A"}, Ciudad: ${datos.vivienda.ciudad || ""}, Provincia: ${datos.vivienda.provincia || ""}, CP: ${datos.vivienda.codigo_postal || ""}, Ref. Catastral: ${datos.vivienda.referencia_catastral || ""}`
      : "";
    const contratoInfo = datos.contrato
      ? `Contrato: Título: ${datos.contrato.titulo || ""}, Inicio: ${datos.contrato.fecha_inicio || "N/A"}, Fin: ${datos.contrato.fecha_fin || "N/A"}, Renta: ${datos.contrato.renta_mensual || "N/A"} €/mes, Duración: ${datos.contrato.duracion_anos || "N/A"} años, Prórroga: ${datos.contrato.prorroga_anos || "N/A"} años, Preaviso: ${datos.contrato.preaviso_meses || "N/A"} meses, Fianza: ${datos.contrato.fianza_importe || "N/A"} €, Depósito garantía: ${datos.contrato.deposito_garantia || "N/A"} €`
      : "";

    const commonContext = `${propietarioInfo}\n${inquilinoInfo}\n${viviendaInfo}\n${contratoInfo}`;

    if (tipo === "ipc") {
      systemPrompt = `Eres un abogado especialista en derecho inmobiliario español. Genera comunicaciones formales, respetuosas y legalmente correctas para propietarios de viviendas en alquiler. Usa un tono formal pero cordial. La carta debe estar lista para enviar, con fecha actual, datos del remitente y destinatario.

REGLA CRÍTICA: Usa ÚNICAMENTE los datos proporcionados. NUNCA inventes nombres, direcciones ni datos. NUNCA uses placeholders como "Tu nombre", "[Nombre]", "XXXX" ni similares. Si un dato no está disponible (aparece como "N/A"), simplemente omite esa línea o sección de la carta. La carta debe parecer completamente real y lista para enviar con los datos reales proporcionados.`;
      userPrompt = `Genera una carta formal de notificación de actualización de renta por IPC al inquilino con los siguientes datos:

${commonContext}

Renta actual: ${datos.renta_actual} €/mes
Porcentaje IPC aplicado: ${datos.ipc_porcentaje}%
Nueva renta: ${datos.nueva_renta} €/mes
Fecha efectiva del cambio: ${datos.fecha_efectiva || "primer día del mes siguiente"}
Motivo: Actualización anual conforme al IPC

La carta debe:
1. Ser formal y respetuosa
2. Citar la base legal (artículo 18 de la LAU)
3. Indicar claramente el importe antiguo y nuevo
4. Especificar desde cuándo es efectivo
5. Incluir datos de contacto del propietario
6. Tener formato de carta con fecha, encabezado, cuerpo y firma

Responde SOLO con el texto de la carta, sin explicaciones adicionales.`;
    } else if (tipo === "no_renovacion") {
      systemPrompt = `Eres un abogado especialista en derecho inmobiliario español. Genera comunicaciones formales según la Ley de Arrendamientos Urbanos (LAU) vigente. Las cartas deben ser legalmente válidas para servir como notificación fehaciente.

REGLA CRÍTICA: Usa ÚNICAMENTE los datos proporcionados. NUNCA inventes nombres, direcciones ni datos. NUNCA uses placeholders como "Tu nombre", "[Nombre]", "XXXX" ni similares. Si un dato no está disponible (aparece como "N/A"), simplemente omite esa línea o sección de la carta. La carta debe parecer completamente real y lista para enviar con los datos reales proporcionados.`;
      userPrompt = `Genera una carta formal de comunicación de no renovación del contrato de arrendamiento con los siguientes datos:

${commonContext}

Motivo: ${datos.motivo_no_renovacion || "El propietario ha decidido no renovar el contrato de arrendamiento."}

La carta debe:
1. Ser formal y respetuosa
2. Citar la base legal correspondiente de la LAU
3. Indicar claramente la fecha en que finaliza el contrato
4. Recordar los plazos de preaviso legales
5. Mencionar las obligaciones de ambas partes al finalizar (devolución de llaves, fianzas, estado de la vivienda)
6. Incluir información sobre la devolución de la fianza
7. Solicitar coordinación para la entrega de llaves
8. Tener formato de carta con fecha, encabezado, cuerpo y firma

Responde SOLO con el texto de la carta, sin explicaciones adicionales.`;
    } else if (tipo === "devolucion_llaves") {
      systemPrompt = `Eres un abogado especialista en derecho inmobiliario español. Genera documentos legales formales para el proceso de finalización de contratos de arrendamiento.

REGLA CRÍTICA: Usa ÚNICAMENTE los datos proporcionados. NUNCA inventes nombres, direcciones ni datos. NUNCA uses placeholders como "Tu nombre", "[Nombre]", "XXXX" ni similares. Si un dato no está disponible (aparece como "N/A"), simplemente omite esa línea o sección. El documento debe parecer completamente real y listo para usar con los datos reales proporcionados.`;
      userPrompt = `Genera un acta de devolución de llaves y entrega de vivienda con los siguientes datos:

${commonContext}

Fecha de entrega: ${datos.fecha_entrega || "A determinar"}

El documento debe incluir las siguientes secciones:
1. ENCABEZADO con datos de ambas partes y dirección de la vivienda
2. INVENTARIO DE LLAVES: tabla con columnas para tipo de llave (portal, buzón, garaje, trastero, puerta principal, habitaciones, etc.), cantidad y observaciones
3. ESTADO DE LA VIVIENDA: checklist para cada estancia (salón, cocina, baños, dormitorios, terraza/patio) con estado (bueno/regular/malo) y observaciones
4. LECTURA DE CONTADORES: campos para agua (m³), luz (kWh) y gas (m³) con números de contador
5. OBSERVACIONES GENERALES: espacio para notas
6. ACUERDO SOBRE FIANZA: estado de la fianza depositada (${datos.contrato?.fianza_importe || "N/A"} €), posibles deducciones y plazo de devolución
7. FIRMAS de ambas partes con fecha y lugar

El documento debe ser profesional, completo y legalmente válido.

Responde SOLO con el texto del documento, sin explicaciones adicionales.`;
    } else {
      throw new Error(`Tipo de comunicación no válido: ${tipo}`);
    }
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, inténtalo de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ texto: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
