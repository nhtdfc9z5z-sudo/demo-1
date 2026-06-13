CREATE TABLE public.property_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  autor text NOT NULL,
  mensaje text NOT NULL,
  incidencia_id uuid REFERENCES public.incidencias(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own property_mensajes" ON public.property_mensajes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own property_mensajes" ON public.property_mensajes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own property_mensajes" ON public.property_mensajes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own property_mensajes" ON public.property_mensajes FOR DELETE USING (auth.uid() = user_id);