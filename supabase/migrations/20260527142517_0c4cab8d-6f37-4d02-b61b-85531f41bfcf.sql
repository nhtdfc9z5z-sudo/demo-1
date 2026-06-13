-- Fase A Sprint 3: Modelo económico estructural por contrato (no destructiva)

-- 1) modalidad_alquiler en contratos
ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS modalidad_alquiler text NOT NULL DEFAULT 'completo';

ALTER TABLE public.contratos_arrendamiento
  DROP CONSTRAINT IF EXISTS contratos_modalidad_alquiler_check;
ALTER TABLE public.contratos_arrendamiento
  ADD CONSTRAINT contratos_modalidad_alquiler_check
  CHECK (modalidad_alquiler IN ('completo', 'habitaciones'));

-- 2) contrato_id en pagos_renta (nullable, no rompe nada)
ALTER TABLE public.pagos_renta
  ADD COLUMN IF NOT EXISTS contrato_id uuid;

CREATE INDEX IF NOT EXISTS idx_pagos_renta_contrato_id
  ON public.pagos_renta(contrato_id);

CREATE INDEX IF NOT EXISTS idx_pagos_renta_contrato_periodo
  ON public.pagos_renta(contrato_id, anio, mes)
  WHERE contrato_id IS NOT NULL;

-- 3) Tabla de reconciliación (audit log de decisiones de saneamiento)
CREATE TABLE IF NOT EXISTS public.pagos_renta_reconciliacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pago_id uuid NOT NULL,
  pago_relacionado_id uuid,
  property_id uuid,
  contrato_id uuid,
  categoria text NOT NULL,
  decision text NOT NULL,
  motivo text,
  payload_original jsonb,
  decidido_por uuid,
  decidido_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_renta_reconciliacion TO authenticated;
GRANT ALL ON public.pagos_renta_reconciliacion TO service_role;

ALTER TABLE public.pagos_renta_reconciliacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reconciliacion"
  ON public.pagos_renta_reconciliacion
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reconciliacion_user
  ON public.pagos_renta_reconciliacion(user_id, decidido_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliacion_pago
  ON public.pagos_renta_reconciliacion(pago_id);