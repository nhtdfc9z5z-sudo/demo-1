import { crearActivo } from "./crearActivo";
import { crearInquilino } from "./crearInquilino";
import { crearContrato } from "./crearContrato";
import { subirArchivosContratoBestEffort } from "./subirArchivosContrato";
import { supabase } from "@/integrations/supabase/client";
import type {
  AltaMeta,
  AltaResultado,
  CrearActivoInput,
  CrearContratoInput,
  CrearInquilinoInput,
} from "./types";

export interface CrearAltaCompletaInput {
  /** Either an existing property id or a fresh activo to be created. */
  activo: { existente_id: string } | { nuevo: Omit<CrearActivoInput, "meta"> };
  /** One or more existing tenants or fresh ones. */
  inquilinos: Array<
    { existente_id: string } | { nuevo: Omit<CrearInquilinoInput, "meta" | "property_id"> }
  >;
  /** Contract data; property_id and inquilino_ids resolved by this function. */
  contrato: Omit<CrearContratoInput, "property_id" | "inquilino_ids" | "meta">;
  meta: AltaMeta;
  /**
   * Archivos del contrato capturados (OCR). Best-effort: si la subida falla,
   * el alta continúa igual y el contrato queda creado sin pdf_url.
   */
  archivos_contrato?: File[];
}

/**
 * Single orchestrator for the "Alta guiada de alquiler" wizard.
 * Creates / resolves the three entities and links them.
 *
 * Convergence point — ALL alquiler creation flows must call this.
 */
export async function crearAltaCompleta(
  input: CrearAltaCompletaInput,
): Promise<AltaResultado> {
  // 1) Resolve activo
  let property_id: string;
  if ("existente_id" in input.activo) {
    property_id = input.activo.existente_id;
  } else {
    const r = await crearActivo({ ...input.activo.nuevo, meta: input.meta });
    property_id = r.id;
  }

  // 2) Resolve inquilinos
  const inquilino_ids: string[] = [];
  for (const inq of input.inquilinos) {
    if ("existente_id" in inq) {
      inquilino_ids.push(inq.existente_id);
    } else {
      const r = await crearInquilino({
        ...inq.nuevo,
        property_id,
        meta: input.meta,
      });
      inquilino_ids.push(r.id);
    }
  }

  // 3) Contrato
  const contrato = await crearContrato({
    ...input.contrato,
    property_id,
    inquilino_ids,
    meta: input.meta,
  });

  // 4) Subida best-effort de los PDFs/fotos del OCR.
  if (input.archivos_contrato?.length) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await subirArchivosContratoBestEffort({
          contratoId: contrato.id,
          propertyId: property_id,
          userId: user.id,
          archivos: input.archivos_contrato,
        });
      }
    } catch (e) {
      console.warn("[crearAltaCompleta] subida de archivos contrato falló", e);
    }
  }

  return { property_id, inquilino_ids, contrato_id: contrato.id };
}