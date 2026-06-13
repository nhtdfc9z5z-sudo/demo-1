
-- Create incidencia_documentos table
CREATE TABLE public.incidencia_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidencia_id UUID NOT NULL REFERENCES public.incidencias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nombre_archivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'documento',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incidencia_documentos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own incidencia docs" ON public.incidencia_documentos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incidencia docs" ON public.incidencia_documentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own incidencia docs" ON public.incidencia_documentos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create storage bucket for incidencia documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('incidencia-documentos', 'incidencia-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload incidencia docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incidencia-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view incidencia docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'incidencia-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete incidencia docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'incidencia-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view incidencia docs" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'incidencia-documentos');
