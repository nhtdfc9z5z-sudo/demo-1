import { describe, it, expect } from "vitest";
import {
  getRentaEnPeriodo,
  calcularImporteEsperado,
  type RentaTramo,
} from "@/lib/rentaUtils";

describe("rentaUtils — renta por tramos (Sprint 3 modelo unificado)", () => {
  describe("getRentaEnPeriodo", () => {
    it("sin tramos → devuelve fallback (backfill: renta cacheada del contrato)", () => {
      expect(getRentaEnPeriodo([], 6, 2024, 750)).toBe(750);
      expect(getRentaEnPeriodo(null, 6, 2024, 750)).toBe(750);
      expect(getRentaEnPeriodo(undefined, 6, 2024, 750)).toBe(750);
    });

    it("periodo anterior al primer tramo → fallback (no inventa renta nueva hacia atrás)", () => {
      const tramos: RentaTramo[] = [
        { fecha_efectiva: "2026-01-01", importe_nuevo: 770 },
      ];
      expect(getRentaEnPeriodo(tramos, 12, 2025, 750)).toBe(750);
      expect(getRentaEnPeriodo(tramos, 5, 2023, 750)).toBe(750);
    });

    it("periodo posterior al tramo → aplica el tramo vigente", () => {
      const tramos: RentaTramo[] = [
        { fecha_efectiva: "2026-01-01", importe_nuevo: 770 },
      ];
      expect(getRentaEnPeriodo(tramos, 1, 2026, 750)).toBe(770);
      expect(getRentaEnPeriodo(tramos, 6, 2026, 750)).toBe(770);
    });

    it("varios tramos → aplica el más reciente anterior al periodo", () => {
      const tramos: RentaTramo[] = [
        { fecha_efectiva: "2024-01-01", importe_nuevo: 760 },
        { fecha_efectiva: "2026-01-01", importe_nuevo: 770 },
      ];
      expect(getRentaEnPeriodo(tramos, 12, 2023, 750)).toBe(750);
      expect(getRentaEnPeriodo(tramos, 6, 2024, 750)).toBe(760);
      expect(getRentaEnPeriodo(tramos, 12, 2025, 750)).toBe(760);
      expect(getRentaEnPeriodo(tramos, 1, 2026, 750)).toBe(770);
    });

    it("acepta tramos desordenados", () => {
      const tramos: RentaTramo[] = [
        { fecha_efectiva: "2026-01-01", importe_nuevo: 770 },
        { fecha_efectiva: "2024-01-01", importe_nuevo: 760 },
      ];
      expect(getRentaEnPeriodo(tramos, 6, 2024, 750)).toBe(760);
      expect(getRentaEnPeriodo(tramos, 1, 2026, 750)).toBe(770);
    });
  });

  describe("Caso obligatorio: Mayo 2023 @ 750€ → Enero 2026 @ 770€", () => {
    const tramos: RentaTramo[] = [
      // Auto-creado por addModificacion: guarda importe_anterior (750)
      { fecha_efectiva: "2026-01-01", importe_nuevo: 770, importe_anterior: 750 },
    ];
    const fechaInicio = "2023-05-01";
    const fechaFin = null;
    const rentaCacheActual = 770; // contrato.renta_mensual (cacheada)

    it("NO genera deuda histórica 2023–2025 (esperado mensual = 750)", () => {
      // Recorrer todos los meses desde mayo 2023 a diciembre 2025 → esperado 750
      const periodos: Array<[number, number]> = [];
      for (let a = 2023; a <= 2025; a++) {
        const inicioMes = a === 2023 ? 5 : 1;
        for (let m = inicioMes; m <= 12; m++) periodos.push([m, a]);
      }
      for (const [mes, anio] of periodos) {
        const esp = calcularImporteEsperado(rentaCacheActual, mes, anio, fechaInicio, fechaFin, tramos);
        expect(esp.importe, `mes ${mes}/${anio}`).toBe(750);
        expect(esp.rentaMensual, `renta de referencia ${mes}/${anio}`).toBe(750);
      }
    });

    it("Desde enero 2026 esperado mensual = 770", () => {
      for (let m = 1; m <= 12; m++) {
        const esp = calcularImporteEsperado(rentaCacheActual, m, 2026, fechaInicio, fechaFin, tramos);
        expect(esp.importe, `mes ${m}/2026`).toBe(770);
      }
    });

    it("Si NO pasamos tramos (caller legacy) → cae a rentaMensual (sin regresión)", () => {
      const esp = calcularImporteEsperado(770, 6, 2024, fechaInicio, fechaFin);
      expect(esp.importe).toBe(770);
    });

    it("Si el tramo NO tiene importe_anterior y no hay tramo previo → fallback a renta cacheada (backfill seguro)", () => {
      const tramosSinAnterior: RentaTramo[] = [
        { fecha_efectiva: "2026-01-01", importe_nuevo: 770 },
      ];
      // Bajo backfill, asumimos que la renta cacheada (770) ha sido constante
      // → NO se genera deuda falsa, simplemente no podemos detectar el escalón.
      // Es responsabilidad del registro de la modificación traer importe_anterior.
      const esp = calcularImporteEsperado(770, 6, 2024, fechaInicio, fechaFin, tramosSinAnterior);
      expect(esp.importe).toBe(770);
    });
  });

  describe("Compatibilidad con prorrateo de altas/bajas", () => {
    it("alta a mitad de mes con tramo aplicable → prorratea sobre la renta del tramo", () => {
      const tramos: RentaTramo[] = [{ fecha_efectiva: "2024-01-01", importe_nuevo: 800 }];
      // Alta el 16 de enero → 16 días ocupados de 31
      const esp = calcularImporteEsperado(800, 1, 2024, "2024-01-16", null, tramos);
      expect(esp.esProrrata).toBe(true);
      expect(esp.diasOcupados).toBe(16);
      expect(esp.diasMes).toBe(31);
      expect(esp.importe).toBeCloseTo(800 * 16 / 31, 2);
    });
  });
});