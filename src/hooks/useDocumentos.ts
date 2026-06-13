import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";

/**
 * Sprint 4.1 — Gestor documental + OCR base.
 * Fuente única para subir, listar, buscar, vincular y reintentar OCR
 * de cualquier documento del usuario. No extrae campos de negocio.
 */

export type DocumentoOcrStatus = "pending" | "processing" | "ok" | "error" | "skipped";
export type DocumentoEstadoRevision = "pendiente" | "revisado" | "caducado";
export type DocumentoEntidad =
  | "activo"
  | "contrato"
  | "incidencia"
  | "inquilino"
  | "factura"
  | "gasto";

export interface Documento {
  id: string;
  user_id: string;
  nombre: string;
  categoria: string;
  mime_type: string | null;
  size_bytes: number | null;
  bucket: string;
  storage_path: string;
  origen_tipo: string | null;
  origen_id: string | null;
  ocr_status: DocumentoOcrStatus;
  ocr_text: string | null;
  ocr_error: string | null;
  ocr_engine: string | null;
  ocr_version: string | null;
  ocr_processed_at: string | null;
  notas: string | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  requiere_revision: boolean;
  recordatorio_dias_antes: number | null;
  estado_revision: DocumentoEstadoRevision;
  created_at: string;
  updated_at: string;
}

export interface DocumentoVinculo {
  id: string;
  documento_id: string;
  entidad_tipo: DocumentoEntidad;
  entidad_id: string;
  created_at: string;
}

export interface DocumentosFilters {
  query?: string;
  ocrStatus?: DocumentoOcrStatus | "all";
  categoria?: string | "all";
  entidadTipo?: DocumentoEntidad | "all";
  entidadId?: string | null;
  limit?: number;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200) || "documento";
}

function triggerOcr(documentoId: string) {
  // Fire-and-forget — la subida nunca espera al OCR.
  supabase.functions
    .invoke("ocr-documento", { body: { documento_id: documentoId } })
    .catch((err) => console.warn("[ocr-documento] invoke failed", err));
}

export function useDocumentos(filters: DocumentosFilters = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["documentos", user?.id, filters] as const;

  const list = useQuery({
    queryKey,
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async (): Promise<Documento[]> => {
      let q = (supabase as any)
        .from("documentos")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 200);

      if (filters.ocrStatus && filters.ocrStatus !== "all") {
        q = q.eq("ocr_status", filters.ocrStatus);
      }
      if (filters.categoria && filters.categoria !== "all") {
        q = q.eq("categoria", filters.categoria);
      }

      // Filtro por entidad vinculada (vía subselect en `documento_vinculos`)
      if (filters.entidadTipo && filters.entidadTipo !== "all" && filters.entidadId) {
        const { data: vins } = await (supabase as any)
          .from("documento_vinculos")
          .select("documento_id")
          .eq("user_id", user!.id)
          .eq("entidad_tipo", filters.entidadTipo)
          .eq("entidad_id", filters.entidadId);
        const ids = (vins || []).map((v: any) => v.documento_id);
        if (ids.length === 0) return [];
        q = q.in("id", ids);
      }

      if (filters.query && filters.query.trim().length >= 2) {
        const term = filters.query.trim();
        // tsvector primero; si falla por sintaxis raras (ej. acentos sueltos),
        // ilike sobre nombre + ocr_text como fallback.
        const safe = term.replace(/[&|!:()*<>'"\\]/g, " ").trim();
        if (safe) {
          q = q.or(
            `nombre.ilike.%${safe}%,ocr_text.ilike.%${safe}%,notas.ilike.%${safe}%`
          );
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Documento[];
    },
  });

  // Vinculos para los documentos visibles (un solo query batched)
  const vinculos = useQuery({
    queryKey: ["documento-vinculos", user?.id, list.data?.map((d) => d.id).join(",")],
    enabled: !!user && !!list.data && list.data.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<DocumentoVinculo[]> => {
      const ids = (list.data || []).map((d) => d.id);
      if (ids.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("documento_vinculos")
        .select("*")
        .eq("user_id", user!.id)
        .in("documento_id", ids);
      if (error) throw error;
      return (data || []) as DocumentoVinculo[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["documentos"] });
    qc.invalidateQueries({ queryKey: ["documento-vinculos"] });
  };

  const upload = useMutation({
    mutationFn: async (vars: {
      file: File;
      categoria?: string;
      notas?: string;
      vincular?: { entidad_tipo: DocumentoEntidad; entidad_id: string }[];
    }): Promise<Documento> => {
      if (!user) throw new Error("Sin sesión");
      const safe = sanitizeFileName(vars.file.name);
      const path = `${user.id}/${Date.now()}-${safe}`;

      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, vars.file, {
          contentType: vars.file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data, error } = await (supabase as any)
        .from("documentos")
        .insert({
          user_id: user.id,
          nombre: vars.file.name,
          categoria: vars.categoria || "general",
          mime_type: vars.file.type || null,
          size_bytes: vars.file.size,
          bucket: "documentos",
          storage_path: path,
          origen_tipo: "upload",
          notas: vars.notas || null,
          ocr_status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;

      const doc = data as Documento;

      if (vars.vincular && vars.vincular.length > 0) {
        await (supabase as any).from("documento_vinculos").insert(
          vars.vincular.map((v) => ({
            documento_id: doc.id,
            user_id: user.id,
            entidad_tipo: v.entidad_tipo,
            entidad_id: v.entidad_id,
          })),
        );
      }

      // OCR en background — no esperamos
      triggerOcr(doc.id);
      return doc;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Documento subido", description: "El OCR se ejecutará en segundo plano." });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo subir", description: e?.message || "Error", variant: "destructive" }),
  });

  const rename = useMutation({
    mutationFn: async (vars: { id: string; nombre: string }) => {
      const { error } = await (supabase as any)
        .from("documentos")
        .update({ nombre: vars.nombre })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const changeCategoria = useMutation({
    mutationFn: async (vars: { id: string; categoria: string }) => {
      const { error } = await (supabase as any)
        .from("documentos")
        .update({ categoria: vars.categoria })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Sprint 4.2 — Actualiza campos de vencimiento/recordatorio sin tocar OCR.
   * Todos los campos son opcionales: pasar `null` los limpia explícitamente.
   */
  const updateMeta = useMutation({
    mutationFn: async (vars: {
      id: string;
      fecha_documento?: string | null;
      fecha_vencimiento?: string | null;
      requiere_revision?: boolean;
      recordatorio_dias_antes?: number | null;
      estado_revision?: DocumentoEstadoRevision;
      notas?: string | null;
    }) => {
      const { id, ...patch } = vars;
      const { error } = await (supabase as any)
        .from("documentos")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Documento actualizado" });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo actualizar", description: e?.message || "Error", variant: "destructive" }),
  });

  const retryOcr = useMutation({
    mutationFn: async (documentoId: string) => {
      await (supabase as any)
        .from("documentos")
        .update({ ocr_status: "pending", ocr_error: null })
        .eq("id", documentoId);
      const { error } = await supabase.functions.invoke("ocr-documento", {
        body: { documento_id: documentoId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "OCR relanzado" });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo relanzar el OCR", description: e?.message || "Error", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (doc: Documento) => {
      // Borrar archivo físico sólo si está en el bucket gestionado por nosotros.
      if (doc.bucket === "documentos") {
        await supabase.storage.from("documentos").remove([doc.storage_path]);
      }
      const { error } = await (supabase as any).from("documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Documento eliminado" });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo eliminar", description: e?.message || "Error", variant: "destructive" }),
  });

  const linkEntidad = useMutation({
    mutationFn: async (vars: { documento_id: string; entidad_tipo: DocumentoEntidad; entidad_id: string }) => {
      if (!user) throw new Error("Sin sesión");
      const { error } = await (supabase as any)
        .from("documento_vinculos")
        .insert({
          documento_id: vars.documento_id,
          user_id: user.id,
          entidad_tipo: vars.entidad_tipo,
          entidad_id: vars.entidad_id,
        });
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    },
    onSuccess: invalidate,
  });

  const unlinkEntidad = useMutation({
    mutationFn: async (vars: { documento_id: string; entidad_tipo: DocumentoEntidad; entidad_id: string }) => {
      const { error } = await (supabase as any)
        .from("documento_vinculos")
        .delete()
        .eq("documento_id", vars.documento_id)
        .eq("entidad_tipo", vars.entidad_tipo)
        .eq("entidad_id", vars.entidad_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    documentos: list.data || [],
    vinculos: vinculos.data || [],
    loading: list.isLoading,
    error: list.error,
    refetch: list.refetch,
    upload,
    rename,
    changeCategoria,
    retryOcr,
    remove,
    linkEntidad,
    unlinkEntidad,
    updateMeta,
  };
}

/** Devuelve una URL firmada (1h) para descargar/visualizar un documento. */
export async function getDocumentoSignedUrl(doc: Pick<Documento, "bucket" | "storage_path">) {
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, 3600);
  if (error) throw error;
  return data.signedUrl;
}