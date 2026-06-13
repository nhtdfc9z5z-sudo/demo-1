ALTER TABLE public.contrato_historial ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS idx_contrato_historial_tipo ON public.contrato_historial(contrato_id, tipo);