
CREATE TABLE public.property_seguros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'hogar',
  compania text,
  num_poliza text,
  tomador text DEFAULT 'propietario',
  fecha_inicio date,
  fecha_vencimiento date,
  prima_anual numeric,
  telefono text,
  email text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_seguros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own property_seguros"
  ON public.property_seguros FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
