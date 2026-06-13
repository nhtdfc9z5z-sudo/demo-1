
-- Storage bucket for contract templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('contrato-plantillas', 'contrato-plantillas', false)
ON CONFLICT (id) DO NOTHING;

-- Table to track user templates
CREATE TABLE public.contrato_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  archivo_nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo_contrato TEXT DEFAULT 'larga_duracion',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plantillas"
  ON public.contrato_plantillas
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage RLS policies for contrato-plantillas bucket
CREATE POLICY "Users can upload own templates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contrato-plantillas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own templates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'contrato-plantillas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own templates"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'contrato-plantillas' AND (storage.foldername(name))[1] = auth.uid()::text);
