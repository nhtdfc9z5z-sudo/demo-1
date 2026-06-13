import type { Property, InsuranceEntry } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyGasto } from "@/hooks/usePropertyGastos";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { getMonthlyFixedCosts, parseMonthFromFechaPago, isGastoActivoEnMes } from "@/lib/finanzasEngine";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function escapeCSV(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  const csv = bom + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.map(escapeCSV).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export all treasury data for a year */
export function exportTesoreriaCSV(
  year: number,
  properties: Property[],
  inquilinos: Inquilino[],
  pagos: PagoRenta[],
  gastos: PropertyGasto[],
  contratos?: Contrato[],
  incidencias?: Incidencia[]
) {
  const headers = ["Mes", "Vivienda", "Tipo", "Concepto", "Categoría", "Importe (€)"];
  const rows: (string | number | null)[][] = [];

  for (let m = 0; m < 12; m++) {
    const mesLabel = MESES[m];

    for (const prop of properties) {
      // Ingresos: confirmed payments (one per property, not per inquilino)
      const rentaEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || []);
      const propPagos = pagos.filter(p => p.property_id === prop.id && p.mes === m + 1 && p.anio === year && p.propietario_confirmado);
      if (propPagos.length > 0) {
        const totalCobrado = propPagos.reduce((s, p) => s + Number(p.importe_pagado ?? 0), 0);
        const mainInq = inquilinos.find(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
        rows.push([mesLabel, prop.nombre_interno, "Ingreso", `Renta${mainInq ? ` - ${mainInq.nombre}` : ""}`, "Alquiler", totalCobrado || rentaEsperada || 0]);
      }

      // Fixed costs
      if (prop.cuota_comunidad) {
        rows.push([mesLabel, prop.nombre_interno, "Gasto", "Cuota de comunidad", "Comunidad", -Number(prop.cuota_comunidad)]);
      }
      if (prop.tiene_derrama && prop.importe_derrama) {
        rows.push([mesLabel, prop.nombre_interno, "Gasto", "Derrama", "Derrama", -Number(prop.importe_derrama)]);
      }
      // IBI
      if (prop.ibi_importe && prop.ibi_fecha_pago && !(prop as any).ibi_paga_inquilino) {
        const ibiMonth = parseMonthFromFechaPago(prop.ibi_fecha_pago);
        if (ibiMonth === m) rows.push([mesLabel, prop.nombre_interno, "Gasto", "IBI", "IBI", -Number(prop.ibi_importe)]);
      }
      // Basuras
      if (prop.basuras_importe && prop.basuras_fecha_pago && !(prop as any).basuras_paga_inquilino) {
        const basMonth = parseMonthFromFechaPago(prop.basuras_fecha_pago);
        if (basMonth === m) rows.push([mesLabel, prop.nombre_interno, "Gasto", "Basuras", "Basuras", -Number(prop.basuras_importe)]);
      }
      // Seguros
      const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
      for (const seg of seguros) {
        if (seg.vencimiento && seg.importe) {
          if (seg.tipo === "impago" && (prop as any).seguro_impago_paga_inquilino) continue;
          const vDate = new Date(seg.vencimiento);
          if (vDate.getMonth() === m && vDate.getFullYear() === year) {
            rows.push([mesLabel, prop.nombre_interno, "Gasto", seg.compania ? `Seguro · ${seg.compania}` : "Seguro", "Seguro", -Number(seg.importe)]);
          }
        }
      }
    }

    // Manual gastos
    for (const g of gastos) {
      if (isGastoActivoEnMes(g, year, m)) {
        const propName = properties.find(p => p.id === g.property_id)?.nombre_interno || "General";
        rows.push([mesLabel, propName, "Gasto", g.concepto || "Sin concepto", g.categoria, -Number(g.importe)]);
      }
    }

    // Closed incident invoices
    if (incidencias) {
      for (const inc of incidencias) {
        if (inc.estado !== "Cerrada" && inc.estado !== "cerrada") continue;
        const total = Number(inc.factura_total);
        if (!total || total <= 0) continue;
        const dateStr = inc.factura_fecha || inc.updated_at;
        if (!dateStr) continue;
        const d = new Date(dateStr);
        if (d.getMonth() === m && d.getFullYear() === year) {
          const propName = properties.find(p => p.id === inc.property_id)?.nombre_interno || "General";
          rows.push([mesLabel, propName, "Gasto", `Incidencia #${inc.numero_incidencia}: ${inc.concepto || "Sin concepto"}`, "incidencia", -total]);
        }
      }
    }
  }

  downloadCSV(`tesoreria_${year}.csv`, headers, rows);
}

/** Generate annual report per property */
export function exportInformeAnualCSV(
  year: number,
  properties: Property[],
  inquilinos: Inquilino[],
  pagos: PagoRenta[],
  gastos: PropertyGasto[],
  contratos?: Contrato[]
) {
  const headers = ["Vivienda", "Dirección", "Ingresos anuales (€)", "Gastos anuales (€)", "Rendimiento neto (€)", "Rentabilidad (%)"];
  const rows: (string | number | null)[][] = [];

  for (const prop of properties) {
    let totalIngresos = 0;
    let totalGastos = 0;

    for (let m = 0; m < 12; m++) {
      // Ingresos
      const rentaEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || []);
      const propPagos = pagos.filter(p => p.property_id === prop.id && p.mes === m + 1 && p.anio === year && p.propietario_confirmado);
      const totalMesCobrado = propPagos.reduce((s, p) => s + Number(p.importe_pagado ?? 0), 0);
      if (propPagos.length > 0) {
        totalIngresos += totalMesCobrado || (rentaEsperada ?? 0);
      }

      // Fixed costs
      totalGastos += getMonthlyFixedCosts(prop, m);

      // IBI
      if (prop.ibi_importe && prop.ibi_fecha_pago && !(prop as any).ibi_paga_inquilino) {
        if (parseMonthFromFechaPago(prop.ibi_fecha_pago) === m) totalGastos += Number(prop.ibi_importe);
      }
      if (prop.basuras_importe && prop.basuras_fecha_pago && !(prop as any).basuras_paga_inquilino) {
        if (parseMonthFromFechaPago(prop.basuras_fecha_pago) === m) totalGastos += Number(prop.basuras_importe);
      }
      const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
      for (const seg of seguros) {
        if (seg.vencimiento && seg.importe) {
          if (seg.tipo === "impago" && (prop as any).seguro_impago_paga_inquilino) continue;
          const vDate = new Date(seg.vencimiento);
          if (vDate.getMonth() === m && vDate.getFullYear() === year) totalGastos += Number(seg.importe);
        }
      }
    }

    // Manual gastos for this property
    for (const g of gastos.filter(g => g.property_id === prop.id)) {
      for (let m = 0; m < 12; m++) {
        if (isGastoActivoEnMes(g, year, m)) totalGastos += Number(g.importe);
      }
    }

    const neto = totalIngresos - totalGastos;
    const rentabilidad = prop.valor_compra ? ((neto / Number(prop.valor_compra)) * 100) : null;

    rows.push([
      prop.nombre_interno,
      prop.direccion_completa || "",
      Math.round(totalIngresos),
      Math.round(totalGastos),
      Math.round(neto),
      rentabilidad != null ? Math.round(rentabilidad * 100) / 100 : null,
    ]);
  }

  // Totals row
  const totIngresos = rows.reduce((s, r) => s + (Number(r[2]) || 0), 0);
  const totGastos = rows.reduce((s, r) => s + (Number(r[3]) || 0), 0);
  rows.push(["TOTAL", "", totIngresos, totGastos, totIngresos - totGastos, null]);

  downloadCSV(`informe_anual_${year}.csv`, headers, rows);
}

/** Export IRPF-ready report */
export function exportInformeIRPF(
  year: number,
  properties: Property[],
  inquilinos: Inquilino[],
  pagos: PagoRenta[],
  gastos: PropertyGasto[],
  ownerName?: string,
  ownerNIF?: string,
  contratos?: Contrato[]
) {
  const headers = [
    "NIF Titular", "Nombre Titular", "Vivienda", "Ref. Catastral", "Dirección",
    "Valor adquisición (€)", "Año adquisición",
    "Rendimiento íntegro (€)", "Gastos deducibles (€)", "Rendimiento neto (€)",
    "Reducción 60% vivienda habitual (€)", "Rendimiento neto reducido (€)"
  ];
  const rows: (string | number | null)[][] = [];

  for (const prop of properties) {
    let ingresos = 0;
    let gastosTotal = 0;

    for (let m = 0; m < 12; m++) {
      const rentaEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || []);
      const propPagos = pagos.filter(p => p.property_id === prop.id && p.mes === m + 1 && p.anio === year && p.propietario_confirmado);
      const totalMesCobrado = propPagos.reduce((s, p) => s + Number(p.importe_pagado ?? 0), 0);
      if (propPagos.length > 0) {
        ingresos += totalMesCobrado || (rentaEsperada ?? 0);
      }
      gastosTotal += getMonthlyFixedCosts(prop, m);
      if (prop.ibi_importe && prop.ibi_fecha_pago && !(prop as any).ibi_paga_inquilino) {
        if (parseMonthFromFechaPago(prop.ibi_fecha_pago) === m) gastosTotal += Number(prop.ibi_importe);
      }
      if (prop.basuras_importe && prop.basuras_fecha_pago && !(prop as any).basuras_paga_inquilino) {
        if (parseMonthFromFechaPago(prop.basuras_fecha_pago) === m) gastosTotal += Number(prop.basuras_importe);
      }
      const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
      for (const seg of seguros) {
        if (seg.vencimiento && seg.importe) {
          if (seg.tipo === "impago" && (prop as any).seguro_impago_paga_inquilino) continue;
          const vDate = new Date(seg.vencimiento);
          if (vDate.getMonth() === m && vDate.getFullYear() === year) gastosTotal += Number(seg.importe);
        }
      }
    }

    for (const g of gastos.filter(g => g.property_id === prop.id)) {
      for (let m = 0; m < 12; m++) {
        if (isGastoActivoEnMes(g, year, m)) gastosTotal += Number(g.importe);
      }
    }

    const neto = ingresos - gastosTotal;
    const reduccion = neto > 0 ? Math.round(neto * 0.6) : 0;
    const netoReducido = neto - reduccion;

    rows.push([
      ownerNIF || "",
      ownerName || "",
      prop.nombre_interno,
      prop.referencia_catastral || "",
      prop.direccion_completa || "",
      prop.valor_compra ? Number(prop.valor_compra) : null,
      prop.ano_compra || null,
      Math.round(ingresos),
      Math.round(gastosTotal),
      Math.round(neto),
      reduccion,
      Math.round(netoReducido),
    ]);
  }

  downloadCSV(`informe_IRPF_${year}.csv`, headers, rows);
}
