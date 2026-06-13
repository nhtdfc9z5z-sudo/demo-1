import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { insertInquilinoRow } from "@/lib/altas/raw";

export interface Inquilino {
  id: string;
  user_id: string;
  property_id: string | null;
  nombre: string;
  apellidos: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  fecha_entrada: string | null;
  fecha_salida: string | null;
  renta_mensual: number | null;
  fianza: number | null;
  deposito_garantia: number | null;
  estado: string | null;
  notas: string | null;
  tipo_inquilino: string | null;
  rol_inquilino: string | null;
  auth_user_id: string | null;
  orden: number | null;
  created_at: string;
  updated_at: string;
}

export interface InquilinoDocumento {
  id: string;
  inquilino_id: string;
  user_id: string;
  categoria: string;
  nombre_archivo: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export function useInquilinos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inquilinos = [], isLoading: loading } = useQuery({
    queryKey: ["inquilinos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("inquilinos")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at" as any, null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Inquilino[];
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["inquilinos", user?.id] });

  const createMut = useMutation({
    mutationFn: async (data: Partial<Inquilino>) => {
      if (!user) throw new Error("No user");
      const created = await insertInquilinoRow({ ...data, nombre: data.nombre || "Sin nombre" });
      return created as unknown as Inquilino;
    },
    onSuccess: () => {
      toast({ title: "Inquilino creado", description: "Se ha añadido correctamente." });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el inquilino.", variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Inquilino> }) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("inquilinos")
        .update(data as any)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Guardado", description: "Inquilino actualizado." });
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
        .from("inquilinos")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Movido a la papelera", description: "Puedes restaurarlo durante 30 días." });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    },
  });

  // Backwards-compatible wrappers
  const createInquilino = async (data: Partial<Inquilino>) => {
    try {
      return await createMut.mutateAsync(data);
    } catch {
      return null;
    }
  };

  const updateInquilino = async (id: string, data: Partial<Inquilino>) => {
    try {
      await updateMut.mutateAsync({ id, data });
    } catch {}
  };

  const deleteInquilino = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch {}
  };

  const reorderInquilinos = async (orderedIds: string[]) => {
    if (!user) return;
    // Optimistic
    queryClient.setQueryData(["inquilinos", user.id], (prev: Inquilino[] | undefined) => {
      if (!prev) return prev;
      const ordenMap = new Map(orderedIds.map((id, i) => [id, i]));
      return prev.map(i => ordenMap.has(i.id) ? { ...i, orden: ordenMap.get(i.id)! } : i);
    });
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from("inquilinos").update({ orden: i } as any).eq("id", id).eq("user_id", user.id)
      )
    );
    invalidate();
  };

  // Document management — imperative (not cached)
  const fetchDocumentos = async (inquilinoId: string): Promise<InquilinoDocumento[]> => {
    const { data, error } = await supabase
      .from("inquilino_documentos")
      .select("*")
      .eq("inquilino_id", inquilinoId)
      .order("created_at", { ascending: false });
    if (error) { console.error("Error fetching documentos:", error); return []; }
    return (data || []) as unknown as InquilinoDocumento[];
  };

  const uploadDocumento = async (inquilinoId: string, file: File, categoria: string): Promise<InquilinoDocumento | null> => {
    if (!user) return null;

    // Validate file before upload
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "document", toast)) return null;

    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${inquilinoId}/${categoria}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("inquilino-documentos").upload(storagePath, file);
    if (uploadError) {
      toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from("inquilino-documentos")
      .createSignedUrl(storagePath, 3600);
    const { data: doc, error: insertError } = await supabase
      .from("inquilino_documentos")
      .insert({ inquilino_id: inquilinoId, user_id: user.id, categoria, nombre_archivo: file.name, storage_path: storagePath, url: urlData?.signedUrl || "" } as any)
      .select()
      .single();

    if (insertError) {
      toast({ title: "Error", description: "No se pudo guardar el documento.", variant: "destructive" });
      return null;
    }
    toast({ title: "Documento subido", description: file.name });
    return doc as unknown as InquilinoDocumento;
  };

  const deleteDocumento = async (doc: InquilinoDocumento) => {
    if (!user) return;
    await supabase.storage.from("inquilino-documentos").remove([doc.storage_path]);
    const { error } = await supabase.from("inquilino_documentos").delete().eq("id", doc.id).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
    } else {
      toast({ title: "Eliminado", description: "Documento eliminado." });
    }
  };

  return {
    inquilinos,
    loading,
    createInquilino,
    updateInquilino,
    deleteInquilino,
    reorderInquilinos,
    fetchDocumentos,
    uploadDocumento,
    deleteDocumento,
    refetch: invalidate,
  };
}
