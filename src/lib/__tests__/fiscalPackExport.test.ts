import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildFiscalPackWorkbook,
  generateFiscalPackPdf,
  EXCEL_SHEETS,
  buildContasolCsv,
  buildA3Csv,
  buildSageCsv,
  buildHoldedCsv,
} from "@/lib/fiscalPackExport";
import { buildOwnerPack } from "@/lib/fiscalPack";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const PROP_A = { id: "A", nombre_interno: "Piso A", referencia_catastral: "REFA" };
const PROP_B = {
  id: "B",
  nombre_interno: "Piso B",
  titularidad: "copropietarios" as const,
  copropietarios: [
    { nombre: "Yo", dni: "12345678Z", porcentaje: 50 },
    { nombre: "Hermana", dni: "87654321X", porcentaje: 50 },
  ],
};

function pago(p: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: PROP_A.id,
    inquilino_id: "i",
    mes: 1, anio: 2024,
    inquilino_notificado: false, inquilino_notificado_at: null,
    propietario_confirmado: true, propietario_confirmado_at: null,
    importe_pagado: 1000, tipo_pago: null, notas_acuerdo: null,
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

function buildBasePack() {
  const pagos = [
    pago({ property_id: "A", fecha_devengo: "2024-01-01", importe_pagado: 1000 }),
    pago({ property_id: "A", fecha_devengo: "2024-02-01", importe_pagado: 1000, mes: 2 }),
    // histórico no fiscal — NO debe aparecer en ingresos
    pago({
      property_id: "A",
      tipo_registro: "historico_reconstruido",
      afecta_fiscalidad: false,
      importe_pagado: 500,
      fecha_devengo: "2024-03-01",
      mes: 3,
    }),
    // pendiente
    pago({ property_id: "A", tipo_registro: "pendiente", importe_pagado: 0, fecha_devengo: "2024-04-01", mes: 4 }),
  ];
  const gastos = [
    { id: "g1", property_id: "A", categoria: "ibi", concepto: "IBI 2024", importe: 300, fecha: "2024-05-15" },
  ];
  return buildOwnerPack(
    { properties: [PROP_A, PROP_B], pagos, gastos, facturas: [] },
    2024,
  );
}

describe("fiscalPackExport · Excel", async () => {
  it("genera exactamente las 5 hojas esperadas", async () => {
    const wb = await buildFiscalPackWorkbook(buildBasePack());
    expect(wb.SheetNames).toEqual([...EXCEL_SHEETS]);
  });

  it("usa los datos del pack sin recalcular (totales coinciden)", async () => {
    const pack = buildBasePack();
    const wb = await buildFiscalPackWorkbook(pack);
    const resumen = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Resumen"], { header: 1 });
    const filaIngresos = resumen.find(r => r[0] === "Ingresos declarables (€)");
    expect(filaIngresos?.[1]).toBe(Math.round((pack.totalIngresosDeclarables + Number.EPSILON) * 100) / 100);
    const filaGastos = resumen.find(r => r[0] === "Gastos deducibles (€)");
    expect(filaGastos?.[1]).toBe(Math.round((pack.totalGastosDeducibles + Number.EPSILON) * 100) / 100);
  });

  it("NO incluye ingresos de históricos con afecta_fiscalidad=false en la hoja mensual", async () => {
    const pack = buildBasePack();
    const wb = await buildFiscalPackWorkbook(pack);
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Ingresos por mes"], { header: 1 });
    const filaA = rows.find(r => r[0] === "Piso A");
    expect(filaA).toBeTruthy();
    // Mar (índice 4+2=6 → MESES start col 4): "Mes" Mar es columna índice 4+2 = 6
    const idxMar = 4 + 2; // tras cabeceras Inmueble, Ref, %, Criterio
    expect(filaA![idxMar]).toBe(0);
  });

  it("incluye porcentaje aplicado en hojas de inmuebles", async () => {
    const pack = buildOwnerPack(
      { properties: [PROP_B], pagos: [pago({ property_id: "B", importe_pagado: 1000 })], gastos: [], facturas: [] },
      2024,
      undefined,
      { ownerKey: "me", me: { nif: "12345678Z" } },
    );
    const wb = await buildFiscalPackWorkbook(pack);
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Ingresos por mes"], { header: 1 });
    const filaB = rows.find(r => r[0] === "Piso B");
    expect(filaB![2]).toBe(50);
  });

  it("incluye aviso legal en la hoja Resumen", async () => {
    const wb = await buildFiscalPackWorkbook(buildBasePack());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Resumen"], { header: 1 });
    const aviso = rows.find(r => r[0] === "Aviso");
    expect(String(aviso?.[1])).toMatch(/CapitalRent/i);
    expect(String(aviso?.[1])).toMatch(/asesor fiscal/i);
  });

  it("la hoja 'Pendientes y regularizaciones' lista los meses pendientes del pack", async () => {
    const pack = buildBasePack();
    const wb = await buildFiscalPackWorkbook(pack);
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Pendientes y regularizaciones"], { header: 1 });
    const pendientes = rows.filter(r => r[1] === "Pendiente");
    expect(pendientes.length).toBe(pack.propiedades.reduce((s, p) => s + p.mesesPendientes.length, 0));
  });
});

describe("fiscalPackExport · PDF", async () => {
  it("genera un Blob de tipo application/pdf no vacío", async () => {
    const blob = await generateFiscalPackPdf(buildBasePack());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain("pdf");
    expect(blob.size).toBeGreaterThan(500);
  });
});

describe("fiscalPackExport · CSV gestores", () => {
  it("Contasol: BOM UTF-8, separador ';' y cabeceras esperadas", () => {
    const csv = buildContasolCsv(buildBasePack());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const first = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(first).toBe("Fecha;Concepto;Debe;Haber;Cuenta");
    // contiene cuenta de ingresos 752 para las rentas
    expect(csv).toMatch(/;752$/m);
  });

  it("A3: incluye cabecera A3 y mismo formato Contasol", () => {
    const csv = buildA3Csv(buildBasePack());
    expect(csv).toMatch(/# A3 Asesor - Export CapitalRent/);
    expect(csv).toMatch(/Fecha;Concepto;Debe;Haber;Cuenta/);
  });

  it("Sage: cabeceras Sage y separador ';'", () => {
    const csv = buildSageCsv(buildBasePack());
    const first = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(first).toBe("Fecha;Ref;Concepto;Importe;IVA;Cuenta;Contrapartida");
  });

  it("Holded: cabeceras Holded y separador ','", () => {
    const csv = buildHoldedCsv(buildBasePack());
    const first = csv.replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(first).toBe("Contact,Date,Description,Amount,Tax,Category");
  });
});