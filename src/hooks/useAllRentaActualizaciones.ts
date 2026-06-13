import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { RentaTramo } from "@/lib/rentaUtils";

/**
 * H2.5 — Carga todos los tramos `renta_actualizaciones` del usuario en un solo
 * query y los devuelve indexados por `property_id`. Necesario para que el
 * dashboard / calendario / motor financiero puedan resolver la renta vigente
 * por mes sin caer al `contrato.renta_mensual` actual para periodos pasados.
 */
export interface AllRentaActualizacionesResult {
  byProperty: Map<string, RentaTramo[]>;
  isLoading: boolean;
}

export function useAllRentaActualizaciones(): AllRentaActualizacionesResult {
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["renta_actualizaciones", "all", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("renta_actualizaciones")
        .select("property_id, fecha_efectiva, importe_nuevo, importe_anterior")
        .eq("user_id", user.id)
        .order("fecha_efectiva", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        property_id: string;
        fecha_efectiva: string;
        importe_nuevo: number;
        importe_anterior: number | null;
      }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const byProperty = useMemo(() => {
    const map = new Map<string, RentaTramo[]>();
    for (const row of data) {
      const arr = map.get(row.property_id) ?? [];
      arr.push({
        fecha_efectiva: row.fecha_efectiva,
        importe_nuevo: Number(row.importe_nuevo),
        importe_anterior: row.importe_anterior != null ? Number(row.importe_anterior) : null,
      });
      map.set(row.property_id, arr);
    }
    return map;
  }, [data]);

  return { byProperty, isLoading };
}
