import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge function: consultar-catastro
 *
 * Llama al servicio público Consulta_DNPLOC del Catastro (búsqueda por
 * dirección postal) y devuelve los resultados normalizados. Best-effort:
 * nunca lanza al cliente; ante errores devuelve `{ ok: false, ... }`.
 *
 * Formato XML típico de respuesta (resumido):
 *   <consulta_dnploc>
 *     <lrcdnp>
 *       <rcdnp>
 *         <pc>
 *           <pc1>6547606</pc1>
 *           <pc2>VK2664N</pc2>
 *         </pc>
 *         <car>0011</car>      (opcional)
 *         <cc1>M</cc1>         (opcional)
 *         <cc2>I</cc2>         (opcional)
 *         <dt><locs><lous><lourb>
 *           <dir><cv>CL PARQUE VOSA 13 Es:1 Pl:02 Pt:C</cv></dir>
 *         </lourb></lous></locs></dt>
 *         <ldt>
 *           <cpt>
 *             <sfc><sup>62</sup></sfc>
 *             <aoc>1973</aoc>
 *           </cpt>
 *         </ldt>
 *       </rcdnp>
 *     </lrcdnp>
 *   </consulta_dnploc>
 *
 * Reglas:
 *  - Construir referencia_catastral COMPLETA (20 chars) sólo si Catastro
 *    devuelve pc1 + pc2 + car + cc1 + cc2 sin ambigüedad.
 *  - Si no, devolver referencia_catastral_parcial = pc1+pc2 (14 chars) y
 *    referencia_catastral = null. Nunca inventar.
 */

const CATASTRO_ENDPOINT =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRX/OVCCallejero.asmx/Consulta_DNPLOC";

// ───────────────────────── XML helpers (regex, sin dependencias) ─────────────────────────

function escapeTag(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Primer hijo de un nombre dado (texto interior, trim). */
function getTagText(xml: string, name: string): string | null {
  const re = new RegExp(`<${escapeTag(name)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTag(name)}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  const inner = m[1].trim();
  return inner.length === 0 ? null : inner;
}

/** Todos los bloques <name>…</name> a este nivel o más profundo. */
function getAllBlocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${escapeTag(name)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTag(name)}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function parseIntSafe(s: string | null): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export interface ResultadoCatastroParsed {
  referencia_catastral: string | null;
  referencia_catastral_parcial: string | null;
  superficie_construida_m2: number | null;
  ano_construccion: number | null;
  direccion_completa: string | null;
}

/**
 * Parsea un único bloque <rcdnp>…</rcdnp> a `ResultadoCatastroParsed`.
 * Exportado para que los tests Deno puedan ejercerlo sin red.
 */
export function parseRcdnpBlock(rcdnp: string): ResultadoCatastroParsed {
  const pc = getTagText(rcdnp, "pc") ?? "";
  const pc1 = getTagText(pc, "pc1");
  const pc2 = getTagText(pc, "pc2");

  // Componentes opcionales que completan la referencia (20 chars):
  //  - car (4)  parcela dentro del cargo
  //  - cc1 (1)  control 1
  //  - cc2 (1)  control 2
  const car = getTagText(rcdnp, "car");
  const cc1 = getTagText(rcdnp, "cc1");
  const cc2 = getTagText(rcdnp, "cc2");

  let referencia_catastral: string | null = null;
  let referencia_catastral_parcial: string | null = null;
  if (pc1 && pc2) {
    if (car && cc1 && cc2) {
      const ref = `${pc1}${pc2}${car}${cc1}${cc2}`;
      if (ref.length === 20) referencia_catastral = ref;
      else referencia_catastral_parcial = `${pc1}${pc2}`;
    } else {
      referencia_catastral_parcial = `${pc1}${pc2}`;
    }
  }

  // Superficie y año desde <cpt>.
  const cpt = getTagText(rcdnp, "cpt") ?? "";
  const sfc = getTagText(cpt, "sfc") ?? cpt;
  const sup = getTagText(sfc, "sup");
  const superficie_construida_m2 = parseIntSafe(sup);

  const aoc = getTagText(cpt, "aoc") ?? getTagText(rcdnp, "aoc");
  const ano_construccion = parseIntSafe(aoc);

  // Dirección completa <cv>.
  const dir = getTagText(rcdnp, "dir") ?? "";
  const cv = getTagText(dir, "cv") ?? getTagText(rcdnp, "cv");

  return {
    referencia_catastral,
    referencia_catastral_parcial,
    superficie_construida_m2,
    ano_construccion,
    direccion_completa: cv,
  };
}

/** Parsea la respuesta DNPLOC completa, devolviendo la lista de resultados. */
export function parseDnplocResponse(xml: string): {
  resultados: ResultadoCatastroParsed[];
  errorCatastro: string | null;
} {
  // Catastro devuelve <err><des>mensaje</des></err> ante errores.
  const errBlock = getTagText(xml, "err");
  if (errBlock) {
    const des = getTagText(errBlock, "des");
    if (des) return { resultados: [], errorCatastro: des };
  }

  const bloques = getAllBlocks(xml, "rcdnp");
  if (bloques.length === 0) {
    // Algunas respuestas envuelven en <bico>… para un único resultado.
    const bico = getAllBlocks(xml, "bico");
    if (bico.length > 0) {
      return { resultados: bico.map(parseRcdnpBlock), errorCatastro: null };
    }
    return { resultados: [], errorCatastro: null };
  }
  return { resultados: bloques.map(parseRcdnpBlock), errorCatastro: null };
}

// ───────────────────────── handler ─────────────────────────

interface Body {
  provincia?: string;
  municipio?: string;
  tipo_via?: string | null; // sigla Catastro ("CL", "AV"…) o vacío
  nombre_via?: string;
  numero?: string | null;
  planta?: string | null;
  puerta?: string | null;
  poligono?: string | null;
  parcela?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const provincia = (body.provincia ?? "").trim();
    const municipio = (body.municipio ?? "").trim();
    const sigla = (body.tipo_via ?? "").trim().toUpperCase();
    const calle = (body.nombre_via ?? "").trim();
    const numero = (body.numero ?? "").trim();
    const planta = (body.planta ?? "").toString().trim();
    const puerta = (body.puerta ?? "").toString().trim();
    // Polígono/parcela: fincas rústicas. El endpoint DNPLOC sólo soporta
    // dirección postal; para rústicas devolvemos respuesta controlada
    // sin errores y dejamos que el cliente muestre el panel de ayuda.
    const poligono = (body.poligono ?? "").toString().trim();
    const parcela = (body.parcela ?? "").toString().trim();

    if (!provincia || !municipio || (!calle && !(poligono && parcela))) {
      return new Response(
        JSON.stringify({
          ok: false,
          resultados: [],
          error: "Faltan datos mínimos: provincia, municipio y nombre de vía.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (poligono && parcela && !calle) {
      // No tenemos endpoint REST de rústica aquí: respuesta controlada.
      return new Response(
        JSON.stringify({
          ok: true,
          resultados: [],
          aviso: "Búsqueda rústica no soportada por dirección postal.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const qs = new URLSearchParams({
      Provincia: provincia,
      Municipio: municipio,
      Sigla: sigla,
      Calle: calle,
      Numero: numero,
      Bloque: "",
      Escalera: "",
      Planta: planta,
      Puerta: puerta,
    });

    const url = `${CATASTRO_ENDPOINT}?${qs.toString()}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/xml, text/xml" },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          resultados: [],
          error: `Catastro respondió ${resp.status}.`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const xml = await resp.text();
    const { resultados, errorCatastro } = parseDnplocResponse(xml);

    if (errorCatastro) {
      return new Response(
        JSON.stringify({ ok: true, resultados: [], aviso: errorCatastro }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("consultar-catastro error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        resultados: [],
        error: e instanceof Error ? e.message : "Error desconocido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});