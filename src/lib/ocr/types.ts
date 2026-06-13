/**
 * OCR — tipos compartidos por el motor de análisis de documentos.
 *
 * `ContratoAnalysisFusionado` es el resultado de fusionar uno o varios
 * archivos analizados por la edge function `analyze-contrato`. Hereda la
 * misma forma que `ContratoAnalysis` (un único archivo) y añade metadatos
 * útiles para la UI de revisión.
 */
import type { ContratoAnalysis, ContratoArrendatario } from "@/hooks/useContratos";

export type { ContratoAnalysis, ContratoArrendatario };

export interface OCRArchivoResultado {
  /** Nombre del archivo original. */
  archivo: string;
  /** Estado del análisis para este archivo concreto. */
  status: "ok" | "error";
  /** Datos extraídos por la edge function (si status === "ok"). */
  data?: ContratoAnalysis;
  /** Mensaje de error en español si status === "error". */
  error?: string;
}

export interface ContratoAnalysisFusionado extends ContratoAnalysis {
  /** Metadatos por archivo, útiles para mostrar trazabilidad al usuario. */
  _fuentes?: OCRArchivoResultado[];
}

export interface AnalizarDocumentoResult {
  /** Fusión de todos los archivos con datos válidos. `null` si ninguno OK. */
  fusionado: ContratoAnalysisFusionado | null;
  /** Resultado individual por archivo, en el mismo orden que la entrada. */
  porArchivo: OCRArchivoResultado[];
  /** Cuántos archivos se procesaron con éxito. */
  okCount: number;
  /** Cuántos archivos fallaron. */
  errorCount: number;
}