
CREATE TABLE public.property_gastos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'otro',
  concepto TEXT,
  importe NUMERIC NOT NULL DEFAULT 0,
  fecha DATE NOT NULL,
  recurrente BOOLEAN NOT NULL DEFAULT false,
  recurrencia TEXT, -- mensual, trimestral, semestral, anual
  fecha_fin DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own property_gastos"
  ON public.property_gastos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
