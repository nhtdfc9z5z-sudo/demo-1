
CREATE TABLE public.fianzas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  inquilino_id uuid REFERENCES public.inquilinos(id) ON DELETE SET NULL,
  comunidad_autonoma text NOT NULL,
  organismo text NOT NULL,
  importe numeric NOT NULL DEFAULT 0,
  fecha_deposito date,
  fecha_devolucion date,
  numero_expediente text,
  estado text NOT NULL DEFAULT 'pendiente',
  tipo_fianza text DEFAULT 'legal',
  meses_fianza integer DEFAULT 1,
  medio_pago text,
  justificante_url text,
  justificante_path text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fianzas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fianzas" ON public.fianzas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_fianzas_updated_at
  BEFORE UPDATE ON public.fianzas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
