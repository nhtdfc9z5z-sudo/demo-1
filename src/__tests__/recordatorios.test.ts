import { describe, it, expect } from "vitest";
import {
  generarRecordatorios,
  type RecordatorioCandidato,
} from "@/lib/recordatorios/generador";

const now = new Date(2026, 5, 4); // 4 Jun 2026

function base(): Parameters<typeof generarRecordatorios>[0] {
  return {
    now,
    documentos: [],
    contratos: [],
    properties: [],
    inquilinos: [],
    pagos: [],
    hallazgos: [],
    resolveRentaEsperada: () => 0,
  };
}

function keys(out: RecordatorioCandidato[]) {
  return out.map((c) => `${c.tipo}|${c.origen_tipo}|${c.origen_id}`);
}

describe("generarRecordatorios", () => {
  it("genera recordatorio para contrato que vence pronto", () => {
    const out = generarRecordatorios({
      ...base(),
      contratos: [
        { id: "c1", titulo: "Piso Goya", fecha_fin: "2026-07-01", estado: "vigente" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].tipo).toBe("contrato_vence");
    expect(out[0].origen_id).toBe("c1");
  });

  it("genera recordatorio de documento vencido", () => {
    const out = generarRecordatorios({
      ...base(),
      documentos: [
        { id: "d1", nombre: "Seguro hogar.pdf", ocr_status: "ok", fecha_vencimiento: "2026-04-01" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].tipo).toBe("documento_vencido");
    expect(out[0].prioridad).toBe(1);
  });

  it("genera recordatorio de renta pendiente del mes actual", () => {
    const out = generarRecordatorios({
      ...base(),
      properties: [{ id: "p1", nombre_interno: "Piso Goya" }],
      inquilinos: [{ id: "i1", property_id: "p1", rol_inquilino: "titular" }],
      pagos: [], // nada cobrado
      resolveRentaEsperada: () => 1000,
    });
    expect(out).toHaveLength(1);
    expect(out[0].tipo).toBe("renta_pendiente");
    expect(out[0].origen_id).toBe("p1:2026-06");
  });

  it("produce origen_id estable (no duplica al regenerar)", () => {
    const input = {
      ...base(),
      documentos: [
        { id: "d1", nombre: "X.pdf", ocr_status: "error" as const, fecha_vencimiento: null },
      ],
    };
    const a = generarRecordatorios(input);
    const b = generarRecordatorios(input);
    expect(keys(a)).toEqual(keys(b));
    expect(a).toHaveLength(1);
  });

  it("no alerta si la renta esperada está cobrada", () => {
    const out = generarRecordatorios({
      ...base(),
      properties: [{ id: "p1" }],
      inquilinos: [{ id: "i1", property_id: "p1" }],
      pagos: [
        { property_id: "p1", mes: 6, anio: 2026, importe_pagado: 1000, propietario_confirmado: true },
      ],
      resolveRentaEsperada: () => 1000,
    });
    expect(out).toHaveLength(0);
  });

  it("emite aviso de anualidad (revisión IPC) 90 días antes", () => {
    const out = generarRecordatorios({
      ...base(),
      now: new Date(2026, 9, 15), // 15-Oct-2026, aniversario 01-Ene-2027
      contratos: [
        {
          id: "c1",
          titulo: "Piso Goya",
          fecha_inicio: "2024-01-01",
          fecha_fin: null,
          estado: "vigente",
        },
      ],
    });
    const anu = out.find((c) => c.tipo === "revision_renta_anualidad");
    expect(anu).toBeDefined();
    expect(anu?.origen_id).toBe("c1:anualidad:3");
  });

  it("no emite aviso de anualidad si ya hay actualización procesada", () => {
    const out = generarRecordatorios({
      ...base(),
      now: new Date(2026, 9, 15),
      contratos: [
        {
          id: "c1",
          fecha_inicio: "2024-01-01",
          fecha_fin: null,
          estado: "vigente",
        },
      ],
      rentaActualizaciones: [
        { contrato_id: "c1", fecha_efectiva: "2026-12-15" },
      ],
    });
    expect(out.filter((c) => c.tipo === "revision_renta_anualidad")).toHaveLength(0);
  });

  it("emite renovación sugerida si contrato venció y tiene prórroga", () => {
    const out = generarRecordatorios({
      ...base(),
      now: new Date(2026, 5, 4),
      contratos: [
        {
          id: "c1",
          titulo: "Piso Goya",
          fecha_inicio: "2023-01-01",
          fecha_fin: "2026-01-01",
          estado: "vigente",
          prorroga_anos: 2,
          renovacion_automatica: true,
        },
      ],
    });
    const ren = out.find((c) => c.tipo === "renovacion_sugerida");
    expect(ren).toBeDefined();
    expect(ren?.origen_id).toBe("c1:renovacion");
    expect(ren?.prioridad).toBe(1);
  });

  it("no emite renovación sugerida si ya está confirmada", () => {
    const out = generarRecordatorios({
      ...base(),
      now: new Date(2026, 5, 4),
      contratos: [
        {
          id: "c1",
          fecha_inicio: "2023-01-01",
          fecha_fin: "2026-01-01",
          estado: "vigente",
          prorroga_anos: 2,
          renovacion_automatica: true,
          renovacion_confirmada_at: "2026-01-15",
        },
      ],
    });
    expect(out.filter((c) => c.tipo === "renovacion_sugerida")).toHaveLength(0);
  });
});