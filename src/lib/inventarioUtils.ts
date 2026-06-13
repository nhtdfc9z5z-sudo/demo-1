import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import type { InventarioItem } from "@/components/propietarios/InventarioEditor";

/**
 * Reads a File as a base64 data URL string.
 */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Resizes an image to fit within maxW x maxH, returns data URL.
 */
const resizeImage = (
  dataUrl: string,
  maxW: number,
  maxH: number
): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });

/**
 * Generates a PDF document from inventory items with photos.
 */
export interface InventarioPdfContext {
  propertyAddress: string;
  fechaContrato: string;
  arrendador?: string;
  arrendatarios?: string[];
}

export const generateInventarioPdf = async (
  items: InventarioItem[],
  context: InventarioPdfContext
): Promise<Blob> => {
  const { propertyAddress, fechaContrato, arrendador, arrendatarios } = context;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const arrendadorLabel = (arrendador || "Arrendador/a").trim();
  const arrendatariosLabel = (arrendatarios || [])
    .map((name) => name.trim())
    .filter(Boolean)
    .join(", ") || "Arrendatario/a";
  const fechaContratoLabel = fechaContrato || new Date().toLocaleDateString("es-ES");

  // Header
  doc.setFontSize(13);
  const heading = `Inventario de ${propertyAddress || "la vivienda"}, anexo al contrato de arrendamiento`;
  const headingLines = doc.splitTextToSize(heading, pageWidth - 28);
  doc.text(headingLines, 14, 20);

  doc.setFontSize(10);
  const subtitle = `Entre ${arrendadorLabel} y ${arrendatariosLabel}. Firmado con fecha ${fechaContratoLabel}.`;
  const subtitleLines = doc.splitTextToSize(subtitle, pageWidth - 28);
  const subtitleY = 20 + headingLines.length * 6 + 2;
  doc.text(subtitleLines, 14, subtitleY);

  const annexY = subtitleY + subtitleLines.length * 5 + 2;
  doc.text("Este documento forma parte como ANEXO del contrato de arrendamiento.", 14, annexY);

  const tableStartY = annexY + 8;

  // Table of items
  const tableData = items
    .filter((i) => i.nombre.trim())
    .map((item, idx) => [
      String(idx + 1),
      item.nombre,
      item.marca || "—",
      item.caracteristicas || "—",
      item.fotos.length > 0 ? `${item.fotos.length} foto(s)` : "Sin fotos",
    ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Enser", "Marca / Modelo", "Características", "Fotos"]],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 10 },
      4: { cellWidth: 22 },
    },
  });

  // Photos section
  let y = (doc as any).lastAutoTable?.finalY + 12 || 100;

  for (const item of items.filter((i) => i.nombre.trim())) {
    if (item.fotos.length === 0) continue;

    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.text(`📷 ${item.nombre}`, 14, y);
    y += 6;

    const photoMaxW = 55;
    const photoMaxH = 45;
    let x = 14;

    for (const foto of item.fotos) {
      try {
        const dataUrl = await fileToDataUrl(foto.file);
        const resized = await resizeImage(dataUrl, 400, 400);

        if (x + photoMaxW > pageWidth - 14) {
          x = 14;
          y += photoMaxH + 4;
        }
        if (y + photoMaxH > 280) {
          doc.addPage();
          y = 20;
          x = 14;
        }

        doc.addImage(resized, "JPEG", x, y, photoMaxW, photoMaxH);
        x += photoMaxW + 4;
      } catch {
        // Skip unreadable photos
      }
    }

    y += photoMaxH + 10;
  }

  // Signature section
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  y += 10;
  doc.setFontSize(10);
  doc.text("Firmas de conformidad:", 14, y);
  y += 20;
  doc.line(14, y, 90, y);
  doc.text("El/La Arrendador/a", 30, y + 6);
  doc.line(110, y, 190, y);
  doc.text("El/La Arrendatario/a", 130, y + 6);

  return doc.output("blob");
};

/**
 * Uploads the inventory PDF to storage and saves records:
 * 1. As a document linked to the property in inquilino_documentos (category: inventario)
 * 2. Returns the URL for reference
 */
export const uploadInventarioPdf = async (
  pdfBlob: Blob,
  userId: string,
  propertyId: string,
  inquilinoId: string | null,
  propertyName: string
): Promise<{ url: string; storagePath: string } | null> => {
  const fileName = `inventario-${propertyName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
  const storagePath = `${userId}/inventarios/${fileName}`;

  // Upload to contratos bucket
  const { error: uploadError } = await supabase.storage
    .from("contratos")
    .upload(storagePath, pdfBlob, { contentType: "application/pdf" });

  if (uploadError) {
    console.error("Error uploading inventario PDF:", uploadError);
    return null;
  }

  const { data: urlData } = await supabase.storage
    .from("contratos")
    .createSignedUrl(storagePath, 3600);

  const url = urlData?.signedUrl || "";

  // Save as inquilino document (category: inventario)
  // If no inquilino, try to find one linked to this property
  let targetInquilinoId = inquilinoId;
  if (!targetInquilinoId) {
    const { data: propInquilinos } = await supabase
      .from("inquilinos")
      .select("id")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .limit(1);
    targetInquilinoId = propInquilinos?.[0]?.id || null;
  }

  if (targetInquilinoId) {
    await supabase.from("inquilino_documentos").insert({
      user_id: userId,
      inquilino_id: targetInquilinoId,
      nombre_archivo: fileName,
      storage_path: storagePath,
      url,
      categoria: "inventario",
      subido_por: "propietario",
      visible_para_inquilino: true,
    });
  }

  return { url, storagePath };
};
