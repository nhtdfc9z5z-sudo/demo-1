import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { captureAppError } from "@/lib/observability";

export interface PropertyGasto {
  id: string;
  user_id: string;
  property_id: string | null;
  categoria: string;
  concepto: string | null;
  importe: number;
  fecha: string;
  /** Fecha de devengo fiscal (opcional). Si está, se usa para imputar al ejercicio en lugar de `fecha`. */
  fecha_devengo?: string | null;
  recurrente: boolean;
  recurrencia: string | null;
  fecha_fin: string | null;
  notas: string | null;
  proveedor_id: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_GASTO = [
  { value: "ibi", label: "IBI" },
  { value: "basuras", label: "Basuras" },
  { value: "comunidad", label: "Comunidad" },
  { value: "derrama", label: "Derrama" },
  { value: "seguro_vivienda", label: "Seguro de vivienda" },
  { value: "seguro_impago", label: "Seguro de impago" },
  { value: "prestamo", label: "Préstamo / Hipoteca" },
  { value: "suministros", label: "Suministros" },
  { value: "reformas", label: "Reformas" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "arreglos", label: "Arreglos" },
  { value: "otro", label: "Otro" },
] as const;

export const RECURRENCIAS = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;

export function usePropertyGastos(propertyId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["gastos", user?.id, propertyId ?? null] as const;

  const { data: gastos = [], isLoading: loading, refetch: fetchGastos } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("property_gastos")
        .select("*")
        .eq("user_id", user!.id)
        .order("fecha", { ascending: false });
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as PropertyGasto[]) || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["gastos"] });
    invalidateFiscalChain(qc);
  };

  const createGasto = async (data: Omit<PropertyGasto, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;
    const { data: created, error } = await supabase
      .from("property_gastos")
      .insert({ ...data, user_id: user.id } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: "No se pudo crear el gasto.", variant: "destructive" });
      void captureAppError({
        event: "gastos.create",
        message: "Fallo al crear gasto",
        severity: "error", audit: true, error,
        context: { property_id: data.property_id, categoria: data.categoria },
      });
      return null;
    }
    toast({ title: "Gasto registrado" });
    invalidate();
    return created as unknown as PropertyGasto;
  };

  const updateGasto = async (id: string, data: Partial<PropertyGasto>) => {
    if (!user) return;
    const { error } = await supabase
      .from("property_gastos")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
      void captureAppError({
        event: "gastos.update",
        message: "Fallo al actualizar gasto",
        severity: "error", audit: true, error,
        context: { gasto_id: id },
      });
    } else {
      invalidate();
    }
  };

  const deleteGasto = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("property_gastos").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      void captureAppError({
        event: "gastos.delete",
        message: "Fallo al eliminar gasto",
        severity: "error", audit: true, error,
        context: { gasto_id: id },
      });
    }
    toast({ title: "Gasto eliminado" });
    invalidate();
  };

  return { gastos, loading, fetchGastos, createGasto, updateGasto, deleteGasto };
}
