import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { insertSubactivoRow, type SubactivoTable } from "@/lib/altas/raw";

export function useInmuebleGeneric<T extends { id: string }>(
  tableName: string,
  labelSingular: string,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: [tableName, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [tableName, user?.id] });

  const createMut = useMutation({
    mutationFn: async (data: Omit<Partial<T>, "id" | "user_id">) => {
      if (!user) throw new Error("No user");
      // Todas las altas pasan por el motor único en `src/lib/altas/`.
      // El guard `no-direct-inserts` prohíbe llamar a supabase.from(...).insert()
      // sobre tablas de subactivo fuera de `src/lib/altas/`.
      const created = await insertSubactivoRow(
        tableName as SubactivoTable,
        data as Record<string, unknown>,
      );
      return created as unknown as T;
    },
    onSuccess: () => {
      toast({ title: `${labelSingular} creado`, description: "Se ha añadido correctamente." });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: `No se pudo crear el ${labelSingular.toLowerCase()}.`, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from(tableName as any)
        .update(data as any)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Guardado", description: `${labelSingular} actualizado.` });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Eliminado", description: `${labelSingular} eliminado.` });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    },
  });

  const create = async (data: Omit<Partial<T>, "id" | "user_id">) => {
    try { return await createMut.mutateAsync(data); } catch { return null; }
  };
  const update = async (id: string, data: Partial<T>) => {
    try { await updateMut.mutateAsync({ id, data }); } catch {}
  };
  const remove = async (id: string) => {
    try { await deleteMut.mutateAsync(id); } catch {}
  };

  return { items, loading, create, update, remove, refetch: invalidate };
}
