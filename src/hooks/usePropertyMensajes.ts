import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PropertyMensaje {
  id: string;
  property_id: string;
  user_id: string;
  autor: string;
  mensaje: string;
  incidencia_id: string | null;
  created_at: string;
  updated_at: string;
}

export function usePropertyMensajes() {
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMensajes = useCallback(async (propertyId: string): Promise<PropertyMensaje[]> => {
    const { data } = await (supabase as any)
      .from("property_mensajes")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    return data || [];
  }, []);

  const createMensaje = useCallback(async (
    propertyId: string,
    autor: string,
    mensaje: string,
    incidenciaId?: string | null
  ) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("property_mensajes")
      .insert({
        property_id: propertyId,
        user_id: user.id,
        autor,
        mensaje,
        incidencia_id: incidenciaId || null,
      });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [user, toast]);

  const updateMensaje = useCallback(async (id: string, mensaje: string) => {
    const { error } = await (supabase as any)
      .from("property_mensajes")
      .update({ mensaje })
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }, [toast]);

  const deleteMensaje = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("property_mensajes")
      .delete()
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }, [toast]);

  return { fetchMensajes, createMensaje, updateMensaje, deleteMensaje };
}
