import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type NaturalezaCambio = "correccion_interna" | "notificable" | "requiere_acuerdo";
export type TipoCambio = "ipc" | "renta_manual" | "suministro" | "condicion" | "anexo" | "otro";
export type SoporteCambio = "anexo_firmado" | "email" | "whatsapp" | "verbal" | "portal" | "otro";
export type CanalComunicacion = "portal" | "email" | "whatsapp" | "presencial" | "burofax" | "otro";

export interface ContratoModificacion {
  id: string;
  user_id: string;
  contrato_id: string;
  property_id: string;
  naturaleza: NaturalezaCambio;
  tipo_cambio: TipoCambio;
  campo_afectado: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  motivo: string | null;
  fecha_registro: string;
  fecha_efectiva: string | null;
  soporte: SoporteCambio | null;
  soporte_archivo_path: string | null;
  soporte_archivo_url: string | null;
  comunicado: boolean;
  fecha_comunicacion: string | null;
  canal_comunicacion: CanalComunicacion | null;
  confirmado_por_inquilino: boolean;
  fecha_confirmacion: string | null;
  notas: string | null;
  created_at: string;
}

export interface CreateModificacionData {
  contrato_id: string;
  property_id: string;
  naturaleza?: NaturalezaCambio;
  tipo_cambio: TipoCambio;
  campo_afectado?: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  motivo?: string;
  fecha_efectiva?: string;
  soporte?: SoporteCambio;
  comunicado?: boolean;
  fecha_comunicacion?: string;
  canal_comunicacion?: CanalComunicacion;
  notas?: string;
}

export function useContratoModificaciones(contratoId?: string | null) {
  const { user } = useAuth();
  const [modificaciones, setModificaciones] = useState<ContratoModificacion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModificaciones = useCallback(async () => {
    if (!user || !contratoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_modificaciones")
      .select("*")
      .eq("contrato_id", contratoId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setModificaciones(data as unknown as ContratoModificacion[]);
    if (error) console.error("Error fetching modificaciones:", error);
    setLoading(false);
  }, [user, contratoId]);

  useEffect(() => {
    fetchModificaciones();
  }, [fetchModificaciones]);

  const addModificacion = async (data: CreateModificacionData) => {
    if (!user) return null;
    const { data: created, error } = await supabase
      .from("contrato_modificaciones")
      .insert({
        ...data,
        user_id: user.id,
        naturaleza: data.naturaleza || "notificable",
      } as any)
      .select()
      .single();
    if (error) {
      console.error("Error creating modificacion:", error);
      return null;
    }

    // Sprint 3 — modelo unificado de renta:
    // Si la modificación afecta a la renta (IPC o cambio manual) y trae
    // `fecha_efectiva` + `valor_nuevo` numérico, generamos automáticamente
    // la entrada en `renta_actualizaciones` (fuente de verdad para el
    // cálculo económico y deuda por periodo). Si falla, NO bloqueamos la
    // modificación: la fiscalidad/comunicación legal ya quedó registrada.
    if (
      (data.tipo_cambio === "ipc" || data.tipo_cambio === "renta_manual") &&
      data.fecha_efectiva &&
      data.valor_nuevo
    ) {
      const importeNuevo = parseFloat(String(data.valor_nuevo).replace(",", "."));
      const importeAnterior = data.valor_anterior
        ? parseFloat(String(data.valor_anterior).replace(",", "."))
        : null;
      if (!isNaN(importeNuevo) && importeNuevo > 0) {
        // Evita duplicados exactos (mismo contrato + misma fecha_efectiva + mismo importe)
        const { data: existente } = await supabase
          .from("renta_actualizaciones")
          .select("id")
          .eq("contrato_id", data.contrato_id)
          .eq("fecha_efectiva", data.fecha_efectiva)
          .eq("importe_nuevo", importeNuevo)
          .maybeSingle();
        if (!existente) {
          const { error: errAct } = await supabase.from("renta_actualizaciones").insert({
            user_id: user.id,
            property_id: data.property_id,
            contrato_id: data.contrato_id,
            fecha_efectiva: data.fecha_efectiva,
            importe_nuevo: importeNuevo,
            importe_anterior: importeAnterior != null && !isNaN(importeAnterior) ? importeAnterior : null,
            motivo: data.tipo_cambio === "ipc" ? "ipc" : "manual",
            notas: data.motivo || null,
          } as any);
          if (errAct) {
            console.error("Error creando tramo en renta_actualizaciones:", errAct);
          }
        }
      }
    }

    await fetchModificaciones();
    return created as unknown as ContratoModificacion;
  };

  const updateModificacion = async (id: string, data: Partial<ContratoModificacion>) => {
    if (!user) return;
    await supabase
      .from("contrato_modificaciones")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user.id);
    await fetchModificaciones();
  };

  const addComunicacion = async (id: string, canal: CanalComunicacion) => {
    // Marks as comunicado and records the channel. If already comunicado,
    // appends the new channel info (overwrites canal but keeps history via
    // the notas field — a lightweight approach without a separate table).
    const existing = modificaciones.find(m => m.id === id);
    let notasUpdate = existing?.notas || "";
    if (existing?.comunicado && existing.canal_comunicacion) {
      // Already had a channel — append the previous one to notas for traceability
      const prev = `Comunicado también por: ${CANAL_LABELS[existing.canal_comunicacion]} (${new Date(existing.fecha_comunicacion || "").toLocaleDateString("es-ES")})`;
      notasUpdate = notasUpdate ? `${notasUpdate}\n${prev}` : prev;
    }
    await updateModificacion(id, {
      comunicado: true,
      fecha_comunicacion: new Date().toISOString(),
      canal_comunicacion: canal,
      ...(notasUpdate !== (existing?.notas || "") ? { notas: notasUpdate } : {}),
    });
  };

  const markConfirmado = async (id: string) => {
    await updateModificacion(id, {
      confirmado_por_inquilino: true,
      fecha_confirmacion: new Date().toISOString(),
    });
  };

  return {
    modificaciones,
    loading,
    addModificacion,
    updateModificacion,
    addComunicacion,
    markConfirmado,
    refetch: fetchModificaciones,
  };
}

// Labels for UI
export const NATURALEZA_LABELS: Record<NaturalezaCambio, { label: string; color: string }> = {
  correccion_interna: { label: "Corrección interna", color: "bg-muted text-muted-foreground" },
  notificable: { label: "Notificable", color: "bg-amber-100 text-amber-800 border-amber-200" },
  requiere_acuerdo: { label: "Requiere acuerdo", color: "bg-red-100 text-red-800 border-red-200" },
};

export const TIPO_CAMBIO_LABELS: Record<TipoCambio, string> = {
  ipc: "Actualización IPC",
  renta_manual: "Cambio de renta",
  suministro: "Suministro/gasto",
  condicion: "Condición contractual",
  anexo: "Anexo",
  otro: "Otro",
};

export const SOPORTE_LABELS: Record<SoporteCambio, string> = {
  anexo_firmado: "Anexo firmado",
  email: "Email",
  whatsapp: "WhatsApp",
  verbal: "Verbal",
  portal: "Portal inquilino",
  otro: "Otro",
};

export const CANAL_LABELS: Record<CanalComunicacion, string> = {
  portal: "Portal inquilino",
  email: "Email",
  whatsapp: "WhatsApp",
  presencial: "Presencial",
  burofax: "Burofax",
  otro: "Otro",
};
