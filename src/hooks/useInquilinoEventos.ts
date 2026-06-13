import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InquilinoEvento {
  id: string;
  inquilino_id: string;
  auth_user_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  tipo: string;
  created_at: string;
  visible_para_inquilino: boolean;
  notificar_inquilino: boolean;
}

export function useInquilinoEventos(inquilinoId: string | null, authUserId: string | null) {
  const [eventos, setEventos] = useState<InquilinoEvento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEventos = useCallback(async () => {
    if (!inquilinoId) return;
    setLoading(true);
    const { data } = await supabase
      .from("inquilino_eventos")
      .select("*")
      .eq("inquilino_id", inquilinoId)
      .order("fecha", { ascending: true });
    if (data) setEventos(data as unknown as InquilinoEvento[]);
    setLoading(false);
  }, [inquilinoId]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  const createEvento = async (data: {
    titulo: string;
    descripcion?: string;
    fecha: string;
    hora?: string;
    tipo: string;
    visible_para_inquilino?: boolean;
    notificar_inquilino?: boolean;
  }) => {
    if (!inquilinoId || !authUserId) throw new Error("No tenant");
    const { error } = await supabase.from("inquilino_eventos").insert({
      inquilino_id: inquilinoId,
      auth_user_id: authUserId,
      titulo: data.titulo,
      descripcion: data.descripcion || null,
      fecha: data.fecha,
      hora: data.hora || null,
      tipo: data.tipo,
      visible_para_inquilino: data.visible_para_inquilino ?? true,
      notificar_inquilino: data.notificar_inquilino ?? false,
    } as any);
    if (error) throw error;
    await fetchEventos();
  };

  const updateEvento = async (id: string, data: {
    titulo?: string;
    descripcion?: string | null;
    fecha?: string;
    hora?: string | null;
    tipo?: string;
    visible_para_inquilino?: boolean;
    notificar_inquilino?: boolean;
  }) => {
    const { error } = await supabase
      .from("inquilino_eventos")
      .update(data as any)
      .eq("id", id);
    if (error) throw error;
    await fetchEventos();
  };

  const deleteEvento = async (id: string) => {
    const { error } = await supabase.from("inquilino_eventos").delete().eq("id", id);
    if (error) throw error;
    setEventos(prev => prev.filter(e => e.id !== id));
  };

  return { eventos, loading, createEvento, updateEvento, deleteEvento, refetch: fetchEventos };
}
