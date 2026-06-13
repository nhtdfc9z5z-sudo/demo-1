ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS orden integer;
ALTER TABLE public.contrato_personas ADD COLUMN IF NOT EXISTS orden integer;
CREATE INDEX IF NOT EXISTS idx_inquilinos_orden ON public.inquilinos(property_id, orden);
CREATE INDEX IF NOT EXISTS idx_contrato_personas_orden ON public.contrato_personas(contrato_id, orden);