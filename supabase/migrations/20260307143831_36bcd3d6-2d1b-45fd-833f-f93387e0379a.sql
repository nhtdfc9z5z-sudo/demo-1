
-- Allow tenants to insert incidencias for their linked property
CREATE POLICY "Tenants can insert incidencias for their property"
ON public.incidencias FOR INSERT TO authenticated
WITH CHECK (
  property_id IN (
    SELECT property_id FROM public.inquilinos
    WHERE auth_user_id = auth.uid() AND property_id IS NOT NULL
  )
);

-- Function to auto-set user_id (property owner) when tenant creates incidencia
CREATE OR REPLACE FUNCTION public.set_incidencia_owner_from_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the inserting user is NOT the user_id (i.e. a tenant), set user_id to the property owner
  IF NEW.property_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.properties
    WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_incidencia_owner
BEFORE INSERT ON public.incidencias
FOR EACH ROW
EXECUTE FUNCTION public.set_incidencia_owner_from_property();
