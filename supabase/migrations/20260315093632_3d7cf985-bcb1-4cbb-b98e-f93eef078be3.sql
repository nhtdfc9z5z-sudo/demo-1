
ALTER TABLE public.incidencias 
ADD COLUMN IF NOT EXISTS origen_tipo text,
ADD COLUMN IF NOT EXISTS responsable_gestion text;
