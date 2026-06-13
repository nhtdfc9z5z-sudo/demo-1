import { describe, it, expect } from "vitest";
import {
  detectarConflictoPagoCompleto,
  normalizeModalidad,
  type DuplicadoContratoLike,
  type DuplicadoPagoLike,
} from "@/lib/sprint3/duplicadoPagoCompleto";

const baseContrato = (over: Partial<DuplicadoContratoLike> = {}): DuplicadoContratoLike => ({
  id: "c1",
  property_id: "p1",
  inquilino_id: "i1",
  fecha_inicio: "2024-01-01",
  fecha_fin: null,
  archivado: false,
  modalidad_alquiler: "completo",
  ...over,
});

const basePago = (over: Partial<DuplicadoPagoLike> = {}): DuplicadoPagoLike => ({
  id: "pg1",
  property_id: "p1",
  inquilino_id: "i1",
  mes: 5,
  anio: 2026,
  contrato_id: "c1",
  importe_pagado: 770,
  tipo_registro: "pago_real",
  afecta_finanzas_actuales: true,
  ...over,
});

describe("normalizeModalidad", () => {
  it("defaults to completo when null/unknown", () => {
    expect(normalizeModalidad(null)).toBe("completo");
    expect(normalizeModalidad(undefined)).toBe("completo");
    expect(normalizeModalidad("foo")).toBe("completo");
  });
  it("returns habitaciones explicitly", () => {
    expect(normalizeModalidad("habitaciones")).toBe("habitaciones");
  });
});

describe("detectarConflictoPagoCompleto", () => {
  it("returns sin_contrato when no contract covers the month", () => {
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2020,
      contratos: [baseContrato()], pagos: [],
    });
    expect(r.status).toBe("sin_contrato");
  });

  it("returns ambiguo when more than one contract covers the month", () => {
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato({ id: "c1" }), baseContrato({ id: "c2" })],
      pagos: [],
    });
    expect(r.status).toBe("ambiguo");
  });

  it("permits multiple payments when modalidad=habitaciones", () => {
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato({ modalidad_alquiler: "habitaciones" })],
      pagos: [basePago()],
    });
    expect(r.status).toBe("permitido");
    expect(r.modalidad).toBe("habitaciones");
  });

  it("flags duplicado_completo when a pago_real already exists for contrato+mes+anio", () => {
    const existente = basePago();
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato()],
      pagos: [existente],
    });
    expect(r.status).toBe("duplicado_completo");
    expect(r.pagoExistente?.id).toBe("pg1");
    expect(r.modalidad).toBe("completo");
  });

  it("flags duplicado_completo via legacy fallback when pago has no contrato_id", () => {
    const legacy = basePago({ contrato_id: null });
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato()],
      pagos: [legacy],
    });
    expect(r.status).toBe("duplicado_completo");
    expect(r.pagoExistente?.id).toBe("pg1");
  });

  it("does NOT block when only an historico exists (not a real payment)", () => {
    const historico = basePago({
      tipo_registro: "historico_reconstruido",
      afecta_finanzas_actuales: false,
      importe_pagado: 570,
    });
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato()],
      pagos: [historico],
    });
    expect(r.status).toBe("permitido");
  });

  it("considers solidario inquilino via personasPorContrato", () => {
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i2", mes: 5, anio: 2026,
      contratos: [baseContrato({ inquilino_id: "i1" })],
      pagos: [basePago({ inquilino_id: "i2" })],
      personasPorContrato: { c1: ["i2"] },
    });
    expect(r.status).toBe("duplicado_completo");
  });

  it("ignores archived contracts", () => {
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato({ archivado: true })],
      pagos: [basePago()],
    });
    expect(r.status).toBe("sin_contrato");
  });

  it("legacy fallback does NOT trigger when the orphan pago belongs to a different inquilino", () => {
    const otroLegacy = basePago({ contrato_id: null, inquilino_id: "i_otro" });
    const r = detectarConflictoPagoCompleto({
      propertyId: "p1", inquilinoId: "i1", mes: 5, anio: 2026,
      contratos: [baseContrato()],
      pagos: [otroLegacy],
    });
    expect(r.status).toBe("permitido");
  });
});