
ALTER TABLE public.property_seguros
  ADD COLUMN IF NOT EXISTS periodicidad text DEFAULT 'anual',
  ADD COLUMN IF NOT EXISTS fecha_renovacion text,
  ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo';
ALTER TABLE public.property_seguros RENAME COLUMN prima_anual TO prima;
ALTER TABLE public.property_seguros DROP COLUMN IF EXISTS fecha_vencimiento;
