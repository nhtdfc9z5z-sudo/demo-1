import { supabase } from "@/integrations/supabase/client";

export interface ArchivoContratoSubido {
  url: string;
  path: string;
  nombre: string;
}

/**
 * Best-effort upload of contract files captured in the OCR flow.
 *
 * - Uploads every file to `contratos/{userId}/{contratoId}/{filename}`.
 * - Updates the contract row with the first file (archivo_url + storage_path
 *   + archivo_nombre) so it surfaces in `ContratosSection` and the asset's
 *   documentation tab (via `fromContrato`).
 * - For additional files, registers them in `property_documentos` with
 *   categoria='contrato' so they are also reachable from the asset.
 *
 * Never throws: if anything fails the contract creation already succeeded
 * and we simply log + return whatever managed to upload. This keeps the
 * OCR flow non-blocking, as requested.
 */
export async function subirArchivosContratoBestEffort(params: {
  contratoId: string;
  propertyId: string;
  userId: string;
  archivos: File[];
}): Promise<ArchivoContratoSubido[]> {
  const { contratoId, propertyId, userId, archivos } = params;
  if (!archivos?.length || !contratoId || !userId) return [];

  const subidos: ArchivoContratoSubido[] = [];

  for (let idx = 0; idx < archivos.length; idx++) {
    const file = archivos[idx];
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `${userId}/${contratoId}/${Date.now()}_${idx}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("contratos")
        .upload(storagePath, file, { upsert: false });
      if (upErr) {
        console.warn("[subirArchivosContrato] upload falló", upErr);
        continue;
      }

      const { data: urlData } = await supabase.storage
        .from("contratos")
        .createSignedUrl(storagePath, 3600);
      const url = urlData?.signedUrl ?? "";

      subidos.push({ url, path: storagePath, nombre: file.name });

      if (idx === 0) {
        const { error: updErr } = await supabase
          .from("contratos_arrendamiento")
          .update({
            archivo_nombre: file.name,
            storage_path: storagePath,
            archivo_url: url || null,
          } as never)
          .eq("id", contratoId)
          .eq("user_id", userId);
        if (updErr) console.warn("[subirArchivosContrato] update contrato falló", updErr);
      } else {
        // Adjuntos extra → visibles desde la ficha del activo.
        const { error: docErr } = await supabase
          .from("property_documentos")
          .insert({
            property_id: propertyId,
            user_id: userId,
            nombre_archivo: file.name,
            storage_path: storagePath,
            url: url || "",
            categoria: "contrato",
          } as never);
        if (docErr) console.warn("[subirArchivosContrato] property_documentos falló", docErr);
      }
    } catch (e) {
      console.warn("[subirArchivosContrato] excepción en archivo", file?.name, e);
    }
  }

  return subidos;
}