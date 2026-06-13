/**
 * prepararConsultaCatastro / ejecutarConsultaCatastro
 *
 * Motor único de preparación y reintentos de consultas al Catastro.
 *
 *  - `prepararConsultaCatastro(d)` analiza una `DireccionEstructurada` y
 *    devuelve hasta 3 intentos ordenados de más específico a más amplio.
 *    No realiza ninguna llamada de red.
 *
 *  - `ejecutarConsultaCatastro(d, fn?)` ejecuta esos intentos en orden,
 *    deteniéndose en el primero con resultados. Devuelve siempre una
 *    respuesta controlada con `{ resultados, agotado, intentos_realizados,
 *    errores }`. Nunca lanza.
 *
 * Reglas:
 *  - Máximo 3 intentos. Nunca más.
 *  - Para fincas rústicas (polígono + parcela) se construye un único
 *    intento específico y se omite el resto.
 *  - El cliente nunca debería repetir esta lógica: este es el único
 *    motor compartido por DireccionEstructuradaForm, FichaInmuebleSheet
 *    y el flujo OCR de altas.
 */
import type { DireccionEstructurada } from "@/lib/direccion/formatDireccion";
import {
  consultarCatastro,
  type ConsultaCatastroParams,
  type ConsultaCatastroResult,
  type ResultadoCatastro,
} from "./consultarCatastro";
import {
  normalizarMunicipioCatastro,
  normalizarProvinciaCatastro,
  normalizarPlanta,
  normalizarPuerta,
  normalizarTipoVia,
  parseDireccionLibre,
} from "./normalizacion";

export interface IntentoCatastro extends ConsultaCatastroParams {
  /** Etiqueta corta del intento, útil para logs/diagnóstico. */
  etiqueta: string;
  planta?: string | null;
  puerta?: string | null;
  poligono?: string | null;
  parcela?: string | null;
}

export interface ResultadoEjecucionCatastro {
  resultados: ResultadoCatastro[];
  agotado: boolean;
  intentos_realizados: number;
  errores: Array<{ etiqueta: string; mensaje: string }>;
  /** Intento que produjo resultados, si hubo éxito. */
  intento_exitoso?: IntentoCatastro;
}

const MAX_INTENTOS = 3;

function inferirSigla(d: DireccionEstructurada): string | null {
  const directa = normalizarTipoVia(d.tipo_via);
  if (directa) return directa;
  // Fallback: el usuario puede haber pegado "Calle Mayor" en nombre_via.
  const parsed = parseDireccionLibre(d.nombre_via);
  return parsed.tipo_via_codigo;
}

function nombreLimpioDeVia(d: DireccionEstructurada): string {
  const raw = (d.nombre_via ?? "").trim();
  if (!raw) return "";
  if (normalizarTipoVia(d.tipo_via)) return raw;
  // El usuario pegó tipo + nombre juntos: recortar.
  const parsed = parseDireccionLibre(raw);
  return parsed.nombre_via || raw;
}

/**
 * Devuelve la lista de intentos a ejecutar (máximo 3, nunca más).
 * Si la dirección es claramente rústica (polígono + parcela), prepara un
 * único intento específico de rústica y omite el resto.
 */
export function prepararConsultaCatastro(
  d: DireccionEstructurada,
): IntentoCatastro[] {
  const provincia = normalizarProvinciaCatastro(d.provincia);
  const municipio = normalizarMunicipioCatastro(d.municipio ?? d.ciudad);
  if (!provincia || !municipio) return [];

  const poligono = (d.poligono ?? "").toString().trim();
  const parcela = (d.parcela ?? "").toString().trim();

  // ── Caso rústico: polígono + parcela ─────────────────────────────────
  if (poligono && parcela) {
    return [
      {
        etiqueta: "rustica:poligono+parcela",
        provincia,
        municipio,
        tipo_via: null,
        nombre_via: "",
        numero: null,
        poligono,
        parcela,
      },
    ];
  }

  const nombre_via = nombreLimpioDeVia(d);
  if (!nombre_via) return [];

  const sigla = inferirSigla(d);
  const numero = (d.numero ?? "").toString().trim() || null;
  const planta = normalizarPlanta(d.planta) ?? null;
  const puerta = normalizarPuerta(d.puerta) ?? null;

  const intentos: IntentoCatastro[] = [];

  // INTENTO 1 — completo con planta y puerta (si las hay).
  if (numero && (planta || puerta)) {
    intentos.push({
      etiqueta: "completo:sigla+nº+piso+puerta",
      provincia,
      municipio,
      tipo_via: sigla,
      nombre_via,
      numero,
      planta,
      puerta,
    });
  }

  // INTENTO 2 — sigla + número, sin planta/puerta.
  if (numero) {
    intentos.push({
      etiqueta: "edificio:sigla+nº",
      provincia,
      municipio,
      tipo_via: sigla,
      nombre_via,
      numero,
    });
  }

  // INTENTO 3 — sin sigla (útil cuando el tipo está mal detectado).
  intentos.push({
    etiqueta: "minimo:nº-sin-sigla",
    provincia,
    municipio,
    tipo_via: null,
    nombre_via,
    numero,
  });

  // Deduplicar intentos equivalentes (cuando no hay piso/puerta el #1 == #2).
  const seen = new Set<string>();
  const unicos: IntentoCatastro[] = [];
  for (const it of intentos) {
    const key = JSON.stringify([
      it.tipo_via ?? "",
      it.nombre_via,
      it.numero ?? "",
      it.planta ?? "",
      it.puerta ?? "",
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    unicos.push(it);
    if (unicos.length === MAX_INTENTOS) break;
  }
  return unicos.slice(0, MAX_INTENTOS);
}

/**
 * Ejecuta los intentos preparados, secuencialmente y como máximo 3.
 * Acepta un `fn` opcional (testing) que reemplaza al cliente real.
 */
export async function ejecutarConsultaCatastro(
  d: DireccionEstructurada,
  fn: (p: ConsultaCatastroParams) => Promise<ConsultaCatastroResult> = consultarCatastro,
): Promise<ResultadoEjecucionCatastro> {
  const intentos = prepararConsultaCatastro(d).slice(0, MAX_INTENTOS);
  const errores: Array<{ etiqueta: string; mensaje: string }> = [];
  let realizados = 0;

  for (const intento of intentos) {
    realizados += 1;
    try {
      // El edge function actual sólo lee tipo_via/nombre_via/numero, pero
      // pasamos los extras por compatibilidad futura sin romper la API.
      const { etiqueta, planta, puerta, poligono, parcela, ...payload } = intento;
      void etiqueta; void planta; void puerta; void poligono; void parcela;
      const res = await fn({
        ...payload,
        // Reenviar los campos extra como propiedades adicionales tolerables.
        ...(planta ? { planta } : {}),
        ...(puerta ? { puerta } : {}),
        ...(poligono ? { poligono } : {}),
        ...(parcela ? { parcela } : {}),
      } as ConsultaCatastroParams);
      if (res.ok && res.resultados.length > 0) {
        return {
          resultados: res.resultados,
          agotado: false,
          intentos_realizados: realizados,
          errores,
          intento_exitoso: intento,
        };
      }
      if (!res.ok && res.error) {
        errores.push({ etiqueta: intento.etiqueta, mensaje: res.error });
      } else if (res.aviso) {
        errores.push({ etiqueta: intento.etiqueta, mensaje: res.aviso });
      }
    } catch (e) {
      errores.push({
        etiqueta: intento.etiqueta,
        mensaje: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return {
    resultados: [],
    agotado: intentos.length > 0,
    intentos_realizados: realizados,
    errores,
  };
}

/** URL pública de la Sede del Catastro (búsqueda por ciudadano). */
export const CATASTRO_SEDE_URL =
  "https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx";