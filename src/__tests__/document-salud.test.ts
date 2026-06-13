import { describe, it, expect } from "vitest";
import { computeDocumentSalud } from "@/lib/documentSalud";
import type { Documento, DocumentoVinculo } from "@/hooks/useDocumentos";

function doc(partial: Partial<Documento>): Documento {
  return {
    id: partial.id || "d1",
    user_id: "u1",
    nombre: "doc.pdf",
    categoria: "general",
    mime_type: "application/pdf",
    size_bytes: 1000,
    bucket: "documentos",
    storage_path: "u1/x.pdf",
    origen_tipo: "upload",
    origen_id: null,
    ocr_status: "ok",
    ocr_text: null,
    ocr_error: null,
    ocr_engine: null,
    ocr_version: null,
    ocr_processed_at: null,
    notas: null,
    fecha_documento: null,
    fecha_vencimiento: null,
    requiere_revision: false,
    recordatorio_dias_antes: null,
    estado_revision: "pendiente",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as Documento;
}

const now = new Date(2026, 5, 4); // 4 Jun 2026

describe("computeDocumentSalud", () => {
  it("marca documentos vencidos", () => {
    const r = computeDocumentSalud({
      documentos: [doc({ id: "d1", fecha_vencimiento: "2026-05-01" })],
      vinculos: [],
      contratos: [],
      activos: [],
      now,
    });
    expect(r.vencidos).toHaveLength(1);
    expect(r.vencidos[0].diasVencido).toBe(34);
    expect(r.vencenPronto).toHaveLength(0);
  });

  it("marca documentos que vencen en 30 días", () => {
    const r = computeDocumentSalud({
      documentos: [doc({ id: "d1", fecha_vencimiento: "2026-06-20" })],
      vinculos: [],
      contratos: [],
      activos: [],
      now,
    });
    expect(r.vencenPronto).toHaveLength(1);
    expect(r.vencenPronto[0].diasRestantes).toBe(16);
    expect(r.vencidos).toHaveLength(0);
  });

  it("no alerta si no hay fecha de vencimiento", () => {
    const r = computeDocumentSalud({
      documentos: [doc({ id: "d1", fecha_vencimiento: null })],
      vinculos: [],
      contratos: [],
      activos: [],
      now,
    });
    expect(r.vencidos).toHaveLength(0);
    expect(r.vencenPronto).toHaveLength(0);
    expect(r.segurosPorVencer).toHaveLength(0);
  });

  it("detecta contratos sin documento adjunto", () => {
    const vinculos: DocumentoVinculo[] = [
      { id: "v1", documento_id: "d1", entidad_tipo: "contrato", entidad_id: "c1", created_at: "" } as any,
    ];
    const r = computeDocumentSalud({
      documentos: [doc({ id: "d1", categoria: "contrato" })],
      vinculos,
      contratos: [{ id: "c1", titulo: "Con PDF" }, { id: "c2", titulo: "Sin PDF" }],
      activos: [],
      now,
    });
    expect(r.contratosSinDocumento.map((c) => c.id)).toEqual(["c2"]);
  });

  it("detecta OCR fallido como aviso", () => {
    const r = computeDocumentSalud({
      documentos: [doc({ id: "d1", ocr_status: "error", ocr_error: "boom" })],
      vinculos: [],
      contratos: [],
      activos: [],
      now,
    });
    expect(r.ocrFallidos).toHaveLength(1);
    expect(r.ocrFallidos[0].id).toBe("d1");
  });

  it("identifica seguros próximos a vencer y activos sin CEE", () => {
    const r = computeDocumentSalud({
      documentos: [
        doc({ id: "d1", categoria: "seguro_hogar", fecha_vencimiento: "2026-06-20" }),
        doc({ id: "d2", categoria: "cee" }),
      ],
      vinculos: [
        { id: "v2", documento_id: "d2", entidad_tipo: "activo", entidad_id: "a1", created_at: "" } as any,
      ],
      contratos: [],
      activos: [{ id: "a1" }, { id: "a2" }],
      now,
    });
    expect(r.segurosPorVencer).toHaveLength(1);
    expect(r.activosSinCEE.map((a) => a.id)).toEqual(["a2"]);
  });
});