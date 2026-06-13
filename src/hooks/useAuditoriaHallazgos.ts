import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useContratos } from "./useContratos";
import { usePagosRenta } from "./usePagosRenta";
import { useProperties } from "./useProperties";
import {
  detectarHallazgos,
  type DetectarHallazgosResult,
} from "@/lib/auditoria/detectarHallazgos";
import type { ContratoPersona } from "./useContratoPersonas";

/**
 * Sprint 3.9 — fuente única para el panel de auditoría de datos legacy.
 * Combina contratos, personas, pagos y properties del usuario y aplica
 * el motor puro `detectarHallazgos`.
 */
export function useAuditoriaHallazgos(): DetectarHallazgosResult & {
  loading: boolean;
} {
  const { user } = useAuth();
  const { contratos, loading: lc } = useContratos();
  const { pagos, loading: lp } = usePagosRenta({ userId: user?.id, asOwner: true });
  const { properties, loading: lpr } = useProperties();

  // contrato_personas global del usuario (no hay hook agregado en el proyecto).
  const { data: personas = [], isLoading: lcp } = useQuery({
    queryKey: ["contrato-personas-all", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contrato_personas")
        .select("contrato_id, inquilino_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data as Pick<ContratoPersona, "contrato_id" | "inquilino_id">[]) || [];
    },
  });

  const result = useMemo(() => {
    if (!user) return { hallazgos: [], agrupadosPorTipo: {} as any, total: 0 };
    return detectarHallazgos({
      contratos: contratos as any,
      contratoPersonas: personas as any,
      pagos: pagos as any,
    });
  }, [user, contratos, personas, pagos, properties]);

  return { ...result, loading: lc || lp || lpr || lcp };
}