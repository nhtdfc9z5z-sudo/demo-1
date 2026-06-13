import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PropertyEvento {
  id: string;
  user_id: string;
  property_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  tipo: string;
  subtipo: string | null;
  importe: number | null;
  recurrente: boolean;
  recurrencia_meses: number | null;
  visible_para_inquilino: boolean;
  created_at: string;
  updated_at: string;
}

export function usePropertyEventos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eventos = [], isLoading: loading } = useQuery({
    queryKey: ["property_eventos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("property_eventos")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PropertyEvento[];
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["property_eventos", user?.id] });

  const createEvento = async (data: Omit<PropertyEvento, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;
    const { data: created, error } = await supabase
      .from("property_eventos")
      .insert({ ...data, user_id: user.id } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: "No se pudo crear el evento.", variant: "destructive" });
      return null;
    }
    toast({ title: "Evento creado" });
    invalidate();
    return created as unknown as PropertyEvento;
  };

  const updateEvento = async (id: string, data: Partial<PropertyEvento>) => {
    if (!user) return;
    const { error } = await supabase
      .from("property_eventos")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    } else {
      invalidate();
    }
  };

  const deleteEvento = async (id: string) => {
    if (!user) return;
    await supabase.from("property_eventos").delete().eq("id", id).eq("user_id", user.id);
    invalidate();
  };

  return { eventos, loading, fetchEventos: invalidate, createEvento, updateEvento, deleteEvento };
}
