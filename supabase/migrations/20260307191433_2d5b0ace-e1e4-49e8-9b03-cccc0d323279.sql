
-- Table for stored invoices (facturas)
CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  -- OCR extracted data
  emisor_nombre text,
  emisor_nif text,
  receptor_nombre text,
  receptor_nif text,
  numero_factura text,
  fecha date,
  base_imponible numeric,
  iva_porcentaje numeric,
  cuota_iva numeric,
  total numeric,
  -- File reference
  archivo_nombre text NOT NULL,
  archivo_url text NOT NULL,
  storage_path text NOT NULL,
  -- Classification
  categoria text DEFAULT 'otro',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own facturas" ON public.facturas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_facturas_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for factura files
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas', 'facturas', true);

-- Storage RLS
CREATE POLICY "Users can upload facturas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own facturas" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'facturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own facturas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'facturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view facturas" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'facturas');
