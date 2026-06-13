
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS derrama_concepto text,
  ADD COLUMN IF NOT EXISTS derrama_importe_cuota numeric,
  ADD COLUMN IF NOT EXISTS derrama_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS derrama_num_cuotas integer,
  ADD COLUMN IF NOT EXISTS derrama_incluida_comunidad boolean DEFAULT false;
