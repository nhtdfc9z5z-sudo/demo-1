ALTER TABLE public.properties
  ADD COLUMN tiene_terraza boolean DEFAULT false,
  ADD COLUMN tiene_patio boolean DEFAULT false,
  ADD COLUMN tiene_balcon boolean DEFAULT false;