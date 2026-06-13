import { describe, it, expect } from "vitest";
import { calcularNuevaRenta } from "@/lib/contratos/revisionRenta";
import { calcularNuevaFechaFin } from "@/lib/contratos/renovacionContrato";

describe("calcularNuevaRenta", () => {
  it("aplica IPC", () => {
    expect(calcularNuevaRenta(900, "ipc", 3.1)).toBe(927.9);
  });
  it("aplica incremento personalizado", () => {
    expect(calcularNuevaRenta(1000, "personalizado", 5)).toBe(1050);
  });
  it("sin_cambio devuelve la renta tal cual", () => {
    expect(calcularNuevaRenta(900, "sin_cambio", 10)).toBe(900);
  });
  it("porcentaje nulo no rompe", () => {
    expect(calcularNuevaRenta(800, "ipc", null)).toBe(800);
  });
});

describe("calcularNuevaFechaFin", () => {
  it("suma años respetando el día", () => {
    expect(calcularNuevaFechaFin("2027-01-01", 1)).toBe("2028-01-01");
    expect(calcularNuevaFechaFin("2025-06-15", 3)).toBe("2028-06-15");
  });
  it("prórroga 0 deja la misma fecha", () => {
    expect(calcularNuevaFechaFin("2027-01-01", 0)).toBe("2027-01-01");
  });
});