import { describe, it, expect } from "vitest";
import {
  calcularAmortizacion,
  aplicaReduccion60,
  calcularRendimientoFiscal,
} from "../amortizacionReduccion";

describe("calcularAmortizacion", () => {
  it("usa valor_catastral_construccion si está informado (3%)", () => {
    const r = calcularAmortizacion({ valor_catastral_construccion: 100000, valor_compra: 200000 });
    expect(r.valorConstruccion).toBe(100000);
    expect(r.amortizacionAnual).toBeCloseTo(3000, 2);
    expect(r.fuente).toBe("catastral_construccion");
    expect(r.requiereValorCompra).toBe(false);
  });

  it("aproxima con valor_compra * 0.7 cuando no hay catastral construcción", () => {
    const r = calcularAmortizacion({ valor_compra: 200000 });
    expect(r.valorConstruccion).toBeCloseTo(140000, 2);
    expect(r.amortizacionAnual).toBeCloseTo(4200, 2);
    expect(r.fuente).toBe("valor_compra_estimado");
  });

  it("devuelve 0 + flag cuando falta toda la información", () => {
    const r = calcularAmortizacion({});
    expect(r.amortizacionAnual).toBe(0);
    expect(r.requiereValorCompra).toBe(true);
    expect(r.fuente).toBe("ninguno");
  });

  it("ignora valores no numéricos o negativos", () => {
    const r = calcularAmortizacion({ valor_compra: -1 as any });
    expect(r.amortizacionAnual).toBe(0);
    expect(r.requiereValorCompra).toBe(true);
  });
});

describe("aplicaReduccion60", () => {
  it("aplica para 'habitual'", () => {
    expect(aplicaReduccion60("habitual")).toBe(true);
    expect(aplicaReduccion60("larga_duracion")).toBe(true);
  });
  it("no aplica para vacacional/oficina/local/temporada/garaje/trastero", () => {
    for (const t of ["vacacional", "oficina", "local", "temporada", "garaje", "trastero", "otro", "rent_to_rent", "habitaciones"]) {
      expect(aplicaReduccion60(t)).toBe(false);
    }
  });
  it("falsy → no aplica", () => {
    expect(aplicaReduccion60(null)).toBe(false);
    expect(aplicaReduccion60(undefined)).toBe(false);
    expect(aplicaReduccion60("")).toBe(false);
  });
});

describe("calcularRendimientoFiscal", () => {
  it("aplica reducción del 60% sólo si procede y bruto > 0", () => {
    const r = calcularRendimientoFiscal({
      ingresosDeclarables: 12000,
      gastosDeducibles: 2000,
      amortizacionAnual: 1000,
      aplicaReduccion: true,
    });
    expect(r.rendimientoNetoBruto).toBe(9000);
    expect(r.reduccion).toBeCloseTo(5400, 2);
    expect(r.rendimientoNetoReducido).toBeCloseTo(3600, 2);
    expect(r.baseLiquidableEstimada).toBeCloseTo(3600, 2);
  });

  it("no aplica reducción si el contrato no es habitual", () => {
    const r = calcularRendimientoFiscal({
      ingresosDeclarables: 12000,
      gastosDeducibles: 2000,
      amortizacionAnual: 1000,
      aplicaReduccion: false,
    });
    expect(r.reduccion).toBe(0);
    expect(r.rendimientoNetoReducido).toBe(9000);
  });

  it("no aplica reducción cuando el rendimiento bruto es negativo", () => {
    const r = calcularRendimientoFiscal({
      ingresosDeclarables: 1000,
      gastosDeducibles: 2000,
      amortizacionAnual: 500,
      aplicaReduccion: true,
    });
    expect(r.rendimientoNetoBruto).toBe(-1500);
    expect(r.reduccion).toBe(0);
    expect(r.rendimientoNetoReducido).toBe(-1500);
  });
});