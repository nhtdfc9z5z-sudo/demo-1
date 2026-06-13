import type { Documento, DocumentoVinculo } from "@/hooks/useDocumentos";

/**
 * Sprint 4.2 — Reglas puras de salud documental.
 * Sin React, sin Supabase: facilita testing y reutilización.
 *
 * Categorías reconocidas con vencimiento.
 */
export const CATEGORIAS_CON_VENCIMIENTO = [
  "seguro_hogar",
  "seguro_impago",
  "cee",
  "contrato",
  "ibi",
  "comunidad",
  "mantenimiento",
  "otros",
] as const;

export type CategoriaVencimiento = (typeof CATEGORIAS_CON_VENCIMIENTO)[number];

export interface SaludEntradaContrato {
  id: string;
  titulo?: string | null;
  estado?: string | null;
}

export interface SaludEntradaActivo {
  id: string;
  nombre_interno?: string | null;
}

export interface SaludDocumentoVencido {
  doc: Documento;
  diasVencido: number;
}

export interface SaludDocumentoProximo {
  doc: Documento;
  diasRestantes: number;
}

export interface DocumentSaludResult {
  vencidos: SaludDocumentoVencido[];
  vencenPronto: SaludDocumentoProximo[];
  segurosPorVencer: SaludDocumentoProximo[];
  contratosSinDocumento: SaludEntradaContrato[];
  activosSinCEE: SaludEntradaActivo[];
  ocrFallidos: Documento[];
}

const MS_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  const ams = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bms - ams) / MS_DAY);
}

/**
 * Calcula las 6 señales de salud documental:
 * - vencidos
 * - vencen pronto (≤ horizonteDias)
 * - seguros próximos a vencer
 * - contratos sin documento adjunto
 * - activos sin CEE
 * - OCR fallidos
 *
 * `now` y `horizonteDias` son inyectables para tests deterministas.
 */
export function computeDocumentSalud(params: {
  documentos: Documento[];
  vinculos: DocumentoVinculo[];
  contratos: SaludEntradaContrato[];
  activos: SaludEntradaActivo[];
  now?: Date;
  horizonteDias?: number;
}): DocumentSaludResult {
  const now = params.now ?? new Date();
  const horizonte = params.horizonteDias ?? 30;

  const vencidos: SaludDocumentoVencido[] = [];
  const vencenPronto: SaludDocumentoProximo[] = [];
  const segurosPorVencer: SaludDocumentoProximo[] = [];
  const ocrFallidos: Documento[] = [];

  for (const doc of params.documentos) {
    if (doc.ocr_status === "error") ocrFallidos.push(doc);
    if (!doc.fecha_vencimiento) continue;
    // Fechas YYYY-MM-DD → Date local sin desfases.
    const [y, m, d] = doc.fecha_vencimiento.split("-").map(Number);
    if (!y || !m || !d) continue;
    const venc = new Date(y, m - 1, d);
    const diff = daysBetween(now, venc);
    if (diff < 0) {
      vencidos.push({ doc, diasVencido: -diff });
    } else if (diff <= horizonte) {
      vencenPronto.push({ doc, diasRestantes: diff });
      if (doc.categoria === "seguro_hogar" || doc.categoria === "seguro_impago") {
        segurosPorVencer.push({ doc, diasRestantes: diff });
      }
    }
  }

  // Contratos sin documento adjunto (vivientes/sin estado filtrado externamente).
  const docsPorContrato = new Set<string>();
  for (const v of params.vinculos) {
    if (v.entidad_tipo === "contrato") docsPorContrato.add(v.entidad_id);
  }
  const contratosSinDocumento = params.contratos.filter((c) => !docsPorContrato.has(c.id));

  // Activos sin CEE: ningún documento con categoría "cee" vinculado a ese activo.
  const docsCEEPorActivo = new Set<string>();
  const ceeDocIds = new Set(
    params.documentos.filter((d) => d.categoria === "cee").map((d) => d.id),
  );
  for (const v of params.vinculos) {
    if (v.entidad_tipo === "activo" && ceeDocIds.has(v.documento_id)) {
      docsCEEPorActivo.add(v.entidad_id);
    }
  }
  const activosSinCEE = params.activos.filter((a) => !docsCEEPorActivo.has(a.id));

  return {
    vencidos,
    vencenPronto,
    segurosPorVencer,
    contratosSinDocumento,
    activosSinCEE,
    ocrFallidos,
  };
}