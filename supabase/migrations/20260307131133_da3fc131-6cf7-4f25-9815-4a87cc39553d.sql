
CREATE TABLE public.incidencia_citaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id uuid NOT NULL REFERENCES public.incidencias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  visitante_nombre text NOT NULL,
  visitante_telefono text,
  visitante_email text,
  visitante_rol text DEFAULT 'Técnico',
  fecha_hora timestamp with time zone NOT NULL,
  receptor_nombre text NOT NULL,
  receptor_telefono text,
  receptor_email text,
  receptor_rol text DEFAULT 'Inquilino',
  estado text DEFAULT 'Pendiente',
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.incidencia_citaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own citaciones" ON public.incidencia_citaciones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own citaciones" ON public.incidencia_citaciones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own citaciones" ON public.incidencia_citaciones
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own citaciones" ON public.incidencia_citaciones
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_citaciones_updated_at
  BEFORE UPDATE ON public.incidencia_citaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
