
-- Contratos de arrendamiento table
CREATE TABLE public.contratos_arrendamiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  inquilino_id uuid REFERENCES public.inquilinos(id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT 'Contrato de arrendamiento',
  fecha_inicio date,
  fecha_fin date,
  renta_mensual numeric,
  archivo_nombre text,
  storage_path text,
  archivo_url text,
  estado text NOT NULL DEFAULT 'vigente',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_arrendamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contratos"
  ON public.contratos_arrendamiento
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Users can upload contratos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contratos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own contratos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own contratos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = auth.uid()::text);
