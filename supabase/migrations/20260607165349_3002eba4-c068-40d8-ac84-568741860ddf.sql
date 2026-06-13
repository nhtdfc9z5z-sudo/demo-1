ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS tipo_contrato text NOT NULL DEFAULT 'habitual',
  ADD COLUMN IF NOT EXISTS tipo_contrato_detalle jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contratos_arrendamiento
  DROP CONSTRAINT IF EXISTS contratos_tipo_contrato_check;

ALTER TABLE public.contratos_arrendamiento
  ADD CONSTRAINT contratos_tipo_contrato_check
  CHECK (tipo_contrato IN ('habitual','vacacional','habitaciones','rent_to_rent','cesion_empresa'));