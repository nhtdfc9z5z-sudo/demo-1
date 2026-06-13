
-- Add titularidad fields to all remaining asset tables

-- habitaciones
ALTER TABLE public.habitaciones
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- garajes
ALTER TABLE public.garajes
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- trasteros
ALTER TABLE public.trasteros
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- oficinas
ALTER TABLE public.oficinas
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- locales_naves
ALTER TABLE public.locales_naves
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- terrenos
ALTER TABLE public.terrenos
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;

-- edificios
ALTER TABLE public.edificios
  ADD COLUMN IF NOT EXISTS titularidad text NOT NULL DEFAULT 'yo',
  ADD COLUMN IF NOT EXISTS copropietarios jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiene_usufructo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usufructuario_nombre text,
  ADD COLUMN IF NOT EXISTS usufructuario_dni text,
  ADD COLUMN IF NOT EXISTS usufructuario_telefono text,
  ADD COLUMN IF NOT EXISTS usufructuario_email text;
