ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS renovacion_sugerida_at timestamptz,
  ADD COLUMN IF NOT EXISTS renovacion_sugerida_hasta date,
  ADD COLUMN IF NOT EXISTS renovacion_confirmada_at timestamptz;