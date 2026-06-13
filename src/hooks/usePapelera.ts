import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

export type PapeleraEntityType = "property" | "inquilino" | "factura" | "incidencia";

export interface PapeleraItem {
  id: string;
  tipo: PapeleraEntityType;
  titulo: string;
  subtitulo?: string;
  deleted_at: string;
  diasRestantes: number;
}

const TIPO_CONFIG: Record<PapeleraEntityType, { table: string; label: string }> = {
  property: { table: "properties", label: "Activo" },
  inquilino: { table: "inquilinos", label: "Inquilino" },
  factura: { table: "facturas", label: "Factura" },
  incidencia: { table: "incidencias", label: "Incidencia" },
};

const RETENTION_DAYS = 30;

const calcDiasRestantes = (deletedAt: string): number => {
  const deleted = new Date(deletedAt).getTime();
  const expira = deleted + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expira - Date.now()) / (24 * 60 * 60 * 1000)));
};

export function usePapelera() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["papelera", user?.id],
    queryFn: async (): Promise<PapeleraItem[]> => {
      if (!user) return [];
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [props, inqs, facts, incs] = await Promise.all([
        (supabase as any).from("properties").select("id, nombre_interno, direccion_completa, deleted_at")
          .eq("user_id", user.id).not("deleted_at", "is", null).gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        (supabase as any).from("inquilinos").select("id, nombre, apellidos, email, deleted_at")
          .eq("user_id", user.id).not("deleted_at", "is", null).gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        (supabase as any).from("facturas").select("id, emisor_nombre, numero_factura, total, deleted_at")
          .eq("user_id", user.id).not("deleted_at", "is", null).gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        (supabase as any).from("incidencias").select("id, numero_incidencia, concepto, direccion, deleted_at")
          .eq("user_id", user.id).not("deleted_at", "is", null).gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
      ]);

      const out: PapeleraItem[] = [];
      (props.data || []).forEach((p: any) => out.push({
        id: p.id, tipo: "property",
        titulo: p.nombre_interno || "Sin nombre",
        subtitulo: p.direccion_completa || undefined,
        deleted_at: p.deleted_at, diasRestantes: calcDiasRestantes(p.deleted_at),
      }));
      (inqs.data || []).forEach((i: any) => out.push({
        id: i.id, tipo: "inquilino",
        titulo: `${i.nombre || ""} ${i.apellidos || ""}`.trim() || "Sin nombre",
        subtitulo: i.email || undefined,
        deleted_at: i.deleted_at, diasRestantes: calcDiasRestantes(i.deleted_at),
      }));
      (facts.data || []).forEach((f: any) => out.push({
        id: f.id, tipo: "factura",
        titulo: f.numero_factura || f.emisor_nombre || "Factura",
        subtitulo: f.total != null ? `${Number(f.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : undefined,
        deleted_at: f.deleted_at, diasRestantes: calcDiasRestantes(f.deleted_at),
      }));
      (incs.data || []).forEach((x: any) => out.push({
        id: x.id, tipo: "incidencia",
        titulo: `#${x.numero_incidencia} ${x.concepto || ""}`.trim(),
        subtitulo: x.direccion || undefined,
        deleted_at: x.deleted_at, diasRestantes: calcDiasRestantes(x.deleted_at),
      }));

      return out.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    },
    enabled: !!user,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["papelera", user?.id] });
    qc.invalidateQueries({ queryKey: ["properties", user?.id] });
    qc.invalidateQueries({ queryKey: ["inquilinos", user?.id] });
    qc.invalidateQueries({ queryKey: ["incidencias", user?.id] });
  };

  const restoreMut = useMutation({
    mutationFn: async (item: PapeleraItem) => {
      if (!user) throw new Error("No user");
      const table = TIPO_CONFIG[item.tipo].table;
      const { error } = await (supabase as any).from(table)
        .update({ deleted_at: null })
        .eq("id", item.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_d, item) => {
      toast({ title: "Restaurado", description: `${TIPO_CONFIG[item.tipo].label} restaurado correctamente.` });
      invalidateAll();
    },
    onError: () => toast({ title: "Error", description: "No se pudo restaurar.", variant: "destructive" }),
  });

  const purgeMut = useMutation({
    mutationFn: async (item: PapeleraItem) => {
      if (!user) throw new Error("No user");
      const table = TIPO_CONFIG[item.tipo].table;
      const { error } = await (supabase as any).from(table)
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Eliminado definitivamente" });
      invalidateAll();
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" }),
  });

  return {
    items,
    loading: isLoading,
    restore: (item: PapeleraItem) => restoreMut.mutateAsync(item).catch(() => {}),
    purge: (item: PapeleraItem) => purgeMut.mutateAsync(item).catch(() => {}),
  };
}