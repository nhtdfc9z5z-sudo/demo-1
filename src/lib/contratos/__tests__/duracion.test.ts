import { describe, it, expect } from "vitest";
import { calcularFechaFin, derivarDuracion } from "../duracion";

describe("calcularFechaFin", () => {
  it("calcula fin = inicio + N años (inclusivo)", () => {
    // 2024-01-01 + 3 años → 2026-12-31
    expect(calcularFechaFin("2024-01-01", 3, "anos")).toBe("2026-12-31");
  });
  it("calcula fin = inicio + N meses", () => {
    expect(calcularFechaFin("2024-01-01", 6, "meses")).toBe("2024-06-30");
  });
  it("devuelve null si la fecha es inválida", () => {
    expect(calcularFechaFin("", 3, "anos")).toBeNull();
  });
  it("devuelve null si n <= 0", () => {
    expect(calcularFechaFin("2024-01-01", 0, "anos")).toBeNull();
  });
});

describe("derivarDuracion", () => {
  it("detecta años exactos", () => {
    expect(derivarDuracion("2024-01-01", "2026-12-31")).toEqual({
      n: 3,
      unidad: "anos",
    });
  });
  it("detecta meses", () => {
    expect(derivarDuracion("2024-01-01", "2024-06-30")).toEqual({
      n: 6,
      unidad: "meses",
    });
  });
  it("devuelve null si faltan datos", () => {
    expect(derivarDuracion(null, "2026-12-31")).toBeNull();
    expect(derivarDuracion("2024-01-01", null)).toBeNull();
  });
  it("round-trip: derivar(inicio, calcular(inicio, n, u)) === {n, u}", () => {
    const fin = calcularFechaFin("2024-01-01", 5, "anos")!;
    expect(derivarDuracion("2024-01-01", fin)).toEqual({ n: 5, unidad: "anos" });
  });
});