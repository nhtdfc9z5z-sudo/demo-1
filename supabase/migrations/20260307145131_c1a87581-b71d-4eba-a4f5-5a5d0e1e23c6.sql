
-- Table to track monthly rent payments with tenant notification and owner confirmation
CREATE TABLE public.pagos_renta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  inquilino_id uuid REFERENCES public.inquilinos(id) ON DELETE CASCADE NOT NULL,
  mes integer NOT NULL, -- 1-12
  anio integer NOT NULL,
  -- Tenant marks as paid
  inquilino_notificado boolean NOT NULL DEFAULT false,
  inquilino_notificado_at timestamptz,
  -- Owner confirms
  propietario_confirmado boolean NOT NULL DEFAULT false,
  propietario_confirmado_at timestamptz,
  -- Payment details (filled by owner on confirmation)
  importe_pagado numeric,
  tipo_pago text, -- 'total', 'parcial', 'deuda_antigua', 'adelanto', 'acuerdo'
  notas_acuerdo text,
  -- Ownership
  user_id uuid NOT NULL, -- property owner
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, inquilino_id, mes, anio)
);

ALTER TABLE public.pagos_renta ENABLE ROW LEVEL SECURITY;

-- Owner can do everything on their records
CREATE POLICY "Owners can manage own pagos" ON public.pagos_renta
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tenants can view their own payment records
CREATE POLICY "Tenants can view own pagos" ON public.pagos_renta
  FOR SELECT TO authenticated USING (inquilino_id IN (
    SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
  ));

-- Tenants can update their notification flag
CREATE POLICY "Tenants can notify payment" ON public.pagos_renta
  FOR UPDATE TO authenticated
  USING (inquilino_id IN (SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()))
  WITH CHECK (inquilino_id IN (SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()));

-- Tenants can insert a payment record for their property
CREATE POLICY "Tenants can insert own pagos" ON public.pagos_renta
  FOR INSERT TO authenticated
  WITH CHECK (inquilino_id IN (SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_pagos_renta_updated
  BEFORE UPDATE ON public.pagos_renta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
