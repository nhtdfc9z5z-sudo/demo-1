import { describe, it, expect } from "vitest";
import { calcularAnualidadesActivas } from "../anualidades";

describe("calcularAnualidadesActivas", () => {
  it("emite la próxima anualidad dentro del horizonte de 90 días", () => {
    // Inicio 2024-01-01. now = 2026-10-15 → próximo aniversario 2027-01-01
    // (78 días). Está dentro del horizonte 90 → emite N=3.
    const out = calcularAnualidadesActivas({
      fechaInicio: "2024-01-01",
      now: new Date(2026, 9, 15),
    });
    expect(out).toHaveLength(1);
    expect(out[0].n).toBe(3);
    expect(out[0].fechaAniversario).toBe("2027-01-01");
  });

  it("no emite nada si el próximo aniversario está a más de 90 días", () => {
    const out = calcularAnualidadesActivas({
      fechaInicio: "2024-01-01",
      now: new Date(2026, 2, 1), // 01-Mar-2026 → próximo aniversario 01-Ene-2027 (~306 días)
    });
    expect(out).toHaveLength(0);
  });

  it("respeta fecha_fin: no emite anualidades posteriores", () => {
    const out = calcularAnualidadesActivas({
      fechaInicio: "2024-01-01",
      fechaFin: "2025-12-31",
      now: new Date(2026, 9, 15),
    });
    expect(out).toHaveLength(0);
  });

  it("mantiene un aviso recién pasado (≤ 30 días)", () => {
    const out = calcularAnualidadesActivas({
      fechaInicio: "2024-01-01",
      now: new Date(2026, 0, 10), // 10-Ene-2026, aniversario fue 01-Ene-2026
    });
    expect(out.map((a) => a.n)).toContain(2);
  });
});