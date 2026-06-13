
CREATE TABLE public.property_impuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'ibi',
  importe_anual numeric,
  forma_pago text DEFAULT 'anual',
  responsable text DEFAULT 'propietario',
  periodo_pago text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_impuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own property_impuestos"
  ON public.property_impuestos FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
