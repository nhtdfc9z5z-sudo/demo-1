import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { parteFromRol } from "@/lib/contratoRoles";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { captureAppError } from "@/lib/observability";

/** Conjunto extendido de roles contractuales (legados + nuevos). */
export type ContratoPersonaRol =
  | "titular_principal"
  | "cotitular"
  | "ocupante"
  | "avalista"
  | "arrendador"
  | "coarrendador"
  | "arrendatario"
  | "coarrendatario"
  | "subarrendador"
  | "subarrendatario"
  | "gestor"
  | "administrador"
  | "contacto_autorizado";

export const ROL_LABEL: Record<string, string> = {
  titular_principal: "Titular principal",
  cotitular: "Cotitular",
  ocupante: "Ocupante",
  avalista: "Avalista",
  arrendador: "Arrendador",
  coarrendador: "Coarrendador",
  arrendatario: "Arrendatario",
  coarrendatario: "Coarrendatario",
  subarrendador: "Subarrendador",
  subarrendatario: "Subarrendatario",
  gestor: "Gestor",
  administrador: "Administrador",
  contacto_autorizado: "Contacto autorizado",
};

export type ParteContrato = "arrendadora" | "arrendataria" | "gestion" | "garantia" | "otro";

export interface ContratoPersona {
  id: string;
  user_id: string;
  contrato_id: string;
  property_id: string;
  inquilino_id: string | null;
  rol: ContratoPersonaRol;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  orden: number | null;
  created_at: string;
  updated_at: string;
  parte: ParteContrato;
  porcentaje_participacion: number | null;
  porcentaje_fiscal: number | null;
  afecta_fiscalidad: boolean;
  es_yo: boolean;
}

export function useContratoPersonas(contratoId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["contrato-personas", contratoId, user?.id] as const;

  const { data: personas = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    enabled: !!user && !!contratoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contrato_personas")
        .select("*")
        .eq("contrato_id", contratoId)
        .eq("user_id", user!.id)
        .order("orden", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ContratoPersona[]) || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contrato-personas"] });
    invalidateFiscalChain(qc);
  };

  const createPersona = async (data: Partial<ContratoPersona>) => {
    if (!user) return null;
    // Derivar parte y defaults fiscales según rol si no vienen.
    const rol = (data.rol || "cotitular") as string;
    const parte = (data.parte as any) ?? parteFromRol(rol);
    const afectaFiscalidadDefault = parte === "arrendadora";
    const payload: any = {
      ...data,
      user_id: user.id,
      parte,
      afecta_fiscalidad: data.afecta_fiscalidad ?? afectaFiscalidadDefault,
    };
    const { data: created, error } = await (supabase as any)
      .from("contrato_personas")
      .insert(payload)
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: "No se pudo añadir la persona.", variant: "destructive" });
      void captureAppError({
        event: "contrato_personas.create",
        message: "Fallo al crear persona del contrato",
        severity: "error", audit: true, error,
        context: { contrato_id: contratoId, rol },
      });
      return null;
    }
    invalidate();
    return created as ContratoPersona;
  };

  const deletePersona = async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("contrato_personas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
      void captureAppError({
        event: "contrato_personas.delete",
        message: "Fallo al eliminar persona del contrato",
        severity: "error", audit: true, error,
        context: { contrato_id: contratoId },
      });
      return;
    }
    invalidate();
  };

  const updatePersona = async (id: string, data: Partial<ContratoPersona>) => {
    if (!user) return null;
    const { error } = await (supabase as any)
      .from("contrato_personas")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
      void captureAppError({
        event: "contrato_personas.update",
        message: "Fallo al actualizar persona del contrato",
        severity: "error", audit: true, error,
        context: { contrato_id: contratoId },
      });
      return null;
    }
    invalidate();
    return true;
  };

  const reorderPersonas = async (orderedIds: string[]) => {
    if (!user) return;
    // Optimistic update sobre la query cache
    qc.setQueryData<ContratoPersona[]>(queryKey, (prev) => {
      if (!prev) return prev;
      const map = new Map(prev.map(p => [p.id, p]));
      return orderedIds.map((id, i) => ({ ...(map.get(id)!), orden: i }));
    });
    await Promise.all(
      orderedIds.map((id, i) =>
        (supabase as any)
          .from("contrato_personas")
          .update({ orden: i } as any)
          .eq("id", id)
          .eq("user_id", user.id)
      )
    );
    invalidate();
  };

  return { personas, loading, createPersona, updatePersona, deletePersona, reorderPersonas, refetch };
}