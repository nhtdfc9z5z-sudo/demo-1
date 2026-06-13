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
    // --- Auth real: rechaza anon key, exige usuario con sesión ---
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

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) throw new Error("No document data provided");

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
              {
                type: "text",
                text: `Eres un experto en contratos de arrendamiento españoles y la LAU (Ley de Arrendamientos Urbanos).

Analiza este contrato y extrae TODOS los datos relevantes con máxima precisión. Estos datos se usarán para:
- Gestión de la propiedad y el inquilino
- Calendario de avisos de renovación y vencimiento
- Cálculo de fianzas y depósitos
- Gestión de suministros (quién paga qué)
- Generación de comunicaciones legales
- Declaración de Hacienda

## DATOS A EXTRAER:

### Partes del contrato
- Arrendador: nombre completo, NIF/CIF
- Arrendatarios (todos): nombre completo, DNI/NIE, teléfono, email de cada uno
- Si hay avalistas o fiadores, incluirlos también como arrendatarios con nota

### Inmueble
- Dirección DESGLOSADA: calle (sin número), número/portal, planta, puerta/letra, código postal, ciudad, provincia
- Dirección completa en una línea
- ESCALERA: detectar cualquiera de estas formas y poblar \`direccion_escalera\`:
  "escalera X", "Esc. X", "Escalera X", "Es:X", "Es: X" (también en CEE/anexos)
- PORTAL: si la finca tiene un portal distinto del número de calle, poblar
  \`direccion_portal\`. Formas típicas: "Portal X", "Prtl. X", "Pl. X".
- BLOQUE: detectar "Bloque X", "Blq. X", "Bl:X" y poblar \`direccion_bloque\`.
- CÓDIGO POSTAL: SIEMPRE 5 dígitos exactos. Si aparece "28933 Móstoles" extraer SOLO "28933".
  Buscar también en CEE y ficha catastral adjunta. Etiquetas típicas: "Código Postal", "CP", "C.P."
- SUPERFICIE: buscar superficie en cuerpo del contrato, en el certificado
  energético (CEE) y en la ficha catastral adjunta. Prioridad para
  \`superficie_util_m2\`:
    1) Superficie útil explícita
    2) Superficie habitable
    3) Superficie construida
  Indicar el origen en \`superficie_origen\` (contrato | cee | catastro).

### Condiciones económicas
- Renta mensual EXACTA en euros
- Fianza legal: importe EXACTO en euros. Si dice "una mensualidad" = importe de la renta. Si dice "dos mensualidades" = renta × 2. SIEMPRE un número.
- Depósito de garantía adicional (aparte de fianza legal), si existe
- Cuota de comunidad si se menciona

### Duración y renovación
- Fecha de inicio (YYYY-MM-DD)
- Duración INICIAL en años (el período pactado originalmente, ej: 1 año)
- Prórroga obligatoria en años (ej: contrato de 1 año con prórrogas anuales hasta 3 → prórroga = 2 años)
- Fecha de fin = fecha_inicio + duración_inicial + prórroga_obligatoria. Si no hay duración explícita, aplicar LAU: 5 años (persona física) o 7 años (persona jurídica)
- Preaviso para no renovar en MESES (convertir días a meses si es necesario: 30 días = 1 mes)
- Renovación automática: true para contratos de larga duración según LAU (se renuevan anualmente salvo notificación)

### Suministros y gastos — ¿quién paga?
- Agua, luz/electricidad, gas, internet/teléfono
- IBI, tasa de basuras
- Comunidad de propietarios
- Para cada uno: true = paga el inquilino, false = paga el propietario

### Tipo de contrato
- larga_duracion (vivienda habitual)
- vacacional
- habitacion
- explotacion

### Notas
- Resumen de TODAS las cláusulas relevantes: condiciones especiales, obras permitidas, mascotas, subarriendo, actualización de renta (IPC u otro índice), penalizaciones, causas de resolución anticipada, quién paga cada suministro detallado

## REGLAS IMPORTANTES:

1. NOMBRES: NUNCA incluir tratamientos de cortesía (Don, Doña, D., Dña., Sr., Sra., etc.). Solo nombre y apellidos reales.
   Ejemplo: "Don Juan García López" → "Juan García López"

2. FIANZA: SIEMPRE extraer un número concreto en euros. Si el contrato dice "la cantidad equivalente a una mensualidad de renta", calcular: renta_mensual × 1. Si dice "dos mensualidades", calcular: renta_mensual × 2.

3. FECHAS: Formato YYYY-MM-DD siempre. Si solo aparece mes/año, usar el día 1.

4. DURACIÓN: Distinguir claramente entre:
   - duracion_anos: solo el período INICIAL pactado
   - prorroga_anos: años ADICIONALES de prórroga obligatoria
   - fecha_fin: suma de ambos desde fecha_inicio
   
5. RENOVACIÓN: Según la LAU, tras el período inicial + prórrogas, el contrato se renueva automáticamente por períodos anuales (renovación tácita). Marcar siempre renovacion_automatica = true para contratos de larga duración.

6. PREAVISO: Si el contrato dice "30 días", convertir a 1 mes. Si dice "2 meses", poner 2. Este dato es CRÍTICO para los avisos del calendario.

7. CLÁUSULA DE ACTUALIZACIÓN DE RENTA: Extraer textualmente la cláusula que describe cómo se actualiza la renta (IPC, IRAV, índice pactado, porcentaje fijo, etc.). Si no existe cláusula, dejar vacío.`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contrato",
              description: "Extrae los datos estructurados del contrato de arrendamiento español",
              parameters: {
                type: "object",
                properties: {
                  titulo: { type: "string", description: "Título descriptivo del contrato (ej: 'Contrato de arrendamiento de vivienda habitual')" },
                  fecha_inicio: { type: "string", description: "Fecha de inicio (YYYY-MM-DD)" },
                  fecha_fin: { type: "string", description: "Fecha de fin calculada = inicio + duración + prórrogas (YYYY-MM-DD)" },
                  renta_mensual: { type: "number", description: "Renta mensual en euros" },
                  estado: { type: "string", enum: ["vigente", "finalizado", "renovado"], description: "Estado del contrato" },
                  tipo_contrato: {
                    type: "string",
                    enum: ["habitual", "vacacional", "habitaciones", "rent_to_rent", "cesion_empresa"],
                    description: "Clasificación del contrato. PRIORIZA el TÍTULO y las primeras líneas del documento. Mapea: 'Contrato de arrendamiento de vivienda' → habitual; 'arrendamiento de temporada' o 'vacacional/turístico' → vacacional; 'arrendamiento de habitación' → habitaciones; 'cesión de uso' → cesion_empresa; 'subarriendo' o 'rent to rent' → rent_to_rent. Si NO hay una indicación clara y confiable en el título/primeras líneas, OMITE este campo (no inventes).",
                  },
                  notas: { type: "string", description: "Resumen detallado de cláusulas: duración, prórrogas, renovación, suministros, condiciones especiales, actualización renta, penalizaciones" },
                  arrendador_nombre: { type: "string", description: "Nombre completo del arrendador (sin Don/Doña)" },
                  arrendador_nif: { type: "string", description: "NIF/CIF del arrendador" },
                  arrendatario_nombre: { type: "string", description: "Nombre completo del primer arrendatario (sin Don/Doña)" },
                  arrendatario_nif: { type: "string", description: "DNI/NIE del primer arrendatario" },
                  arrendatario_telefono: { type: "string", description: "Teléfono del primer arrendatario" },
                  arrendatario_email: { type: "string", description: "Email del primer arrendatario" },
                  arrendatarios: {
                    type: "array",
                    description: "Lista de TODOS los arrendatarios/inquilinos, EN EL ORDEN en que aparecen o firman en el documento (arrendatarios[0] = primer firmante o primer arrendatario indicado en el encabezado del contrato; será el titular principal). Usar SIEMPRE.",
                    items: {
                      type: "object",
                      properties: {
                        nombre: { type: "string", description: "Nombre completo (sin Don/Doña)" },
                        nif: { type: "string", description: "DNI/NIE" },
                        telefono: { type: "string" },
                        email: { type: "string" },
                      },
                      required: ["nombre"],
                    },
                  },
                  fianza_importe: { type: "number", description: "Fianza legal en euros (calculada si dice 'X mensualidades')" },
                  deposito_garantia: { type: "number", description: "Depósito adicional en euros (aparte de fianza legal)" },
                  direccion_inmueble: { type: "string", description: "Dirección completa en una línea" },
                  direccion_calle: { type: "string", description: "Calle sin número" },
                  direccion_numero: { type: "string", description: "Número/portal" },
                  direccion_planta: { type: "string", description: "Planta" },
                  direccion_puerta: { type: "string", description: "Puerta/letra" },
                  direccion_portal: { type: "string", description: "Número de portal (cuando es distinto del número de vía). Buscar 'Portal X', 'Prtl. X'." },
                  direccion_bloque: { type: "string", description: "Bloque dentro de la finca. Buscar 'Bloque X', 'Blq. X', 'Bl:X'." },
                  direccion_codigo_postal: { type: "string", description: "Código postal (5 dígitos)" },
                  direccion_ciudad: { type: "string", description: "Ciudad/municipio" },
                  direccion_provincia: { type: "string", description: "Provincia" },
                  direccion_escalera: { type: "string", description: "Escalera" },
                  direccion_urbanizacion: { type: "string", description: "Urbanización" },
                  referencia_catastral: { type: "string", description: "Referencia catastral (20 caracteres: 7 dígitos + 2 letras + 4 dígitos + letra + 4 dígitos + 2 letras). Ej: 6547606VK2664N0011MI" },
                  calificacion_energetica: { type: "string", enum: ["A", "B", "C", "D", "E", "F", "G"], description: "Calificación energética del inmueble (A-G)" },
                  ano_construccion: { type: "number", description: "Año de construcción del inmueble" },
                  superficie_util_m2: { type: "number", description: "Superficie en m². Prioridad: útil > habitable > construida. Buscar en contrato, CEE y catastro." },
                  superficie_origen: { type: "string", enum: ["contrato", "cee", "catastro"], description: "De qué documento se extrajo la superficie" },
                  duracion_anos: { type: "number", description: "Duración INICIAL en años (sin prórrogas)" },
                  prorroga_anos: { type: "number", description: "Años de prórroga obligatoria adicionales" },
                  renovacion_automatica: { type: "boolean", description: "Si se renueva automáticamente tras el período obligatorio (true para larga duración según LAU)" },
                  preaviso_meses: { type: "number", description: "Meses de preaviso para no renovar (30 días = 1 mes)" },
                  agua_paga_inquilino: { type: "boolean", description: "true si el inquilino paga el agua" },
                  luz_paga_inquilino: { type: "boolean", description: "true si el inquilino paga la luz" },
                  gas_paga_inquilino: { type: "boolean", description: "true si el inquilino paga el gas" },
                  internet_paga_inquilino: { type: "boolean", description: "true si el inquilino paga internet" },
                  ibi_paga_inquilino: { type: "boolean", description: "true si el inquilino paga el IBI" },
                  basuras_paga_inquilino: { type: "boolean", description: "true si el inquilino paga basuras" },
                  comunidad_paga_inquilino: { type: "boolean", description: "true si el inquilino paga la comunidad" },
                  cuota_comunidad: { type: "number", description: "Cuota de comunidad mensual en euros" },
                  clausula_actualizacion_renta: { type: "string", description: "Texto de la cláusula de actualización de renta (IPC, IRAV, índice pactado, etc.). Copiar literal o resumir fielmente." },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contrato" } },
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
    if (!toolCall) throw new Error("No se pudo analizar el contrato");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-contrato error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
