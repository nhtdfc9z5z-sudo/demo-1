
-- Direcciones estructuradas en properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tipo_via text,
  ADD COLUMN IF NOT EXISTS nombre_via text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS portal text,
  ADD COLUMN IF NOT EXISTS escalera text,
  ADD COLUMN IF NOT EXISTS bloque text,
  ADD COLUMN IF NOT EXISTS urbanizacion text,
  ADD COLUMN IF NOT EXISTS parcela text,
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'España',
  ADD COLUMN IF NOT EXISTS latitud numeric,
  ADD COLUMN IF NOT EXISTS longitud numeric,
  ADD COLUMN IF NOT EXISTS direccion_completa text;

COMMENT ON COLUMN public.properties.direccion_completa IS 'Dirección legible generada automáticamente desde los campos estructurados. No editable manualmente.';
COMMENT ON COLUMN public.properties.tipo_via IS 'Calle, Avenida, Plaza, Paseo, Carretera, Camino, Travesía, Urbanización, Polígono, etc.';
COMMENT ON COLUMN public.properties.urbanizacion IS 'Nombre de la urbanización (chalets, viviendas unifamiliares).';
COMMENT ON COLUMN public.properties.parcela IS 'Identificador de parcela (chalets, terrenos, fincas rústicas).';
