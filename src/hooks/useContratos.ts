import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { getContratoTimeline } from "@/lib/contratoStatusUtils";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { insertContratoRow } from "@/lib/altas/raw";

export interface Contrato {
  id: string;
  user_id: string;
  property_id: string;
  inquilino_id: string | null;
  titulo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /**
   * [H2.9] Fecha desde la que CapitalRent controla los pagos de este
   * contrato. Para contratos importados ya en marcha puede ser posterior a
   * `fecha_inicio`. No se calcula deuda anterior a esta fecha.
   */
  fecha_inicio_control?: string | null;
  renta_mensual: number | null;
  archivo_nombre: string | null;
  storage_path: string | null;
  archivo_url: string | null;
  estado: string;
  notas: string | null;
  duracion_anos: number | null;
  prorroga_anos: number | null;
  preaviso_meses: number | null;
  fianza_importe: number | null;
  deposito_garantia: number | null;
  archivado: boolean;
  revisado_por_usuario: boolean;
  tiene_inventario: boolean;
  renovacion_automatica: boolean;
  agua_paga_inquilino: boolean;
  luz_paga_inquilino: boolean;
  gas_paga_inquilino: boolean;
  internet_paga_inquilino: boolean;
  ibi_paga_inquilino: boolean;
  basuras_paga_inquilino: boolean;
  comunidad_paga_inquilino: boolean;
  cuota_comunidad: number | null;
  documento_original_nombre: string | null;
  documento_original_path: string | null;
  documento_original_url: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Sprint 3 — modalidad del alquiler. `completo` (default) impone un
   * único pago real por (contrato, mes). `habitaciones` admite varios.
   */
  modalidad_alquiler?: string | null;
}

export interface ContratoHistorial {
  id: string;
  user_id: string;
  contrato_id: string;
  property_id: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
  fecha_evento?: string | null;
  importe_nuevo?: number | null;
  metadata?: Record<string, any> | null;
}

export interface ContratoArrendatario {
  nombre: string;
  nif?: string;
  telefono?: string;
  email?: string;
}

export interface ContratoAnalysis {
  titulo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  renta_mensual?: number;
  estado?: string;
  tipo_contrato?: string;
  notas?: string;
  arrendador_nombre?: string;
  arrendador_nif?: string;
  arrendatario_nombre?: string;
  arrendatario_nif?: string;
  arrendatario_telefono?: string;
  arrendatario_email?: string;
  arrendatarios?: ContratoArrendatario[];
  fianza_importe?: number;
  deposito_garantia?: number;
  direccion_inmueble?: string;
  direccion_calle?: string;
  direccion_numero?: string;
  direccion_planta?: string;
  direccion_puerta?: string;
  direccion_portal?: string;
  direccion_bloque?: string;
  direccion_codigo_postal?: string;
  direccion_ciudad?: string;
  direccion_provincia?: string;
  direccion_escalera?: string;
  direccion_urbanizacion?: string;
  referencia_catastral?: string;
  calificacion_energetica?: string;
  ano_construccion?: number;
  superficie_util_m2?: number;
  superficie_origen?: "contrato" | "cee" | "catastro";
  duracion_anos?: number;
  prorroga_anos?: number;
  renovacion_automatica?: boolean;
  preaviso_meses?: number;
  agua_paga_inquilino?: boolean;
  luz_paga_inquilino?: boolean;
  gas_paga_inquilino?: boolean;
  internet_paga_inquilino?: boolean;
  ibi_paga_inquilino?: boolean;
  basuras_paga_inquilino?: boolean;
  comunidad_paga_inquilino?: boolean;
  cuota_comunidad?: number;
  clausula_actualizacion_renta?: string;
}

export function useContratos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["contratos", user?.id] as const;

  const { data: contratos = [], isLoading: loading, refetch: fetchContratos } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_arrendamiento")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Contrato[]) || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contratos"] });
    invalidateFiscalChain(qc);
  };

  const addHistorial = async (
    contratoId: string,
    propertyId: string,
    tipo: string,
    titulo: string,
    detalle?: string,
    valorAnterior?: string,
    valorNuevo?: string
  ) => {
    if (!user) return;
    await supabase.from("contrato_historial").insert({
      user_id: user.id,
      contrato_id: contratoId,
      property_id: propertyId,
      tipo,
      titulo,
      detalle: detalle || null,
      valor_anterior: valorAnterior || null,
      valor_nuevo: valorNuevo || null,
    } as any);
  };

  const fetchHistorial = async (contratoId: string): Promise<ContratoHistorial[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from("contrato_historial")
      .select("*")
      .eq("contrato_id", contratoId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return (data as unknown as ContratoHistorial[]) || [];
  };

  const fetchHistorialByProperty = async (propertyId: string): Promise<ContratoHistorial[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from("contrato_historial")
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return (data as unknown as ContratoHistorial[]) || [];
  };

  const createContrato = async (data: Partial<Contrato>) => {
    if (!user) return null;
    let created: Record<string, unknown> & { id: string };
    try {
      created = await insertContratoRow({
        ...data,
        titulo: data.titulo || "Contrato de arrendamiento",
      });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo crear el contrato.", variant: "destructive" });
      console.error(error);
      return null;
    }
    const c = created as unknown as Contrato;
    await addHistorial(c.id, c.property_id, "creacion", "Contrato creado", `Título: ${c.titulo}`);
    toast({ title: "Contrato creado", description: "Se ha añadido correctamente." });
    invalidate();
    return c;
  };

  const updateContrato = async (id: string, data: Partial<Contrato>) => {
    if (!user) return;
    const { error } = await supabase
      .from("contratos_arrendamiento")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
      console.error(error);
    } else {
      toast({ title: "Guardado", description: "Contrato actualizado." });
      invalidate();
    }
  };

  const updateContratoWithHistory = async (
    contrato: Contrato,
    data: Partial<Contrato>,
    historyTitle: string,
    historyDetail?: string,
    valorAnterior?: string,
    valorNuevo?: string
  ) => {
    await updateContrato(contrato.id, data);
    await addHistorial(contrato.id, contrato.property_id, "cambio", historyTitle, historyDetail, valorAnterior, valorNuevo);
  };

  const archiveContrato = async (contrato: Contrato) => {
    if (!user) return;
    // Soft delete: mark as archived + finalized
    const { error } = await supabase
      .from("contratos_arrendamiento")
      .update({ archivado: true, estado: "finalizado" } as any)
      .eq("id", contrato.id)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "No se pudo archivar.", variant: "destructive" });
    } else {
      await addHistorial(contrato.id, contrato.property_id, "archivo", "Contrato archivado", `El contrato "${contrato.titulo}" ha sido dado de baja y archivado.`);
      // Clean up calendar events
      await supabase
        .from("property_eventos")
        .delete()
        .eq("user_id", user.id)
        .eq("property_id", contrato.property_id)
        .like("titulo", `%contrato%`)
        .in("subtipo", ["vencimiento_contrato", "aviso_contrato"]);
      toast({ title: "Archivado", description: "El contrato se ha archivado y queda en el historial." });
      invalidate();
    }
  };

  const deleteContrato = async (contrato: Contrato) => {
    // Use soft delete (archive) instead of hard delete
    await archiveContrato(contrato);
  };

  const uploadArchivo = async (contratoId: string, file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${contratoId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("contratos")
      .upload(storagePath, file);

    if (uploadError) {
      toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
      console.error(uploadError);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from("contratos")
      .createSignedUrl(storagePath, 3600);

    await supabase
      .from("contratos_arrendamiento")
      .update({
        archivo_nombre: file.name,
        storage_path: storagePath,
        archivo_url: urlData?.signedUrl || null,
      } as any)
      .eq("id", contratoId)
      .eq("user_id", user.id);

    invalidate();
    return urlData?.signedUrl || null;
  };

  const uploadDocumentoOriginal = async (contratoId: string, file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `original_${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${contratoId}/original/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("contratos")
      .upload(storagePath, file);

    if (uploadError) {
      toast({ title: "Error", description: "No se pudo subir el documento original.", variant: "destructive" });
      console.error(uploadError);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from("contratos")
      .createSignedUrl(storagePath, 3600);

    await supabase
      .from("contratos_arrendamiento")
      .update({
        documento_original_nombre: file.name,
        documento_original_path: storagePath,
        documento_original_url: urlData?.signedUrl || null,
      } as any)
      .eq("id", contratoId)
      .eq("user_id", user.id);

    toast({ title: "Documento subido", description: "El documento original se ha adjuntado correctamente." });
    invalidate();
    return urlData?.signedUrl || null;
  };

  const analyzeContrato = async (file: File): Promise<ContratoAnalysis | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("analyze-contrato", {
        body: { imageBase64: base64, mimeType: file.type || "application/pdf" },
      });

      if (error) throw error;
      return data as ContratoAnalysis;
    } catch (e) {
      console.error("Error analyzing contrato:", e);
      toast({ title: "Error de análisis", description: "No se pudo analizar el contrato. Puedes rellenar los campos manualmente.", variant: "destructive" });
      return null;
    }
  };


  const createCalendarEvents = async (contrato: Contrato) => {
    if (!user || !contrato.fecha_fin || !contrato.property_id) return;

    // Clean up old events for this contract
    await supabase
      .from("property_eventos")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", contrato.property_id)
      .in("subtipo", ["vencimiento_contrato", "aviso_contrato", "aviso_preaviso_contrato", "aviso_interno_contrato"]);

    const tl = getContratoTimeline(contrato);
    if (!tl.fechaFinEfectiva) return;

    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const now = new Date();

    // 1. Renewal/end date event
    await supabase
      .from("property_eventos")
      .insert({
        user_id: user.id,
        property_id: contrato.property_id,
        titulo: `📋 Renovación contrato: ${contrato.titulo}`,
        descripcion: `El contrato se renueva automáticamente en esta fecha a no ser que se notifique lo contrario. Renta: ${contrato.renta_mensual ? contrato.renta_mensual + " €/mes" : "N/A"}`,
        fecha: fmt(tl.fechaFinEfectiva),
        tipo: "contrato",
        subtipo: "vencimiento_contrato",
        visible_para_inquilino: true,
        recurrente: false,
      } as any);

    // 2. Internal app alert (30d before preaviso)
    if (tl.fechaAvisoInterno && tl.fechaAvisoInterno > now) {
      await supabase
        .from("property_eventos")
        .insert({
          user_id: user.id,
          property_id: contrato.property_id,
          titulo: `🔔 Aviso: preaviso de contrato próximo`,
          descripcion: `En 30 días comienza el plazo de preaviso del contrato "${contrato.titulo}". Es momento de decidir: renovar, actualizar IPC o no renovar.`,
          fecha: fmt(tl.fechaAvisoInterno),
          tipo: "contrato",
          subtipo: "aviso_interno_contrato",
          visible_para_inquilino: false,
          recurrente: false,
        } as any);
    }

    // 3. Preaviso deadline (fecha límite para comunicar no renovación)
    if (tl.fechaLimitePreaviso && tl.fechaLimitePreaviso > now) {
      const preavisoMeses = contrato.preaviso_meses || 2;
      await supabase
        .from("property_eventos")
        .insert({
          user_id: user.id,
          property_id: contrato.property_id,
          titulo: `⚠️ URGENTE: Fecha límite preaviso contrato`,
          descripcion: `Hoy comienza el plazo de preaviso (${preavisoMeses} meses). Si no se comunica la no renovación, el contrato "${contrato.titulo}" se renovará automáticamente.`,
          fecha: fmt(tl.fechaLimitePreaviso),
          tipo: "contrato",
          subtipo: "aviso_preaviso_contrato",
          visible_para_inquilino: false,
          recurrente: false,
        } as any);
    }
  };

  return {
    contratos,
    loading,
    createContrato,
    updateContrato,
    updateContratoWithHistory,
    deleteContrato,
    archiveContrato,
    uploadArchivo,
    uploadDocumentoOriginal,
    analyzeContrato,
    createCalendarEvents,
    addHistorial,
    fetchHistorial,
    fetchHistorialByProperty,
    refetch: fetchContratos,
  };
}
