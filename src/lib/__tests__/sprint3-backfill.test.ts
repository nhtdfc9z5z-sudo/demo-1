import { describe, it, expect } from "vitest";
import {
  classifyPagoForBackfill,
  buildBackfillSummary,
  type ContratoForBackfill,
  type PagoForBackfill,
} from "@/lib/sprint3/backfillContratoId";

const baseContrato: ContratoForBackfill = {
  id: "c1",
  property_id: "p1",
  inquilino_id: "i1",
  fecha_inicio: "2024-01-01",
  fecha_fin: null,
  archivado: false,
};

const pago = (overrides: Partial<PagoForBackfill> = {}): PagoForBackfill => ({
  id: "pago-x",
  property_id: "p1",
  inquilino_id: "i1",
  mes: 5,
  anio: 2026,
  contrato_id: null,
  ...overrides,
});

describe("classifyPagoForBackfill", () => {
  it("ya_asignado cuando el pago ya tiene contrato_id", () => {
    const r = classifyPagoForBackfill(pago({ contrato_id: "cX" }), [baseContrato]);
    expect(r.status).toBe("ya_asignado");
  });

  it("error_input si falta property_id o inquilino_id", () => {
    expect(classifyPagoForBackfill(pago({ property_id: null }), [baseContrato]).status)
      .toBe("error_input");
    expect(classifyPagoForBackfill(pago({ inquilino_id: null }), [baseContrato]).status)
      .toBe("error_input");
  });

  it("asignable con match único por inquilino titular", () => {
    const r = classifyPagoForBackfill(pago(), [baseContrato]);
    expect(r.status).toBe("asignable");
    expect(r.contrato_id_propuesto).toBe("c1");
  });

  it("asignable cuando el inquilino solo aparece en contrato_personas (solidario)", () => {
    const contrato: ContratoForBackfill = { ...baseContrato, inquilino_id: "titular" };
    const r = classifyPagoForBackfill(pago({ inquilino_id: "i1" }), [contrato], { c1: ["i1"] });
    expect(r.status).toBe("asignable");
    expect(r.contrato_id_propuesto).toBe("c1");
  });

  it("sin_contrato cuando no hay vigente en ese mes", () => {
    const cerrado: ContratoForBackfill = { ...baseContrato, fecha_fin: "2025-12-31" };
    const r = classifyPagoForBackfill(pago({ mes: 1, anio: 2026 }), [cerrado]);
    expect(r.status).toBe("sin_contrato");
  });

  it("ambiguo con dos contratos vigentes solapados en el mes", () => {
    const c2: ContratoForBackfill = { ...baseContrato, id: "c2", fecha_inicio: "2026-05-15" };
    const r = classifyPagoForBackfill(pago({ mes: 5, anio: 2026 }), [baseContrato, c2]);
    expect(r.status).toBe("ambiguo");
    expect(r.candidatos.sort()).toEqual(["c1", "c2"]);
    expect(r.contrato_id_propuesto).toBeUndefined();
  });

  it("contrato archivado nunca es candidato", () => {
    const archived = { ...baseContrato, archivado: true };
    const r = classifyPagoForBackfill(pago(), [archived]);
    expect(r.status).toBe("sin_contrato");
  });

  it("buildBackfillSummary cuenta por status", () => {
    const rows = [
      classifyPagoForBackfill(pago({ id: "a" }), [baseContrato]),
      classifyPagoForBackfill(pago({ id: "b", contrato_id: "c1" }), [baseContrato]),
      classifyPagoForBackfill(pago({ id: "c", inquilino_id: null }), [baseContrato]),
      classifyPagoForBackfill(pago({ id: "d", mes: 1, anio: 2020 }), [baseContrato]),
    ];
    const s = buildBackfillSummary(rows);
    expect(s.total).toBe(4);
    expect(s.asignables).toBe(1);
    expect(s.ya_asignados).toBe(1);
    expect(s.errores).toBe(1);
    expect(s.sin_contrato).toBe(1);
    expect(s.ambiguos).toBe(0);
  });
});
