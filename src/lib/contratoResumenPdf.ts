import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contrato } from "@/hooks/useContratos";

export interface ResumenContext {
  contrato: Contrato;
  propertyName: string;
  propertyAddress: string | null;
  inquilinoName: string | null;
  inquilinoDni: string | null;
  inquilinoEmail: string | null;
  inquilinoTelefono: string | null;
  aguaIncluidaComunidad?: boolean;
  calefaccionIncluidaComunidad?: boolean;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const formatCurrency = (n: number | null) =>
  n != null ? `${n.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : "—";

export const generateContratoResumenPdf = (ctx: ResumenContext): Blob => {
  const { contrato: c, propertyName, propertyAddress, inquilinoName, inquilinoDni, inquilinoEmail, inquilinoTelefono, aguaIncluidaComunidad, calefaccionIncluidaComunidad } = ctx;
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen del Contrato", pw / 2, y, { align: "center" });
  y += 10;

  // Subtitle
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(c.titulo, pw / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 4;

  // Status line
  const estadoLabel = c.estado === "vigente" ? "VIGENTE" : c.estado === "finalizado" ? "FINALIZADO" : "RENOVADO";
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Estado: ${estadoLabel}  ·  Generado el ${new Date().toLocaleDateString("es-ES")}`, pw / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 10;

  // Divider
  doc.setDrawColor(200);
  doc.line(20, y, pw - 20, y);
  y += 8;

  // === VIVIENDA ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Vivienda", 20, y);
  y += 6;

  const viviendaData: string[][] = [
    ["Nombre", propertyName],
  ];
  if (propertyAddress) viviendaData.push(["Dirección", propertyAddress]);

  autoTable(doc, {
    startY: y,
    head: [],
    body: viviendaData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    margin: { left: 20, right: 20 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === INQUILINO ===
  if (inquilinoName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Inquilino", 20, y);
    y += 6;

    const inqData: string[][] = [["Nombre", inquilinoName]];
    if (inquilinoDni) inqData.push(["DNI/NIF", inquilinoDni]);
    if (inquilinoEmail) inqData.push(["Email", inquilinoEmail]);
    if (inquilinoTelefono) inqData.push(["Teléfono", inquilinoTelefono]);

    autoTable(doc, {
      startY: y,
      head: [],
      body: inqData,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
        1: { cellWidth: "auto" },
      },
      margin: { left: 20, right: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === PERÍODO ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Período", 20, y);
  y += 6;

  const periodoData: string[][] = [
    ["Fecha inicio", formatDate(c.fecha_inicio)],
    ["Fecha fin", formatDate(c.fecha_fin)],
  ];
  if (c.duracion_anos) periodoData.push(["Duración inicial", `${c.duracion_anos} año${c.duracion_anos > 1 ? "s" : ""}`]);
  if (c.prorroga_anos) periodoData.push(["Prórroga", `${c.prorroga_anos} año${c.prorroga_anos > 1 ? "s" : ""}`]);
  if (c.preaviso_meses) periodoData.push(["Preaviso", `${c.preaviso_meses} mes${c.preaviso_meses > 1 ? "es" : ""}`]);
  periodoData.push(["Renovación automática", c.renovacion_automatica ? "Sí" : "No"]);

  autoTable(doc, {
    startY: y,
    head: [],
    body: periodoData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    margin: { left: 20, right: 20 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === ECONOMÍA ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Condiciones económicas", 20, y);
  y += 6;

  const econData: string[][] = [
    ["Renta mensual", formatCurrency(c.renta_mensual)],
  ];
  if (c.fianza_importe) econData.push(["Fianza", formatCurrency(c.fianza_importe)]);
  if (c.deposito_garantia) econData.push(["Depósito de garantía", formatCurrency(c.deposito_garantia)]);
  if (c.cuota_comunidad) econData.push(["Cuota comunidad", formatCurrency(c.cuota_comunidad)]);

  autoTable(doc, {
    startY: y,
    head: [],
    body: econData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    margin: { left: 20, right: 20 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === SUMINISTROS ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Suministros — ¿Quién paga?", 20, y);
  y += 6;

  const suministroLabel = (pagaInquilino: boolean, incluidaComunidad?: boolean) => {
    if (incluidaComunidad) return "Comunidad";
    return pagaInquilino ? "Inquilino" : "Propietario";
  };
  const sumData: string[][] = [
    ["Agua", suministroLabel(c.agua_paga_inquilino, aguaIncluidaComunidad)],
    ["Luz", suministroLabel(c.luz_paga_inquilino)],
    ["Gas", suministroLabel(c.gas_paga_inquilino)],
    ["Calefacción", suministroLabel(false, calefaccionIncluidaComunidad)],
    ["Internet", suministroLabel(c.internet_paga_inquilino)],
    ["IBI", suministroLabel(c.ibi_paga_inquilino)],
    ["Basuras", suministroLabel(c.basuras_paga_inquilino)],
    ["Comunidad", suministroLabel(c.comunidad_paga_inquilino)],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: sumData,
    theme: "striped",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    margin: { left: 20, right: 20 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === NOTAS ===
  if (c.notas) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Notas", 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(c.notas, pw - 40);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 8;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento generado automáticamente — No tiene validez contractual", pw / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  // Return blob for controlled in-app export actions
  return doc.output("blob");
};
