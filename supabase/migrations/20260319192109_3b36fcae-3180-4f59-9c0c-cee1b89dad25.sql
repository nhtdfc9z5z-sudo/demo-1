
-- Create proveedores table
CREATE TABLE public.proveedores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Datos básicos
  nombre          text NOT NULL,
  nombre_comercial text,

  -- Datos fiscales
  cif             text,
  direccion       text,
  codigo_postal   text,
  municipio       text,
  provincia       text,

  -- Contacto
  telefono        text,
  email           text,
  web             text,
  persona_contacto text,

  -- Clasificación
  especialidad    text,
  valoracion      integer,
  es_habitual     boolean NOT NULL DEFAULT false,

  -- Internos
  notas           text,
  activo          boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Add valoracion check via trigger (not CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_proveedor_valoracion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.valoracion IS NOT NULL AND (NEW.valoracion < 1 OR NEW.valoracion > 5) THEN
    RAISE EXCEPTION 'valoracion must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proveedor_valoracion
  BEFORE INSERT OR UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_proveedor_valoracion();

-- updated_at trigger
CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own proveedores"
  ON public.proveedores FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add proveedor_id FK to incidencias
ALTER TABLE public.incidencias ADD COLUMN proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;
