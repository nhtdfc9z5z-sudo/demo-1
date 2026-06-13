ALTER TABLE public.contrato_personas
  ADD COLUMN IF NOT EXISTS parte text NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS porcentaje_participacion numeric,
  ADD COLUMN IF NOT EXISTS afecta_fiscalidad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS porcentaje_fiscal numeric,
  ADD COLUMN IF NOT EXISTS es_yo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contrato_personas_contrato_parte
  ON public.contrato_personas (contrato_id, parte);