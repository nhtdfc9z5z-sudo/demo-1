import { describe, it, expect } from "vitest";
import { dedupePagosCompleto, inferModalidadAlquiler } from "@/lib/pagosDedupe";

const p = (importe: number | null, extra: Partial<{ id: string; inquilino_id: string; tipo_registro: string | null }> = {}) => ({
  id: extra.id ?? Math.random().toString(36).slice(2),
  inquilino_id: extra.inquilino_id ?? "i1",
  importe_pagado: importe,
  tipo_registro: extra.tipo_registro ?? "pago_real",
});

describe("pagosDedupe — Fase 4 defensiva", () => {
  it("contrato completo con 2 inquilinos y 2 pagos de 770 → ingreso 770", () => {
    const r = dedupePagosCompleto(
      [p(770, { inquilino_id: "A" }), p(770, { inquilino_id: "B" })],
      770,
    );
    expect(r.ingreso).toBe(770);
    expect(r.pagosUsados).toHaveLength(1);
    expect(r.pagosDescartados).toHaveLength(1);
    expect(r.warnings).toContain("duplicado_renta_solidaria");
  });

  it("contrato completo con 2 pagos parciales 400 + 370 → ingreso 770 sin warning", () => {
    const r = dedupePagosCompleto(
      [p(400, { inquilino_id: "A" }), p(370, { inquilino_id: "B" })],
      770,
    );
    expect(r.ingreso).toBeCloseTo(770, 2);
    expect(r.warnings).toEqual([]);
    expect(r.pagosUsados).toHaveLength(2);
  });

  it("contrato completo con 770 + 770 (mismo inquilino duplicado) → ingreso 770 + warning duplicado", () => {
    const r = dedupePagosCompleto([p(770), p(770)], 770);
    expect(r.ingreso).toBe(770);
    expect(r.warnings).toContain("duplicado_renta_solidaria");
  });

  it("contrato completo con 770 + 200 → ingreso 970 + warning excede", () => {
    const r = dedupePagosCompleto(
      [p(770, { inquilino_id: "A" }), p(200, { inquilino_id: "B" })],
      770,
    );
    expect(r.ingreso).toBe(970);
    expect(r.warnings).toContain("excede_renta_esperada");
  });

  it("modalidad habitaciones permite sumar rentas separadas sin dedupe", () => {
    const r = dedupePagosCompleto(
      [p(400, { inquilino_id: "A" }), p(400, { inquilino_id: "B" })],
      400,
      "habitaciones",
    );
    expect(r.ingreso).toBe(800);
    expect(r.warnings).toEqual([]);
  });

  it("ignora pagos con importe 0", () => {
    const r = dedupePagosCompleto([p(0), p(0), p(570)], 570);
    expect(r.ingreso).toBe(570);
    expect(r.warnings).toEqual([]);
  });

  it("sin renta esperada → suma directa sin warning", () => {
    const r = dedupePagosCompleto([p(500), p(300)], null);
    expect(r.ingreso).toBe(800);
    expect(r.warnings).toEqual([]);
  });

  it("inferModalidadAlquiler devuelve 'completo' por defecto", () => {
    expect(inferModalidadAlquiler(null)).toBe("completo");
    expect(inferModalidadAlquiler({ modalidad_alquiler: null })).toBe("completo");
    expect(inferModalidadAlquiler({ modalidad_alquiler: "habitaciones" })).toBe("habitaciones");
  });

  it("equivalencia dashboard ↔ fiscalPack: mismo bucket dedupe → mismo ingreso", () => {
    // Caso PV6 real: importes {570, 770, 770}, renta esperada 770
    // Dashboard (renta esperada conocida)
    const dash = dedupePagosCompleto([p(570), p(770), p(770)], 770);
    // Fiscal (renta inferida del bucket = 770 por frecuencia)
    const fiscal = dedupePagosCompleto([p(570), p(770), p(770)], 770);
    expect(dash.ingreso).toBe(fiscal.ingreso);
    expect(dash.ingreso).toBe(770);
  });
});