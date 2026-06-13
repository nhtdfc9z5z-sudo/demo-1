/**
 * fiscalPackExport — Exportación PDF / Excel del Pack para gestor.
 *
 * Reglas:
 *  - NO se recalcula nada. Recibe siempre un `OwnerFiscalPack` ya construido
 *    por `buildOwnerPack` (única fuente de verdad fiscal).
 *  - PDF y Excel deben reflejar exactamente lo que se muestra en pantalla.
 *  - Si `requiereRevisionFiscal` es true se incluye un aviso visible en ambos formatos.
 */
import type { OwnerFiscalPack, PropertyFiscalBreakdown } from "@/lib/fiscalPack";
import { labelDeducible } from "@/lib/fiscalPack";

// Carga perezosa: las librerías pesadas (jspdf ~250KB, xlsx ~430KB) sólo se
// descargan cuando el usuario pulsa exportar.
const loadPdfLibs = () => Promise.all([
  import("jspdf").then(m => m.default),
  import("jspdf-autotable").then(m => m.default),
]);
const loadXlsx = () => import("xlsx");

const LEGAL_NOTICE =
  "Resumen informativo generado por CapitalRent. Revisa los datos con tu asesor fiscal antes de presentar declaraciones.";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmtEur = (n: number) =>
  `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const fmtPct = (n: number) => `${n}%`;

const labelCriterio = (c: PropertyFiscalBreakdown["criterioAplicado"]): string => {
  switch (c) {
    case "rol_contractual": return "Rol contractual";
    case "sin_datos": return "Sin datos suficientes (revisión)";
    case "titularidad":
    default: return "Titularidad";
  }
};

const todayStr = () =>
  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

// ──────────────────────────────────────────────────────────────────────────────
// PDF
// ──────────────────────────────────────────────────────────────────────────────

export interface PdfOptions {
  propietarioNombre?: string | null;
  /** Por defecto: today */
  fechaGeneracion?: Date;
}

export async function generateFiscalPackPdf(pack: OwnerFiscalPack, opts: PdfOptions = {}): Promise<Blob> {
  const [jsPDF, autoTable] = await loadPdfLibs();
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  let y = 18;

  // ── Cabecera ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Resumen Fiscal · ${pack.anio}`, pw / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  const propLabel = pack.propietarioNombre || opts.propietarioNombre || "Todos los titulares";
  doc.text(
    `Propietario: ${propLabel}   ·   Generado: ${
      opts.fechaGeneracion ? opts.fechaGeneracion.toLocaleDateString("es-ES") : todayStr()
    }`,
    pw / 2, y, { align: "center" },
  );
  y += 5;
  doc.text(
    `Criterio: ${pack.criterioCalculo === "por_propietario" ? "por propietario (% titularidad / rol)" : "total inmueble (100%)"}`,
    pw / 2, y, { align: "center" },
  );
  y += 6;
  doc.setTextColor(0);

  // ── Aviso legal ──
  doc.setFontSize(8);
  doc.setTextColor(150);
  const legalLines = doc.splitTextToSize(LEGAL_NOTICE, pw - 24);
  doc.text(legalLines, 12, y);
  y += legalLines.length * 4 + 2;
  doc.setTextColor(0);

  // ── Resumen general ──
  autoTable(doc, {
    startY: y,
    head: [["Resumen general", "Valor"]],
    body: [
      ["Ingresos declarables", fmtEur(pack.totalIngresosDeclarables)],
      ["Gastos deducibles", fmtEur(pack.totalGastosDeducibles)],
      ["Resultado neto estimado", fmtEur(pack.totalNeto)],
      ["Inmuebles incluidos", String(pack.propiedades.length)],
      ["Inmuebles que requieren revisión fiscal", String(pack.inmueblesRequierenRevision.length)],
      ["Meses pendientes", String(pack.totalMesesPendientes)],
      ["Meses regularizados", String(pack.totalMesesRegularizados)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { left: 12, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Aviso global de revisión ──
  if (pack.inmueblesRequierenRevision.length > 0) {
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(252, 165, 165);
    doc.rect(12, y, pw - 24, 10, "FD");
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text(
      `Aviso: ${pack.inmueblesRequierenRevision.length} inmueble(s) requieren revisión fiscal.`,
      14, y + 6.5,
    );
    doc.setTextColor(0);
    y += 14;
  }

  // ── Desglose por inmueble ──
  for (const p of pack.propiedades) {
    if (y > 250) { doc.addPage(); y = 18; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(p.propertyName, 12, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    const meta = [
      p.referenciaCatastral ? `Ref. catastral: ${p.referenciaCatastral}` : null,
      p.direccion || null,
    ].filter(Boolean).join("   ·   ");
    if (meta) { doc.text(meta, 12, y); y += 4; }
    doc.text(
      `Criterio aplicado: ${labelCriterio(p.criterioAplicado)}   ·   Porcentaje: ${fmtPct(p.porcentajeAplicado)}`,
      12, y,
    );
    y += 4;
    doc.setTextColor(0);

    if (p.requiereRevisionFiscal) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(252, 211, 77);
      const banner = "Este inmueble requiere revisión fiscal: la titularidad y el rol contractual no coinciden o falta información suficiente.";
      const lines = doc.splitTextToSize(banner, pw - 28);
      doc.rect(12, y, pw - 24, lines.length * 4 + 4, "FD");
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text(lines, 14, y + 4);
      y += lines.length * 4 + 6;
      doc.setTextColor(0);
    }

    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Importe"]],
      body: [
        ["Ingresos por rentas (declarables)", fmtEur(p.ingresosDeclarables)],
        ["  · Pagos reales fiscales", fmtEur(p.pagosRealesFiscal)],
        ["  · Históricos fiscales incluidos", fmtEur(p.historicosFiscal)],
        ["Pagos pendientes (no cobrados)", `${p.mesesPendientes.length} mes(es) — ${p.mesesPendientes.map(m => MESES[m - 1]).join(", ") || "—"}`],
        ["Regularizaciones", `${p.mesesRegularizados.length} mes(es) — ${p.mesesRegularizados.map(m => MESES[m - 1]).join(", ") || "—"}`],
        ["Gastos deducibles (total)", fmtEur(p.gastosTotal)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    // Gastos por categoría
    if (p.gastosDeducibles.length > 0) {
      const porCat = new Map<string, number>();
      for (const g of p.gastosDeducibles) {
        porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + g.importe);
      }
      autoTable(doc, {
        startY: y,
        head: [["Gasto deducible por categoría", "Importe"]],
        body: Array.from(porCat.entries()).map(([cat, imp]) => [labelDeducible(cat), fmtEur(imp)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [148, 163, 184] },
        margin: { left: 12, right: 12 },
      });
      y = (doc as any).lastAutoTable.finalY + 3;
    }

    // Notas para gestor
    if (p.notasRegularizacion.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(70);
      doc.text("Notas para el gestor:", 12, y);
      y += 4;
      for (const n of p.notasRegularizacion) {
        const lines = doc.splitTextToSize(`· ${n}`, pw - 24);
        if (y + lines.length * 3.5 > 285) { doc.addPage(); y = 18; }
        doc.text(lines, 14, y);
        y += lines.length * 3.5;
      }
      doc.setTextColor(0);
      y += 3;
    }

    y += 4;
  }

  // Pie con aviso legal en cada página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(LEGAL_NOTICE, pw / 2, 293, { align: "center", maxWidth: pw - 20 });
    doc.text(`Página ${i} / ${pageCount}`, pw - 14, 293, { align: "right" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}

export async function downloadFiscalPackPdf(pack: OwnerFiscalPack, opts: PdfOptions = {}): Promise<void> {
  const blob = await generateFiscalPackPdf(pack, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = (pack.propietarioNombre || opts.propietarioNombre || "todos")
    .toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `pack-fiscal-${pack.anio}-${slug || "todos"}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ──────────────────────────────────────────────────────────────────────────────
// Excel
// ──────────────────────────────────────────────────────────────────────────────

/** Hojas que se generan en el libro Excel (orden fijo). */
export const EXCEL_SHEETS = [
  "Resumen",
  "Ingresos por mes",
  "Gastos deducibles",
  "Pendientes y regularizaciones",
  "Criterios fiscales y avisos",
] as const;
export type ExcelSheetName = typeof EXCEL_SHEETS[number];

export async function buildFiscalPackWorkbook(pack: OwnerFiscalPack, opts: PdfOptions = {}): Promise<any> {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const propLabel = pack.propietarioNombre || opts.propietarioNombre || "Todos los titulares";

  // ─── Hoja 1: Resumen ───
  const resumen: (string | number)[][] = [
    ["Resumen Fiscal CapitalRent"],
    ["Año fiscal", pack.anio],
    ["Propietario", propLabel],
    ["Criterio", pack.criterioCalculo === "por_propietario" ? "Por propietario" : "Total inmueble"],
    ["Generado", (opts.fechaGeneracion ?? new Date()).toLocaleDateString("es-ES")],
    [],
    ["Aviso", LEGAL_NOTICE],
    [],
    ["Concepto", "Valor"],
    ["Ingresos declarables (€)", round2(pack.totalIngresosDeclarables)],
    ["Gastos deducibles (€)", round2(pack.totalGastosDeducibles)],
    ["Resultado neto estimado (€)", round2(pack.totalNeto)],
    ["Inmuebles incluidos", pack.propiedades.length],
    ["Inmuebles que requieren revisión fiscal", pack.inmueblesRequierenRevision.length],
    ["Meses pendientes (total)", pack.totalMesesPendientes],
    ["Meses regularizados (total)", pack.totalMesesRegularizados],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

  // ─── Hoja 2: Ingresos por inmueble y mes ───
  const ingresosHeader = [
    "Inmueble", "Ref. catastral", "% aplicado", "Criterio",
    ...MESES, "Total ingresos declarables", "Pagos reales fiscales", "Históricos fiscales",
  ];
  const ingresosRows: (string | number)[][] = [ingresosHeader];
  for (const p of pack.propiedades) {
    ingresosRows.push([
      p.propertyName,
      p.referenciaCatastral ?? "",
      p.porcentajeAplicado,
      labelCriterio(p.criterioAplicado),
      ...p.meses.map(m => round2(m.ingresoDeclarable)),
      round2(p.ingresosDeclarables),
      round2(p.pagosRealesFiscal),
      round2(p.historicosFiscal),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ingresosRows), "Ingresos por mes");

  // ─── Hoja 3: Gastos deducibles ───
  const gastosRows: (string | number)[][] = [
    ["Inmueble", "% aplicado", "Categoría", "Concepto", "Origen", "Importe (€)"],
  ];
  for (const p of pack.propiedades) {
    for (const g of p.gastosDeducibles) {
      gastosRows.push([
        p.propertyName,
        p.porcentajeAplicado,
        labelDeducible(g.categoria),
        g.concepto,
        g.origen === "factura" ? "Factura" : "Gasto manual",
        round2(g.importe),
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastosRows), "Gastos deducibles");

  // ─── Hoja 4: Pendientes y regularizaciones ───
  const pendRows: (string | number)[][] = [
    ["Inmueble", "Tipo", "Mes", "Notas"],
  ];
  for (const p of pack.propiedades) {
    for (const m of p.mesesPendientes) {
      pendRows.push([p.propertyName, "Pendiente", MESES[m - 1], "No se ha cobrado. No suma como ingreso."]);
    }
    for (const m of p.mesesRegularizados) {
      pendRows.push([p.propertyName, "Regularizado", MESES[m - 1], "Mes regularizado, no reclamable. No suma como ingreso."]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pendRows), "Pendientes y regularizaciones");

  // ─── Hoja 5: Criterios fiscales y avisos ───
  const critRows: (string | number)[][] = [
    ["Inmueble", "Criterio aplicado", "% aplicado", "Requiere revisión", "Notas para gestor"],
  ];
  for (const p of pack.propiedades) {
    critRows.push([
      p.propertyName,
      labelCriterio(p.criterioAplicado),
      p.porcentajeAplicado,
      p.requiereRevisionFiscal ? "Sí" : "No",
      p.notasRegularizacion.join(" | "),
    ]);
  }
  critRows.push([]);
  critRows.push(["Aviso", LEGAL_NOTICE]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(critRows), "Criterios fiscales y avisos");

  return wb;
}

export async function downloadFiscalPackXlsx(pack: OwnerFiscalPack, opts: PdfOptions = {}): Promise<void> {
  const XLSX = await loadXlsx();
  const wb = await buildFiscalPackWorkbook(pack, opts);
  const slug = (pack.propietarioNombre || opts.propietarioNombre || "todos")
    .toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  XLSX.writeFile(wb, `pack-fiscal-${pack.anio}-${slug || "todos"}.xlsx`);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const __test__ = { LEGAL_NOTICE, labelCriterio };

// ──────────────────────────────────────────────────────────────────────────────
// CSV exports: Contasol, A3, Sage 50, Holded
// ──────────────────────────────────────────────────────────────────────────────

/** Cuentas PGC por categoría de gasto. */
const CUENTA_INGRESOS = "752";
const CUENTA_CONTRAPARTIDA_TESORERIA = "572"; // bancos
const CUENTAS_GASTO: Record<string, string> = {
  ibi: "631",
  basuras: "631",
  comunidad: "629",
  derrama: "622",
  reformas: "622",
  mantenimiento: "622",
  arreglos: "622",
  suministros: "628",
  seguro_vivienda: "625",
  seguro_impago: "625",
  prestamo: "769",
  honorarios: "623",
  amortizacion: "681",
  otro: "629",
};

function cuentaPara(categoria: string): string {
  return CUENTAS_GASTO[categoria] || CUENTAS_GASTO.otro;
}

/** Escapa un valor CSV con el separador dado. */
function csvCell(value: string | number, sep: string): string {
  const s = String(value ?? "");
  if (s.includes(sep) || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: (string | number)[][], sep: string): string {
  return rows.map(r => r.map(c => csvCell(c, sep)).join(sep)).join("\r\n");
}

/** Cabecera UTF-8 con BOM para que Excel/A3/Contasol detecten acentos. */
const UTF8_BOM = "\uFEFF";

function fmtAmount(n: number): string {
  // Formato neutro con punto decimal — aceptado por todas las herramientas.
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

function fechaFiscal(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

interface Asiento {
  fecha: string;
  concepto: string;
  debe: number;
  haber: number;
  cuenta: string;
  contrapartida: string;
  categoria: string;
  emisor: string;
}

function packToAsientos(pack: OwnerFiscalPack): Asiento[] {
  const asientos: Asiento[] = [];
  for (const p of pack.propiedades) {
    // Ingresos por mes
    for (const m of p.meses) {
      if (m.ingresoDeclarable > 0) {
        asientos.push({
          fecha: fechaFiscal(pack.anio, m.mes),
          concepto: `Renta ${MESES[m.mes - 1]} ${pack.anio} - ${p.propertyName}`,
          debe: 0,
          haber: round2(m.ingresoDeclarable),
          cuenta: CUENTA_INGRESOS,
          contrapartida: CUENTA_CONTRAPARTIDA_TESORERIA,
          categoria: "ingreso",
          emisor: p.propertyName,
        });
      }
    }
    // Gastos deducibles
    for (const g of p.gastosDeducibles) {
      asientos.push({
        fecha: fechaFiscal(pack.anio, 12), // sin fecha individual en el pack → fin de año
        concepto: `${labelDeducible(g.categoria)} - ${g.concepto} (${p.propertyName})`,
        debe: round2(g.importe),
        haber: 0,
        cuenta: cuentaPara(g.categoria),
        contrapartida: CUENTA_CONTRAPARTIDA_TESORERIA,
        categoria: g.categoria,
        emisor: g.concepto,
      });
    }
  }
  return asientos;
}

function csvBlob(csv: string): Blob {
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

// ─── Contasol ──────────────────────────────────────────────────────────────
export function buildContasolCsv(pack: OwnerFiscalPack): string {
  const sep = ";";
  const asientos = packToAsientos(pack);
  const rows: (string | number)[][] = [
    ["Fecha", "Concepto", "Debe", "Haber", "Cuenta"],
    ...asientos.map(a => [a.fecha, a.concepto, fmtAmount(a.debe), fmtAmount(a.haber), a.cuenta]),
  ];
  return UTF8_BOM + rowsToCsv(rows, sep);
}
export function generateContasolCsv(pack: OwnerFiscalPack): Blob {
  return csvBlob(buildContasolCsv(pack));
}

// ─── A3 Asesor ─────────────────────────────────────────────────────────────
export function buildA3Csv(pack: OwnerFiscalPack): string {
  const sep = ";";
  const asientos = packToAsientos(pack);
  const header = `# A3 Asesor - Export CapitalRent - Ejercicio ${pack.anio}`;
  const rows: (string | number)[][] = [
    ["Fecha", "Concepto", "Debe", "Haber", "Cuenta"],
    ...asientos.map(a => [a.fecha, a.concepto, fmtAmount(a.debe), fmtAmount(a.haber), a.cuenta]),
  ];
  return UTF8_BOM + header + "\r\n" + rowsToCsv(rows, sep);
}
export function generateA3Csv(pack: OwnerFiscalPack): Blob {
  return csvBlob(buildA3Csv(pack));
}

// ─── Sage 50 / Despachos ───────────────────────────────────────────────────
export function buildSageCsv(pack: OwnerFiscalPack): string {
  const sep = ";";
  const asientos = packToAsientos(pack);
  const rows: (string | number)[][] = [
    ["Fecha", "Ref", "Concepto", "Importe", "IVA", "Cuenta", "Contrapartida"],
    ...asientos.map((a, idx) => [
      a.fecha,
      `${pack.anio}-${String(idx + 1).padStart(5, "0")}`,
      a.concepto,
      fmtAmount(a.debe > 0 ? a.debe : a.haber),
      "0.00",
      a.cuenta,
      a.contrapartida,
    ]),
  ];
  return UTF8_BOM + rowsToCsv(rows, sep);
}
export function generateSageCsv(pack: OwnerFiscalPack): Blob {
  return csvBlob(buildSageCsv(pack));
}

// ─── Holded ────────────────────────────────────────────────────────────────
export function buildHoldedCsv(pack: OwnerFiscalPack): string {
  const sep = ",";
  const asientos = packToAsientos(pack);
  const rows: (string | number)[][] = [
    ["Contact", "Date", "Description", "Amount", "Tax", "Category"],
    ...asientos.map(a => [
      a.emisor,
      a.fecha,
      a.concepto,
      fmtAmount(a.debe > 0 ? a.debe : a.haber),
      "0.00",
      a.categoria === "ingreso" ? "Ingresos por alquiler" : labelDeducible(a.categoria),
    ]),
  ];
  return UTF8_BOM + rowsToCsv(rows, sep);
}
export function generateHoldedCsv(pack: OwnerFiscalPack): Blob {
  return csvBlob(buildHoldedCsv(pack));
}

// ─── Helpers de descarga ────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export function downloadFiscalPackContasol(pack: OwnerFiscalPack): void {
  triggerDownload(generateContasolCsv(pack), `pack-fiscal-${pack.anio}-contasol.csv`);
}
export function downloadFiscalPackA3(pack: OwnerFiscalPack): void {
  triggerDownload(generateA3Csv(pack), `pack-fiscal-${pack.anio}-a3.csv`);
}
export function downloadFiscalPackSage(pack: OwnerFiscalPack): void {
  triggerDownload(generateSageCsv(pack), `pack-fiscal-${pack.anio}-sage.csv`);
}
export function downloadFiscalPackHolded(pack: OwnerFiscalPack): void {
  triggerDownload(generateHoldedCsv(pack), `pack-fiscal-${pack.anio}-holded.csv`);
}