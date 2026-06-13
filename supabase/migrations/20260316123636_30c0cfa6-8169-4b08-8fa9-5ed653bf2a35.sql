
CREATE TABLE public.property_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  categoria text NOT NULL DEFAULT 'cee',
  nombre_archivo text NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.property_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own property_documentos"
  ON public.property_documentos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
