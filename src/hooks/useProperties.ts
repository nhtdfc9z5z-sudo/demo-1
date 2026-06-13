import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { insertPropertyRow } from "@/lib/altas/raw";

export type Property = Tables<"properties">;
export type PropertyInsert = TablesInsert<"properties">;
export type PropertyPhoto = Tables<"property_photos">;

export interface InsuranceEntry {
  tipo: string;
  compania: string;
  num_poliza: string;
  contacto: string;
  importe: number | null;
  vencimiento: string;
}

const normalizeDateField = (value: unknown) => {
  if (typeof value !== "string") return value;
  return value.trim() === "" ? null : value;
};

const normalizePropertyPayload = <T extends Record<string, unknown>>(payload: T): T => {
  return {
    ...payload,
    fecha_fin_derrama: normalizeDateField(payload.fecha_fin_derrama),
    derrama_fecha_inicio: normalizeDateField(payload.derrama_fecha_inicio),
  } as T;
};

export function useProperties() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading: loading } = useQuery({
    queryKey: ["properties", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["properties", user?.id] });

  const createMut = useMutation({
    mutationFn: async (data: Omit<PropertyInsert, "user_id">) => {
      if (!user) throw new Error("No user");
      const normalized = normalizePropertyPayload(data as unknown as Record<string, unknown>);
      const created = await insertPropertyRow(normalized);
      return created as unknown as Property;
    },
    onSuccess: () => {
      toast({ title: "Vivienda creada", description: "Se ha añadido correctamente." });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la vivienda.", variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Property> }) => {
      if (!user) throw new Error("No user");
      const normalized = normalizePropertyPayload(data as unknown as Record<string, unknown>);
      const { error } = await supabase
        .from("properties")
        .update(normalized)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Guardado", description: "Vivienda actualizada." });
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
        .from("properties")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Movida a la papelera", description: "Puedes restaurarla durante 30 días." });
      invalidate();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    },
  });

  // Photo management — keep as async functions (not cached)
  const uploadPhoto = async (propertyId: string, file: File, orden: number) => {
    if (!user) return null;

    // Validate file before upload
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "photo", toast)) return null;

    const { default: heic2any } = await import("heic2any");

    let processedFile = file;
    const name = file.name.toLowerCase();
    if (name.endsWith(".heic") || name.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif") {
      try {
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }) as Blob;
        processedFile = new File([blob], file.name.replace(/\.heic$|\.heif$/i, ".jpg"), { type: "image/jpeg" });
      } catch (e) {
        console.error("HEIC conversion failed:", e);
        toast({ title: "Error", description: "No se pudo convertir la imagen HEIC.", variant: "destructive" });
        return null;
      }
    }

    const ext = processedFile.name.split(".").pop();
    const path = `${user.id}/${propertyId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("property-photos")
      .upload(path, processedFile);

    if (uploadError) {
      toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("property-photos")
      .getPublicUrl(path);

    const { data: photo, error } = await supabase
      .from("property_photos")
      .insert({
        property_id: propertyId,
        user_id: user.id,
        url: publicUrl.publicUrl,
        storage_path: path,
        orden,
        es_principal: orden === 0,
      })
      .select()
      .single();

    if (error) console.error(error);
    return photo;
  };

  const getPhotos = async (propertyId: string) => {
    const { data } = await supabase
      .from("property_photos")
      .select("*")
      .eq("property_id", propertyId)
      .order("orden");
    return data ?? [];
  };

  const deletePhoto = async (photo: PropertyPhoto) => {
    await supabase.storage.from("property-photos").remove([photo.storage_path]);
    await supabase.from("property_photos").delete().eq("id", photo.id);
  };

  // Maintain backwards-compatible API
  const createProperty = async (data: Omit<PropertyInsert, "user_id">) => {
    try {
      return await createMut.mutateAsync(data);
    } catch {
      return null;
    }
  };

  const updateProperty = async (id: string, data: Partial<Property>) => {
    try {
      await updateMut.mutateAsync({ id, data });
    } catch { }
  };

  const deleteProperty = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch { }
  };

  return {
    properties,
    loading,
    createProperty,
    updateProperty,
    deleteProperty,
    uploadPhoto,
    getPhotos,
    deletePhoto,
    refetch: invalidate,
  };
}
