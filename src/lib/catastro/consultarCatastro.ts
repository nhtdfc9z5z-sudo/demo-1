/**
 * Cliente para la edge function `consultar-catastro`.
 * Best-effort: nunca lanza; devuelve `{ ok:false, ... }` ante cualquier error.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ResultadoCatastro {
  /** Referencia catastral COMPLETA (20 chars) si Catastro devuelve datos suficientes. */
  referencia_catastral: string | null;
  /** Referencia parcial (pc1+pc2, 14 chars) cuando no es posible reconstruir la completa. */
  referencia_catastral_parcial: string | null;
  superficie_construida_m2: number | null;
  ano_construccion: number | null;
  /** Dirección formateada por Catastro (campo `cv`). */
  direccion_completa: string | null;
}

export interface ConsultaCatastroParams {
  provincia: string;
  municipio: string;
  /** Sigla Catastro normalizada (CL, AV…). Puede ir vacío. */
  tipo_via?: string | null;
  nombre_via: string;
  numero?: string | null;
  /** Opcionales — el motor de preparación los rellena en el intento 1. */
  planta?: string | null;
  puerta?: string | null;
  poligono?: string | null;
  parcela?: string | null;
}

export interface ConsultaCatastroResult {
  ok: boolean;
  resultados: ResultadoCatastro[];
  error?: string;
  aviso?: string;
}

export async function consultarCatastro(
  params: ConsultaCatastroParams,
): Promise<ConsultaCatastroResult> {
  try {
    const { data, error } = await supabase.functions.invoke("consultar-catastro", {
      body: params,
    });
    if (error) {
      return { ok: false, resultados: [], error: error.message };
    }
    if (!data || typeof data !== "object") {
      return { ok: false, resultados: [], error: "Respuesta inválida del Catastro." };
    }
    return data as ConsultaCatastroResult;
  } catch (e) {
    return {
      ok: false,
      resultados: [],
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}