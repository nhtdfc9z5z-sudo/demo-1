import { describe, it, expect } from "vitest";
import { groupPagosPorContrato, LEGACY_GROUP_KEY, dedupePagosCompleto } from "@/lib/pagosDedupe";

const mk = (
  contrato_id: string | null,
  inquilino_id: string,
  importe: number,
  tipo: string = "pago_real",
) => ({ id: `${contrato_id}-${inquilino_id}-${importe}-${tipo}`, contrato_id, inquilino_id, importe_pagado: importe, tipo_registro: tipo });

describe("Sprint 3 — agrupación por contrato_id", () => {
  it("contrato completo con 3 inquilinos solidarios genera 1 ingreso/mes", () => {
    const pagos = [
      mk("c1", "A", 700),
      mk("c1", "B", 700),
      mk("c1", "C", 700),
    ];
    const grupos = groupPagosPorContrato(pagos);
    expect(grupos.size).toBe(1);
    const dd = dedupePagosCompleto(grupos.get("c1")!, 700, "completo");
    expect(dd.ingreso).toBe(700);
    expect(dd.warnings).toContain("duplicado_renta_solidaria");
  });

  it("modalidad habitaciones permite varios pagos del mismo mes", () => {
    const pagos = [mk("c1", "A", 400), mk("c1", "B", 350)];
    const dd = dedupePagosCompleto(pagos, 400, "habitaciones");
    expect(dd.ingreso).toBe(750);
    expect(dd.warnings).toEqual([]);
  });

  it("pagos sin contrato_id van al bucket legacy (fallback Fase 4)", () => {
    const pagos = [mk(null, "A", 500), mk("c1", "B", 500)];
    const grupos = groupPagosPorContrato(pagos);
    expect(grupos.get(LEGACY_GROUP_KEY)).toHaveLength(1);
    expect(grupos.get("c1")).toHaveLength(1);
  });

  it("pagos duplicados solidarios se detectan por contrato", () => {
    const pagos = [mk("c1", "A", 770), mk("c1", "B", 770)];
    const dd = dedupePagosCompleto(pagos, 770, "completo");
    expect(dd.ingreso).toBe(770);
    expect(dd.warnings).toContain("duplicado_renta_solidaria");
    expect(dd.pagosDescartados).toHaveLength(1);
  });

  it("dos contratos distintos en la misma propiedad no se mezclan", () => {
    const pagos = [
      mk("c1", "A", 700),
      mk("c1", "B", 700),
      mk("c2", "C", 500),
    ];
    const grupos = groupPagosPorContrato(pagos);
    expect(grupos.size).toBe(2);
    const dd1 = dedupePagosCompleto(grupos.get("c1")!, 700, "completo");
    const dd2 = dedupePagosCompleto(grupos.get("c2")!, 500, "completo");
    expect(dd1.ingreso + dd2.ingreso).toBe(1200);
  });
});