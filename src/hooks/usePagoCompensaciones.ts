import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";

export type CompensacionMotivo =
  | "reparacion"
  | "mantenimiento"
  | "suministros"
  | "acuerdo"
  | "descuento"
  | "otro";

/** Motivos que por defecto sugieren registrar también un gasto deducible del propietario. */
export const MOTIVOS_GASTO_AUTO: CompensacionMotivo[] = [
  "reparacion",
  "mantenimiento",
  "suministros",
];

export interface PagoCompensacion {
  id: string;
  user_id: string;
  pago_renta_id: string;
  contrato_id: string | null;
  property_id: string;
  inquilino_id: string | null;
  mes: number;
  anio: number;
  importe: number;
  motivo: CompensacionMotivo | string;
  descripcion: string | null;
  documento_url: string | null;
  documento_path: string | null;
  crear_gasto: boolean;
  deducible: boolean;
  factura_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompensacionInput {
  pago_renta_id: string;
  property_id: string;
  inquilino_id?: string | null;
  contrato_id?: string | null;
  mes: number;
  anio: number;
  importe: number;
  motivo: CompensacionMotivo;
  descripcion?: string | null;
  crear_gasto?: boolean;
  deducible?: boolean;
  documento_url?: string | null;
  documento_path?: string | null;
  factura_id?: string | null;
}

export function usePagoCompensaciones(options?: {
  userId?: string | null;
  asOwner?: boolean;
  propertyId?: string | null;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["pago_compensaciones", options?.userId, options?.asOwner, options?.propertyId];

  const { data: compensaciones = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from("pago_compensaciones" as any).select("*");
      if (options?.asOwner && options?.userId) q = q.eq("user_id", options.userId);
      if (options?.propertyId) q = q.eq("property_id", options.propertyId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PagoCompensacion[];
    },
    enabled: !!options?.userId || !options?.asOwner,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pago_compensaciones"] });
    queryClient.invalidateQueries({ queryKey: ["pagos_renta"] });
    invalidateFiscalChain(queryClient);
  };

  const createMutation = useMutation({
    mutationFn: async (input: CompensacionInput & { user_id: string }) => {
      const { data, error } = await supabase
        .from("pago_compensaciones" as any)
        .insert({
          user_id: input.user_id,
          pago_renta_id: input.pago_renta_id,
          property_id: input.property_id,
          inquilino_id: input.inquilino_id ?? null,
          contrato_id: input.contrato_id ?? null,
          mes: input.mes,
          anio: input.anio,
          importe: input.importe,
          motivo: input.motivo,
          descripcion: input.descripcion ?? null,
          crear_gasto: input.crear_gasto ?? false,
          deducible: input.deducible ?? false,
          documento_url: input.documento_url ?? null,
          documento_path: input.documento_path ?? null,
          factura_id: input.factura_id ?? null,
        } as any)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PagoCompensacion;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pago_compensaciones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PagoCompensacion> }) => {
      const { error } = await supabase
        .from("pago_compensaciones" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Suma de compensaciones por (property, mes, año). Sólo cuenta para
   * cobertura de renta — NUNCA suma a tesorería/caja.
   */
  const compensadoEnMes = (propertyId: string, mes: number, anio: number): number => {
    return compensaciones
      .filter(c => c.property_id === propertyId && c.mes === mes && c.anio === anio)
      .reduce((s, c) => s + Number(c.importe || 0), 0);
  };

  return {
    compensaciones,
    loading,
    create: createMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    compensadoEnMes,
    compensacionesEnMes: (propertyId: string, mes: number, anio: number) =>
      compensaciones.filter(c => c.property_id === propertyId && c.mes === mes && c.anio === anio),
  };
}