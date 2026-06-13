-- Sprint 4.1 — Gestor documental + OCR base

-- Enums
DO $$ BEGIN
  CREATE TYPE public.documento_ocr_status AS ENUM ('pending','processing','ok','error','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.documento_entidad AS ENUM ('activo','contrato','incidencia','inquilino','factura','gasto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- documentos: índice central
CREATE TABLE public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'general',
  mime_type text,
  size_bytes bigint,
  bucket text NOT NULL DEFAULT 'documentos',
  storage_path text NOT NULL,
  origen_tipo text,
  origen_id uuid,
  ocr_status public.documento_ocr_status NOT NULL DEFAULT 'pending',
  ocr_text text,
  ocr_error text,
  ocr_engine text,
  ocr_version text,
  ocr_processed_at timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'spanish',
      coalesce(nombre,'') || ' ' || coalesce(ocr_text,'') || ' ' || coalesce(notas,'')
    )
  ) STORED
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_owner_select" ON public.documentos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "documentos_owner_insert" ON public.documentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documentos_owner_update" ON public.documentos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documentos_owner_delete" ON public.documentos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX documentos_user_created_idx ON public.documentos (user_id, created_at DESC);
CREATE INDEX documentos_origen_idx ON public.documentos (origen_tipo, origen_id);
CREATE INDEX documentos_ocr_status_idx ON public.documentos (user_id, ocr_status);
CREATE INDEX documentos_search_idx ON public.documentos USING GIN (search_tsv);

CREATE TRIGGER documentos_set_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- documento_vinculos: N:M con entidades del dominio
CREATE TABLE public.documento_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entidad_tipo public.documento_entidad NOT NULL,
  entidad_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, entidad_tipo, entidad_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_vinculos TO authenticated;
GRANT ALL ON public.documento_vinculos TO service_role;

ALTER TABLE public.documento_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_vinculos_owner_select" ON public.documento_vinculos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "doc_vinculos_owner_insert" ON public.documento_vinculos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "doc_vinculos_owner_delete" ON public.documento_vinculos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX doc_vinculos_documento_idx ON public.documento_vinculos (documento_id);
CREATE INDEX doc_vinculos_entidad_idx ON public.documento_vinculos (user_id, entidad_tipo, entidad_id);