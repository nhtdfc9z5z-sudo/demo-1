/**
 * Sprint 2.5 — Integration tests del flujo fiscal completo.
 *
 * Cubre escenarios end-to-end mínimos sobre `buildOwnerPack`
 * (la única fuente de verdad fiscal):
 *  - contrato vigente + pagos + gastos + factura → pack correcto
 *  - multi-año con imputación por `fecha_devengo`
 *  - porcentajes fiscales incompletos/excedidos → revisión, NO bloqueo
 *  - exportación PDF/Excel no rompe
 *  - invalidación React Query tras mutation fiscal relevante
 */
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { buildOwnerPack } from "@/lib/fiscalPack";
import { buildFiscalPackWorkbook, generateFiscalPackPdf } from "@/lib/fiscalPackExport";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { validarPorcentajesFiscales, type PersonaContrato } from "@/lib/contratoRoles";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const PROP = { id: "P1", nombre_interno: "Piso Centro", referencia_catastral: "REF-1" };

function pago(p: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: PROP.id,
    inquilino_id: "inq-1",
    mes: 1, anio: 2024,
    inquilino_notificado: true, inquilino_notificado_at: null,
    propietario_confirmado: true, propietario_confirmado_at: null,
    importe_pagado: 1000, tipo_pago: "transferencia", notas_acuerdo: null,
    user_id: "u", created_at: "", updated_at: "",
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: "2024-01-01",
    fecha_pago_real: "2024-01-05",
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    ...p,
  };
}

describe("Fiscal integration · contrato vigente + pagos + gastos + factura", () => {
  it("produce un pack fiscal coherente (ingresos − gastos = neto)", () => {
    const pagos = Array.from({ length: 12 }, (_, i) =>
      pago({ mes: i + 1, fecha_devengo: `2024-${String(i + 1).padStart(2, "0")}-01`, importe_pagado: 1000 }),
    );
    const gastos = [
      { id: "g-ibi", property_id: PROP.id, categoria: "ibi", concepto: "IBI 2024", importe: 400, fecha: "2024-06-01" },
      { id: "g-com", property_id: PROP.id, categoria: "comunidad", concepto: "Comunidad", importe: 600, fecha: "2024-03-10" },
    ];
    const facturas = [
      { id: "f-rep", property_id: PROP.id, emisor_nombre: "Fontanero", total: 250, fecha: "2024-09-01", categoria: "reparaciones", deducible_irpf: true },
    ];
    const pack = buildOwnerPack({ properties: [PROP], pagos, gastos, facturas }, 2024);
    expect(pack.totalIngresosDeclarables).toBe(12000);
    expect(pack.totalGastosDeducibles).toBe(1250);
    expect(pack.totalNeto).toBe(10750);
    expect(pack.propiedades).toHaveLength(1);
    expect(pack.propiedades[0].mesesPendientes).toEqual([]);
  });
});

describe("Fiscal integration · multi-año con fecha_devengo", () => {
  it("imputa cada cobro al ejercicio de devengo, no al de cobro real", () => {
    const pagos = [
      // Diciembre 2024 cobrado en enero 2025 → ejercicio 2024
      pago({ mes: 12, anio: 2024, fecha_devengo: "2024-12-01", fecha_pago_real: "2025-01-08", importe_pagado: 900 }),
      // Enero 2025 cobrado en enero 2025 → ejercicio 2025
      pago({ mes: 1, anio: 2025, fecha_devengo: "2025-01-01", fecha_pago_real: "2025-01-20", importe_pagado: 950 }),
      // Histórico no fiscal → no cuenta en ningún año
      pago({ mes: 5, anio: 2024, fecha_devengo: "2024-05-01", tipo_registro: "historico_reconstruido", afecta_fiscalidad: false, importe_pagado: 500 }),
    ];
    const pack2024 = buildOwnerPack({ properties: [PROP], pagos, gastos: [], facturas: [] }, 2024);
    const pack2025 = buildOwnerPack({ properties: [PROP], pagos, gastos: [], facturas: [] }, 2025);
    expect(pack2024.totalIngresosDeclarables).toBe(900);
    expect(pack2025.totalIngresosDeclarables).toBe(950);
  });
});

describe("Fiscal integration · porcentajes fiscales", () => {
  const p = (o: Partial<PersonaContrato>): PersonaContrato =>
    ({ rol: "arrendador", nombre: "X", afecta_fiscalidad: true, ...o } as PersonaContrato);

  it("incompletos generan revisión (no bloqueo)", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 60, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 30, dni: "2B" }),
    ]);
    expect(r.status).toBe("incompleto");
    expect(r.mensaje).toBeTruthy();
    // El pack se sigue construyendo: nada bloquea
    const pack = buildOwnerPack({ properties: [PROP], pagos: [pago({ importe_pagado: 800 })], gastos: [], facturas: [] }, 2024);
    expect(pack.totalIngresosDeclarables).toBe(800);
  });

  it("excedidos generan revisión (no bloqueo)", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 70, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 50, dni: "2B" }),
    ]);
    expect(r.status).toBe("excedido");
    const pack = buildOwnerPack({ properties: [PROP], pagos: [pago({ importe_pagado: 1000 })], gastos: [], facturas: [] }, 2024);
    expect(pack.totalIngresosDeclarables).toBe(1000);
  });
});

describe("Fiscal integration · exportaciones", () => {
  it("PDF y Excel se generan sin romper", async () => {
    const pack = buildOwnerPack(
      { properties: [PROP], pagos: [pago({ importe_pagado: 1000 })], gastos: [], facturas: [] },
      2024,
    );
    const wb = await buildFiscalPackWorkbook(pack);
    expect(wb.SheetNames.length).toBeGreaterThan(0);
    const pdf = await generateFiscalPackPdf(pack);
    expect(pdf.size).toBeGreaterThan(500);
    expect(pdf.type).toContain("pdf");
  });
});

describe("Fiscal integration · invalidación React Query", () => {
  it("invalidateFiscalChain marca como stale todas las queries fiscales", () => {
    const qc = new QueryClient();
    const keys = [
      ["contrato-personas", "c1"],
      ["fiscal-pack", 2024],
      ["fiscal-data", 2024],
      ["pagos_renta"],
      ["gastos"],
      ["facturas"],
      ["contratos"],
    ];
    keys.forEach(k => qc.setQueryData(k, { stub: true }));
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateFiscalChain(qc);
    expect(spy).toHaveBeenCalledTimes(keys.length);
  });
});