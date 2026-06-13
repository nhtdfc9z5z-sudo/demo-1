import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface RentaActualizacion {
  id: string;
  user_id: string;
  property_id: string;
  contrato_id: string | null;
  fecha_efectiva: string;
  importe_anterior: number | null;
  importe_nuevo: number;
  motivo: string | null;
  notas: string | null;
  created_at: string;
}

export function useRentaActualizaciones(propertyId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["renta_actualizaciones", propertyId];

  const { data: actualizaciones = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user || !propertyId) return [];
      const { data, error } = await supabase
        .from("renta_actualizaciones")
        .select("*")
        .eq("property_id", propertyId)
        .eq("user_id", user.id)
        .order("fecha_efectiva", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RentaActualizacion[];
    },
    enabled: !!user && !!propertyId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addActualizacion = async (data: {
    property_id: string;
    contrato_id?: string | null;
    fecha_efectiva: string;
    importe_anterior?: number | null;
    importe_nuevo: number;
    motivo?: string;
    notas?: string;
  }) => {
    if (!user) return;
    await supabase.from("renta_actualizaciones").insert({
      ...data,
      user_id: user.id,
    } as any);
    invalidate();
  };

  const deleteActualizacion = async (id: string) => {
    await supabase.from("renta_actualizaciones").delete().eq("id", id);
    invalidate();
  };

  const getRentaForDate = (date: Date): number | null => {
    if (actualizaciones.length === 0) return null;
    let renta: number | null = null;
    for (const act of actualizaciones) {
      if (new Date(act.fecha_efectiva) <= date) {
        renta = act.importe_nuevo;
      }
    }
    return renta;
  };

  return { actualizaciones, isLoading, addActualizacion, deleteActualizacion, getRentaForDate, refetch: invalidate };
}
