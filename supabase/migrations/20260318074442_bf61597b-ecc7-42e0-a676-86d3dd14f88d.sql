
-- Add tercero fields to properties and all asset tables
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.habitaciones
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.garajes
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.trasteros
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.oficinas
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.locales_naves
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.terrenos
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;

ALTER TABLE public.edificios
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS tercero_dni text,
  ADD COLUMN IF NOT EXISTS tercero_telefono text,
  ADD COLUMN IF NOT EXISTS tercero_email text;
