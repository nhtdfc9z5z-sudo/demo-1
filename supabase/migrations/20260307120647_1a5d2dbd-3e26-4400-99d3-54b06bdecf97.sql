
-- Add tipo_inquilino to inquilinos table
ALTER TABLE public.inquilinos
ADD COLUMN tipo_inquilino text DEFAULT 'asalariado';

-- Create inquilino_documentos table
CREATE TABLE public.inquilino_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id uuid NOT NULL REFERENCES public.inquilinos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  categoria text NOT NULL,
  nombre_archivo text NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inquilino_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenant docs"
  ON public.inquilino_documentos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tenant docs"
  ON public.inquilino_documentos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenant docs"
  ON public.inquilino_documentos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket for tenant documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquilino-documentos', 'inquilino-documentos', true);

-- Storage RLS policies
CREATE POLICY "Users can upload tenant docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inquilino-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view tenant docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inquilino-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete tenant docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inquilino-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read access for tenant docs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'inquilino-documentos');
