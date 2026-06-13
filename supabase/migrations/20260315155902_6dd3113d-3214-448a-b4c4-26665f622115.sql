
ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS duracion_anos integer,
  ADD COLUMN IF NOT EXISTS prorroga_anos integer,
  ADD COLUMN IF NOT EXISTS preaviso_meses integer,
  ADD COLUMN IF NOT EXISTS fianza_importe numeric,
  ADD COLUMN IF NOT EXISTS deposito_garantia numeric;
