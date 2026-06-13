/**
 * analizarDocumento — wrapper único sobre la edge function
 * `analyze-contrato` que soporta multi-archivo y fusiona resultados.
 *
 * - Recibe `File[]` (1..N).
 * - Llama a la edge function en paralelo (`Promise.all`).
 * - Fusiona los resultados con `fusionarResultados` (primer archivo gana
 *   en campos duplicados; arrendatarios se acumulan y deduplican).
 * - Nunca lanza: errores por archivo se devuelven en `porArchivo[]` para
 *   que la UI ofrezca fallback manual o reintento.
 *
 * Esta es la ÚNICA puerta del frontend al OCR de contratos. Cualquier
 * cambio en la edge function (formato de payload o de respuesta) tiene
 * que mantener este contrato — el smoke test lo verifica.
 */
import { supabase } from "@/integrations/supabase/client";
import { fusionarResultados } from "./fusionarResultados";
import type {
  AnalizarDocumentoResult,
  ContratoAnalysis,
  OCRArchivoResultado,
} from "./types";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function analizarUno(file: File): Promise<OCRArchivoResultado> {
  try {
    const base64 = await fileToBase64(file);
    const { data, error } = await supabase.functions.invoke("analyze-contrato", {
      body: { imageBase64: base64, mimeType: file.type || "application/pdf" },
    });
    if (error) {
      return {
        archivo: file.name,
        status: "error",
        error: error.message || "Error en el análisis OCR",
      };
    }
    if (!data || typeof data !== "object") {
      return {
        archivo: file.name,
        status: "error",
        error: "Respuesta vacía del motor OCR",
      };
    }
    return {
      archivo: file.name,
      status: "ok",
      data: data as ContratoAnalysis,
    };
  } catch (e) {
    return {
      archivo: file.name,
      status: "error",
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export async function analizarDocumento(
  files: File[],
): Promise<AnalizarDocumentoResult> {
  if (!files || files.length === 0) {
    return { fusionado: null, porArchivo: [], okCount: 0, errorCount: 0 };
  }
  const porArchivo = await Promise.all(files.map(analizarUno));
  const okData = porArchivo
    .filter((r): r is OCRArchivoResultado & { data: ContratoAnalysis } => r.status === "ok" && !!r.data)
    .map((r) => r.data);
  const fusion = fusionarResultados(okData);
  const fusionado = fusion
    ? { ...fusion, _fuentes: porArchivo }
    : null;
  return {
    fusionado,
    porArchivo,
    okCount: porArchivo.filter((r) => r.status === "ok").length,
    errorCount: porArchivo.filter((r) => r.status === "error").length,
  };
}