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

    const { tipoContrato, propietario, inquilino, inquilinos, propiedad, condiciones, inventario, plantilla, avalistas } = await req.json();

    // Build tenant list: support both single `inquilino` and multiple `inquilinos`
    const tenantList: { nombre: string; dni: string; email?: string; telefono?: string }[] = [];
    if (inquilinos && Array.isArray(inquilinos) && inquilinos.length > 0) {
      tenantList.push(...inquilinos);
    }
    if (inquilino) {
      const alreadyIncluded = tenantList.some(t => t.nombre === inquilino.nombre && t.dni === inquilino.dni);
      if (!alreadyIncluded) {
        tenantList.unshift(inquilino);
      }
    }

    const tipoDescripcion: Record<string, string> = {
      larga_duracion: "contrato de arrendamiento de vivienda habitual de larga duración conforme a la LAU",
      vacacional: "contrato de arrendamiento de uso turístico/vacacional",
      habitacion: "contrato de arrendamiento de habitación en vivienda compartida",
      explotacion: "contrato de cesión/explotación de inmueble para uso distinto de vivienda",
    };

    let inventarioSection = "";
    if (inventario && Array.isArray(inventario) && inventario.length > 0) {
      inventarioSection = `\n\nINVENTARIO DE ENSERES (incluir como anexo al contrato):\n`;
      inventario.forEach((item: { nombre: string; marca?: string; caracteristicas?: string }, idx: number) => {
        inventarioSection += `${idx + 1}. ${item.nombre}`;
        if (item.marca) inventarioSection += ` — Marca/Modelo: ${item.marca}`;
        if (item.caracteristicas) inventarioSection += ` — ${item.caracteristicas}`;
        inventarioSection += `\n`;
      });
      inventarioSection += `\nEl contrato DEBE incluir una cláusula de inventario que haga referencia a este anexo.`;
    }

    // Build tenant data section
    let tenantSection = "";
    if (tenantList.length === 1) {
      const t = tenantList[0];
      tenantSection = `DATOS DEL ARRENDATARIO (INQUILINO):
- Nombre: ${t.nombre || "[NOMBRE ARRENDATARIO]"}
- DNI/NIE: ${t.dni || "[DNI/NIE ARRENDATARIO]"}
- Email: ${t.email || "[EMAIL]"}
- Teléfono: ${t.telefono || "[TELÉFONO]"}`;
    } else if (tenantList.length > 1) {
      tenantSection = `DATOS DE LOS ARRENDATARIOS (${tenantList.length} INQUILINOS, responsabilidad solidaria):\n\n`;
      tenantList.forEach((t, idx) => {
        tenantSection += `ARRENDATARIO ${idx + 1}:
- Nombre: ${t.nombre || "[NOMBRE ARRENDATARIO " + (idx + 1) + "]"}
- DNI/NIE: ${t.dni || "[DNI/NIE ARRENDATARIO " + (idx + 1) + "]"}
- Email: ${t.email || "[EMAIL]"}
- Teléfono: ${t.telefono || "[TELÉFONO]"}
`;
      });
      tenantSection += `\nIncluir cláusula de responsabilidad solidaria.`;
    }

    // Build avalistas section
    let avalistasSection = "";
    if (avalistas && Array.isArray(avalistas) && avalistas.length > 0) {
      avalistasSection = `\n\nDATOS DEL/LOS AVALISTA(S) (FIADOR/ES):\n\n`;
      avalistas.forEach((a: { nombre: string; dni: string; email?: string; telefono?: string }, idx: number) => {
        avalistasSection += `AVALISTA ${avalistas.length > 1 ? (idx + 1) + "" : ""}:
- Nombre: ${a.nombre || "[NOMBRE AVALISTA]"}
- DNI/NIE: ${a.dni || "[DNI/NIE AVALISTA]"}
- Email: ${a.email || "[EMAIL]"}
- Teléfono: ${a.telefono || "[TELÉFONO]"}
`;
      });
      avalistasSection += `\nEl contrato DEBE incluir una cláusula de aval/fianza personal donde el/los avalista(s) se constituyen en fiadores solidarios del arrendatario, respondiendo del cumplimiento de todas las obligaciones del contrato.`;
    }

    const datosSection = `DATOS DEL ARRENDADOR (PROPIETARIO):
- Nombre: ${propietario.nombre || "[NOMBRE ARRENDADOR]"}
- NIF: ${propietario.nif || "[NIF ARRENDADOR]"}
- Domicilio: ${propietario.domicilio || "[DOMICILIO ARRENDADOR]"}
- Email: ${propietario.email || "[EMAIL]"}
- Teléfono: ${propietario.telefono || "[TELÉFONO]"}

${tenantSection}
${avalistasSection}

DATOS DEL INMUEBLE:
- Dirección: ${propiedad.direccion || "[DIRECCIÓN COMPLETA]"}
- Referencia catastral: ${propiedad.referencia_catastral || "[REF. CATASTRAL]"}
- Superficie: ${propiedad.superficie_m2 ? propiedad.superficie_m2 + " m²" : "[SUPERFICIE]"}
- Tipo: ${propiedad.tipo_vivienda || "vivienda"}
- Habitaciones: ${propiedad.num_habitaciones || "[N]"}
- Baños: ${propiedad.num_banos || "[N]"}

CONDICIONES ECONÓMICAS:
- Renta mensual: ${condiciones.renta || "[RENTA]"} €
- Fianza: ${condiciones.fianza || "1 mes de renta"}
- Fecha de inicio: ${condiciones.fecha_inicio || "[FECHA INICIO]"}
- Duración: ${condiciones.duracion || "5 años"}
${inventarioSection}`;

    let prompt: string;
    let systemMessage: string;

    if (plantilla && typeof plantilla === "string" && plantilla.trim().length > 0) {
      // Template-based generation: fill in an existing template
      systemMessage = "Eres un abogado experto en derecho inmobiliario español. Tu tarea es rellenar plantillas de contratos de arrendamiento con los datos proporcionados. Mantén la estructura, formato y redacción exacta de la plantilla, sustituyendo SOLO los campos vacíos, placeholders, espacios en blanco o marcas del tipo [___], «...», etc. con los datos reales. Si algún dato no está disponible, déjalo como [COMPLETAR]. Responde siempre en español. Devuelve el contrato completo en Markdown.";

      prompt = `A continuación tienes una PLANTILLA de contrato que el usuario quiere usar como base. Tu trabajo es:

1. MANTENER la estructura, cláusulas y redacción exacta de la plantilla
2. RELLENAR todos los campos vacíos, placeholders, líneas en blanco (___), etc. con los datos reales proporcionados abajo
3. Si un dato no está disponible, marcarlo como [COMPLETAR]
4. NO añadir cláusulas nuevas que no estén en la plantilla
5. NO eliminar cláusulas existentes
6. Devolver el contrato completo rellenado en formato Markdown

PLANTILLA DEL USUARIO:
---
${plantilla}
---

DATOS PARA RELLENAR:

${datosSection}

Rellena la plantilla anterior con estos datos y devuelve el contrato completo.`;
    } else {
      // Standard generation from scratch
      systemMessage = "Eres un abogado experto en derecho inmobiliario español. Generas contratos de arrendamiento profesionales, completos y ajustados a la normativa vigente. Responde siempre en español.";

      prompt = `Genera un ${tipoDescripcion[tipoContrato] || tipoDescripcion.larga_duracion} completo y profesional según la normativa española vigente en 2025.

${datosSection}

El contrato debe incluir todas las cláusulas estándar: objeto, duración, renta y actualización (IPC), fianza, gastos y suministros, obras, cesión y subarriendo, resolución, jurisdicción, protección de datos.${inventario?.length ? " Incluir cláusula de inventario y el anexo detallado al final." : ""}${tenantList.length > 1 ? " Incluir cláusula de responsabilidad solidaria de los arrendatarios." : ""}${avalistas?.length ? " Incluir cláusula de aval personal/fianza solidaria con los datos de los avalistas." : ""} Formateado en Markdown con numeración de cláusulas.
Marca con [COMPLETAR] los datos que falten.`;
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
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes." }), {
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-contrato error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
