import { describe, it, expect } from "vitest";
import { computeMonthData } from "@/lib/finanzasEngine";
import { resolveRentaEsperada, type RentaTramo } from "@/lib/rentaUtils";
import type { PagoRenta } from "@/hooks/usePagosRenta";

/**
 * H2.5 — Regresión de la "deuda fantasma".
 *
 * Caso: contrato dado de alta con renta inicial 570 € y actualización
 * posterior a 770 €. El dashboard NO debe inventar deuda de 200 €/mes
 * en los meses anteriores a la actualización.
 */

const prop: any = { id: "prop-1", nombre_interno: "Piso", cuota_comunidad: null, seguros: [] };
const inquilino: any = {
  id: "inq-1",
  property_id: "prop-1",
  rol_inquilino: "inquilino",
  fecha_entrada: "2025-01-01",
  fecha_salida: null,
  renta_mensual: null,
};
const contrato: any = {
  id: "c-1",
  property_id: "prop-1",
  inquilino_id: "inq-1",
  archivado: false,
  estado: "vigente",
  renta_mensual: 770, // renta vigente cacheada (tras actualización)
  fecha_inicio: "2025-01-01",
  fecha_fin: null,
};
const tramos: RentaTramo[] = [
  { fecha_efectiva: "2026-01-01", importe_nuevo: 770, importe_anterior: 570 },
];
const tramosByProperty = new Map<string, RentaTramo[]>([[prop.id, tramos]]);

function pagoReal(mes: number, anio: number, importe = 570): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: "prop-1",
    inquilino_id: "inq-1",
    mes, anio,
    importe_pagado: importe,
    tipo_pago: "transferencia",
    propietario_confirmado: true,
    propietario_confirmado_at: new Date().toISOString(),
    inquilino_notificado: false,
    inquilino_notificado_at: null,
    notas_acuerdo: null,
    user_id: "u-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: `${anio}-${String(mes).padStart(2, "0")}-01`,
    fecha_pago_real: `${anio}-${String(mes).padStart(2, "0")}-05`,
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
  } as PagoRenta;
}

describe("H2.5 — dashboard sin deuda fantasma (570→770)", () => {
  it("resolveRentaEsperada devuelve 570 para meses pre-actualización cuando se pasan tramos", () => {
    expect(
      resolveRentaEsperada(prop.id, [inquilino], [contrato], {
        actualizaciones: tramos, mes: 6, anio: 2025,
      })
    ).toBe(570);
    expect(
      resolveRentaEsperada(prop.id, [inquilino], [contrato], {
        actualizaciones: tramos, mes: 1, anio: 2026,
      })
    ).toBe(770);
  });

  it("resolveRentaEsperada SIN tramos cae a contrato.renta_mensual (legacy → produce deuda fantasma)", () => {
    // Documenta el comportamiento previo: sin tramos, todos los meses usan 770.
    expect(resolveRentaEsperada(prop.id, [inquilino], [contrato])).toBe(770);
  });

  it("computeMonthData con tramos: pago real de 570 = ingreso 570 en mes pre-actualización", () => {
    const pagos = [pagoReal(6, 2025, 570)];
    const r = computeMonthData(2025, 5, [prop], [inquilino], pagos, undefined, [contrato], undefined, tramosByProperty);
    // El dedupe cap a la renta esperada (que ahora es 570, no 770).
    expect(r.ingresos).toBe(570);
  });

  it("computeMonthData con tramos: pago real de 770 en mes posterior = ingreso 770", () => {
    const pagos = [pagoReal(2, 2026, 770)];
    const r = computeMonthData(2026, 1, [prop], [inquilino], pagos, undefined, [contrato], undefined, tramosByProperty);
    expect(r.ingresos).toBe(770);
  });
});
