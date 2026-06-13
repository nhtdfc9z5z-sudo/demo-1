
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS gastos_compra numeric,
  ADD COLUMN IF NOT EXISTS fuente_estimacion text DEFAULT 'automatica',
  ADD COLUMN IF NOT EXISTS valor_mercado_manual numeric;
