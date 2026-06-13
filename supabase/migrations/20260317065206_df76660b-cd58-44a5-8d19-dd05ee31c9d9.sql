
-- Table to track rent price changes over time (IPC updates, renegotiations, etc.)
CREATE TABLE public.renta_actualizaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos_arrendamiento(id) ON DELETE SET NULL,
  fecha_efectiva DATE NOT NULL,
  importe_anterior NUMERIC,
  importe_nuevo NUMERIC NOT NULL,
  motivo TEXT DEFAULT 'ipc',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.renta_actualizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own renta_actualizaciones"
  ON public.renta_actualizaciones
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_renta_actualizaciones_property ON public.renta_actualizaciones(property_id, fecha_efectiva);
