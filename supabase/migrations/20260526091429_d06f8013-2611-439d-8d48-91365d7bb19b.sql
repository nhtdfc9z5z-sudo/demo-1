-- Add structured event fields to contrato_historial (all optional, backward compatible)
ALTER TABLE public.contrato_historial
  ADD COLUMN IF NOT EXISTS fecha_evento date,
  ADD COLUMN IF NOT EXISTS importe_anterior numeric,
  ADD COLUMN IF NOT EXISTS importe_nuevo numeric,
  ADD COLUMN IF NOT EXISTS documento_path text,
  ADD COLUMN IF NOT EXISTS documento_url text,
  ADD COLUMN IF NOT EXISTS notas text;

CREATE INDEX IF NOT EXISTS idx_contrato_historial_contrato ON public.contrato_historial(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_historial_property ON public.contrato_historial(property_id);
