
-- Table for property-level calendar events (vencimientos, visitas, reuniones, etc.)
CREATE TABLE public.property_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora TIME,
  tipo TEXT NOT NULL DEFAULT 'otro',
  subtipo TEXT,
  importe NUMERIC,
  recurrente BOOLEAN NOT NULL DEFAULT false,
  recurrencia_meses INTEGER,
  visible_para_inquilino BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_eventos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owners can manage own property_eventos"
  ON public.property_eventos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenants can view visible property_eventos"
  ON public.property_eventos FOR SELECT
  USING (
    visible_para_inquilino = true
    AND property_id IN (
      SELECT inquilinos.property_id FROM inquilinos
      WHERE inquilinos.auth_user_id = auth.uid() AND inquilinos.property_id IS NOT NULL
    )
  );
