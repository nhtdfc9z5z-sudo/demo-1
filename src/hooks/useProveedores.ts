import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Proveedor {
  id: string;
  user_id: string;
  nombre: string;
  nombre_comercial: string | null;
  cif: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  municipio: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  persona_contacto: string | null;
  especialidad: string | null;
  valoracion: number | null;
  es_habitual: boolean;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const ESPECIALIDADES_PROVEEDOR = [
  "Fontanería",
  "Electricidad",
  "Pintura",
  "Cerrajería",
  "Cristalería",
  "Albañilería",
  "Carpintería",
  "Climatización",
  "Limpieza",
  "Jardinería",
  "Electrodomésticos",
  "Reformas integrales",
  "Mudanzas",
  "Control de plagas",
  "Otro",
] as const;

export function useProveedores() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proveedores = [], isLoading: loading } = useQuery({
    queryKey: ["proveedores", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("proveedores")
        .select("*")
        .eq("user_id", user.id)
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data || []) as Proveedor[];
    },
    enabled: !!user,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["proveedores", user?.id] });

  const createMut = useMutation({
    mutationFn: async (d: Partial<Proveedor>) => {
      if (!user) throw new Error("No user");
      const { data, error } = await (supabase as any)
        .from("proveedores")
        .insert({ ...d, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Proveedor;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: Partial<Proveedor> }) => {
      const { error } = await (supabase as any)
        .from("proveedores")
        .update(d)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("proveedores")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Proveedor eliminado" });
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const createProveedor = async (d: Partial<Proveedor>): Promise<Proveedor | null> => {
    try {
      return await createMut.mutateAsync(d);
    } catch {
      return null;
    }
  };

  const updateProveedor = async (id: string, d: Partial<Proveedor>) => {
    try {
      await updateMut.mutateAsync({ id, d });
    } catch {}
  };

  const deleteProveedor = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch {}
  };

  /**
   * Find existing proveedor by CIF first, then by normalized name.
   * Returns null if no match — never does ambiguous merges.
   */
  const findExisting = (cif?: string | null, nombre?: string | null): Proveedor | null => {
    if (cif && cif.trim()) {
      const byCif = proveedores.find(
        (p) => p.cif && p.cif.trim().toUpperCase() === cif.trim().toUpperCase()
      );
      if (byCif) return byCif;
    }
    if (nombre && nombre.trim()) {
      const norm = nombre.trim().toLowerCase();
      const byName = proveedores.filter(
        (p) => p.nombre.trim().toLowerCase() === norm
      );
      // Only return if exactly one match — no ambiguous merges
      if (byName.length === 1) return byName[0];
    }
    return null;
  };

  /**
   * Find or create a proveedor. Used when saving incidencia data.
   * Priority: CIF match → exact name match → create new.
   */
  const findOrCreate = async (
    data: Partial<Proveedor>
  ): Promise<Proveedor | null> => {
    if (!data.nombre?.trim()) return null;
    const existing = findExisting(data.cif, data.nombre);
    if (existing) return existing;
    return createProveedor(data);
  };

  return {
    proveedores,
    loading,
    createProveedor,
    updateProveedor,
    deleteProveedor,
    findExisting,
    findOrCreate,
  };
}
