import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type GarantiaTipo = "metalico" | "aval" | "seguro" | "otro";
export type GarantiaEstado = "vigente" | "devuelta_parcial" | "devuelta_total" | "cancelada";

export interface GarantiaAdicional {
  id: string;
  user_id: string;
  contrato_id: string;
  property_id: string;
  inquilino_id: string | null;
  importe: number;
  mensualidades_equivalentes: number | null;
  tipo: GarantiaTipo;
  estado: GarantiaEstado;
  fecha_entrega: string | null;
  fecha_devolucion: string | null;
  notas: string | null;
  documento_url: string | null;
  documento_path: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPOS_GARANTIA: { value: GarantiaTipo; label: string }[] = [
  { value: "metalico", label: "Metálico" },
  { value: "aval", label: "Aval" },
  { value: "seguro", label: "Seguro" },
  { value: "otro", label: "Otro" },
];

export const ESTADOS_GARANTIA: { value: GarantiaEstado; label: string }[] = [
  { value: "vigente", label: "Vigente" },
  { value: "devuelta_parcial", label: "Devuelta parcial" },
  { value: "devuelta_total", label: "Devuelta total" },
  { value: "cancelada", label: "Cancelada" },
];

export function useGarantiasAdicionales(contratoId?: string | null) {
  const { user } = useAuth();
  const [garantias, setGarantias] = useState<GarantiaAdicional[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGarantias = useCallback(async () => {
    if (!user || !contratoId) {
      setGarantias([]);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contrato_garantias_adicionales")
      .select("*")
      .eq("user_id", user.id)
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching garantías:", error);
    else setGarantias((data as GarantiaAdicional[]) || []);
    setLoading(false);
  }, [user, contratoId]);

  useEffect(() => {
    fetchGarantias();
  }, [fetchGarantias]);

  const createGarantia = async (data: Partial<GarantiaAdicional>): Promise<GarantiaAdicional | null> => {
    if (!user) return null;
    const { data: inserted, error } = await (supabase as any)
      .from("contrato_garantias_adicionales")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) { toast.error("No se pudo guardar la garantía"); console.error(error); return null; }
    setGarantias((prev) => [inserted as GarantiaAdicional, ...prev]);
    toast.success("Garantía registrada");
    return inserted as GarantiaAdicional;
  };

  const updateGarantia = async (id: string, updates: Partial<GarantiaAdicional>) => {
    const { error } = await (supabase as any)
      .from("contrato_garantias_adicionales")
      .update(updates)
      .eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    setGarantias((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } as GarantiaAdicional : g)));
  };

  const deleteGarantia = async (id: string) => {
    const { error } = await (supabase as any)
      .from("contrato_garantias_adicionales")
      .delete()
      .eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    setGarantias((prev) => prev.filter((g) => g.id !== id));
    toast.success("Garantía eliminada");
  };

  return { garantias, loading, createGarantia, updateGarantia, deleteGarantia, refetch: fetchGarantias };
}