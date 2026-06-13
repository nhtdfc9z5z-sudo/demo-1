import { describe, it, expect } from "vitest";
import {
  buildReconciliacion,
  type PagoForReconciliacion,
  type ContratoForReconciliacion,
} from "@/lib/sprint3/reconciliacion";

const C: ContratoForReconciliacion = {
  id: "c1",
  property_id: "p1",
  inquilino_id: "tit",
  renta_mensual: 770,
  fecha_inicio: "2024-01-01",
  fecha_fin: null,
};

const real = (overrides: Partial<PagoForReconciliacion> = {}): PagoForReconciliacion => ({
  id: crypto.randomUUID(),
  property_id: "p1",
  inquilino_id: "tit",
  contrato_id: "c1",
  mes: 5,
  anio: 2026,
  importe_pagado: 770,
  tipo_registro: "pago_real",
  afecta_finanzas_actuales: true,
  afecta_fiscalidad: true,
  ...overrides,
});

describe("buildReconciliacion", () => {
  it("detecta duplicado_real cuando hay dos pagos reales >0 en el mismo periodo", () => {
    const pagos = [real({ id: "a" }), real({ id: "b", inquilino_id: "sol" })];
    const s = buildReconciliacion(pagos, [C], {}, { c1: ["sol"] });
    expect(s.duplicado_real).toHaveLength(1);
    expect(s.duplicado_real[0].pago_ids.sort()).toEqual(["a", "b"]);
  });

  it("NO duplicado cuando es un pago real único", () => {
    const s = buildReconciliacion([real({ id: "x" })], [C]);
    expect(s.duplicado_real).toHaveLength(0);
  });

  it("detecta historico_fiscal_coincide (caso PV6 570 vs 770)", () => {
    const pagos = [
      real({ id: "real", importe_pagado: 770 }),
      real({
        id: "hist",
        importe_pagado: 570,
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
        afecta_fiscalidad: true,
      }),
    ];
    const s = buildReconciliacion(pagos, [C]);
    expect(s.historico_fiscal_coincide).toHaveLength(1);
    expect(s.historico_fiscal_coincide[0].pago_ids[0]).toBe("hist");
  });

  it("no marca historico_fiscal_coincide si afecta_fiscalidad=false", () => {
    const pagos = [
      real({ id: "real" }),
      real({
        id: "hist",
        importe_pagado: 570,
        tipo_registro: "historico_reconstruido",
        afecta_fiscalidad: false,
      }),
    ];
    const s = buildReconciliacion(pagos, [C]);
    expect(s.historico_fiscal_coincide).toHaveLength(0);
  });

  it("detecta pago_cero_solidario", () => {
    const pagos = [
      real({ id: "titular", inquilino_id: "tit", importe_pagado: 770 }),
      real({ id: "solidario_zero", inquilino_id: "sol", importe_pagado: 0 }),
    ];
    const s = buildReconciliacion(pagos, [C], {}, { c1: ["sol"] });
    expect(s.pago_cero_solidario).toHaveLength(1);
    expect(s.pago_cero_solidario[0].pago_ids[0]).toBe("solidario_zero");
  });

  it("detecta excede_renta con tolerancia 5%", () => {
    const pagos = [
      real({ id: "a", importe_pagado: 770, inquilino_id: "tit" }),
      real({ id: "b", importe_pagado: 200, inquilino_id: "sol" }),
    ];
    const s = buildReconciliacion(pagos, [C], {}, { c1: ["sol"] });
    expect(s.excede_renta).toHaveLength(1);
    expect(s.excede_renta[0].detalle.suma_real).toBe(970);
    expect(s.excede_renta[0].detalle.renta_esperada).toBe(770);
  });

  it("NO marca excede_renta dentro de la tolerancia", () => {
    const pagos = [real({ importe_pagado: 800 })]; // 800 < 770*1.05=808.5
    const s = buildReconciliacion(pagos, [C]);
    expect(s.excede_renta).toHaveLength(0);
  });

  it("detecta sin_contrato_id", () => {
    const pagos = [real({ id: "huerfano", contrato_id: null })];
    const s = buildReconciliacion(pagos, [C]);
    expect(s.sin_contrato_id).toHaveLength(1);
    expect(s.sin_contrato_id[0].pago_ids).toEqual(["huerfano"]);
  });

  it("no mezcla pagos de contratos distintos", () => {
    const C2 = { ...C, id: "c2" };
    const pagos = [
      real({ id: "a", contrato_id: "c1" }),
      real({ id: "b", contrato_id: "c2" }),
    ];
    const s = buildReconciliacion(pagos, [C, C2]);
    expect(s.duplicado_real).toHaveLength(0);
  });
});

// Smoke test del contrato del hook (sin BD): la decisión 'kept' sobre
// duplicado_real debe ser rechazada para evitar aceptar duplicados
// económicos silenciosamente. Se ejerce la validación en línea aquí.
describe("reconciliación · validaciones de decisión", () => {
  it("kept sobre duplicado_real está prohibido", () => {
    const item = {
      categoria: "duplicado_real" as const,
      pago_ids: ["a", "b"],
      property_id: "p1", contrato_id: "c1", mes: 5, anio: 2026,
      motivo: "", detalle: { importes: [770, 770], tipos: ["pago_real" as const, "pago_real" as const] },
    };
    // Replicamos la guard del hook
    const guard = (cat: string, dec: string) => {
      if (dec === "kept" && cat === "duplicado_real") throw new Error("prohibido");
      if (dec === "invalidated_duplicate" && cat !== "duplicado_real") throw new Error("prohibido");
    };
    expect(() => guard(item.categoria, "kept")).toThrow();
    expect(() => guard(item.categoria, "invalidated_duplicate")).not.toThrow();
    expect(() => guard("historico_fiscal_coincide", "invalidated_duplicate")).toThrow();
  });
});
