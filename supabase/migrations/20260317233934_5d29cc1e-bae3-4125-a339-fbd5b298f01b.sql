
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS titularidad text DEFAULT 'yo' NOT NULL,
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

COMMENT ON COLUMN public.properties.titularidad IS 'yo = soy el único dueño, copropietarios = hay otros dueños';
COMMENT ON COLUMN public.properties.copropietarios IS 'Array de {nombre, dni, porcentaje, telefono, email}';
