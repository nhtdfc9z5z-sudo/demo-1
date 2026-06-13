import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PerfilEconomico {
  id: string;
  inquilino_id: string;
  user_id: string;
  ingresos_mensuales: number | null;
  ingresos_tipo: string | null;
  situacion_laboral: string | null;
  empresa_actual: string | null;
  antiguedad_laboral_meses: number | null;
  renta_maxima_estimada: number | null;
  ratio_esfuerzo: number | null;
  scoring_estado: string;
  scoring_notas: string | null;
  tiene_aval_bancario: boolean;
  deudas_conocidas: boolean;
  updated_at: string;
}

const SCORING_LABELS: Record<string, string> = {
  sin_datos: "Sin datos",
  favorable: "Favorable",
  desfavorable: "Desfavorable",
  pendiente: "Pendiente de revisión",
};

const SCORING_COLORS: Record<string, string> = {
  sin_datos: "bg-muted text-muted-foreground",
  favorable: "bg-emerald-100 text-emerald-800",
  desfavorable: "bg-red-100 text-red-800",
  pendiente: "bg-amber-100 text-amber-800",
};

export { SCORING_LABELS, SCORING_COLORS };

export function usePerfilEconomico(inquilinoId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [perfil, setPerfil] = useState<PerfilEconomico | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!inquilinoId || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("inquilino_perfil_economico" as any)
      .select("*")
      .eq("inquilino_id", inquilinoId)
      .maybeSingle();
    if (error) console.error("Error fetching perfil económico:", error);
    setPerfil(data as unknown as PerfilEconomico | null);
    setLoading(false);
  }, [inquilinoId, user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const upsert = async (data: Partial<PerfilEconomico>) => {
    if (!inquilinoId || !user) return;

    if (perfil) {
      // Update
      const { error } = await supabase
        .from("inquilino_perfil_economico" as any)
        .update(data as any)
        .eq("id", perfil.id);
      if (error) {
        toast({ title: "Error", description: "No se pudo guardar el perfil económico.", variant: "destructive" });
        return;
      }
    } else {
      // Insert
      const { error } = await supabase
        .from("inquilino_perfil_economico" as any)
        .insert({ ...data, inquilino_id: inquilinoId, user_id: user.id } as any);
      if (error) {
        toast({ title: "Error", description: "No se pudo crear el perfil económico.", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Guardado", description: "Perfil económico actualizado." });
    await fetch();
  };

  return { perfil, loading, upsert, refetch: fetch };
}
