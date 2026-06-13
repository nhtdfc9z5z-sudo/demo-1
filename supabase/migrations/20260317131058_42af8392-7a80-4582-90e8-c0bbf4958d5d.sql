
-- Table for rent default insurance, linked to contracts and tenants
CREATE TABLE public.seguros_impago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contrato_id uuid REFERENCES public.contratos_arrendamiento(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  compania text,
  num_poliza text,
  tomador text,
  telefono text,
  email text,
  prima numeric,
  periodicidad text DEFAULT 'anual',
  fecha_inicio date,
  fecha_renovacion text,
  estado text DEFAULT 'activo',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table for linking insurance to one or more tenants
CREATE TABLE public.seguro_impago_inquilinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguro_impago_id uuid NOT NULL REFERENCES public.seguros_impago(id) ON DELETE CASCADE,
  inquilino_id uuid NOT NULL REFERENCES public.inquilinos(id) ON DELETE CASCADE,
  UNIQUE(seguro_impago_id, inquilino_id)
);

-- Enable RLS
ALTER TABLE public.seguros_impago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguro_impago_inquilinos ENABLE ROW LEVEL SECURITY;

-- RLS policies for seguros_impago
CREATE POLICY "Users can manage own seguros_impago"
  ON public.seguros_impago FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for junction table
CREATE POLICY "Users can manage own seguro_impago_inquilinos"
  ON public.seguro_impago_inquilinos FOR ALL
  TO authenticated
  USING (seguro_impago_id IN (SELECT id FROM public.seguros_impago WHERE user_id = auth.uid()))
  WITH CHECK (seguro_impago_id IN (SELECT id FROM public.seguros_impago WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_seguros_impago_updated_at
  BEFORE UPDATE ON public.seguros_impago
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
