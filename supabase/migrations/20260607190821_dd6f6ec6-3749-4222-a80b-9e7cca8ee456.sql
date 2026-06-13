ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS valor_catastral numeric,
  ADD COLUMN IF NOT EXISTS num_finca_registral text,
  ADD COLUMN IF NOT EXISTS cee_fecha_emision date,
  ADD COLUMN IF NOT EXISTS cee_numero_registro text,
  ADD COLUMN IF NOT EXISTS caracteristicas_detalle jsonb NOT NULL DEFAULT '{}'::jsonb;