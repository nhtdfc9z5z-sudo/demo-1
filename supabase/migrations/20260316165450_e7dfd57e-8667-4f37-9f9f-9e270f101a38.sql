
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS fecha_pago date,
  ADD COLUMN IF NOT EXISTS forma_pago text,
  ADD COLUMN IF NOT EXISTS ano_fiscal integer,
  ADD COLUMN IF NOT EXISTS deducible_irpf boolean DEFAULT true;
