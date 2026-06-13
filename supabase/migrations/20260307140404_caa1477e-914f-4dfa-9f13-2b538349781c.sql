
-- Add auth_user_id to inquilinos to link tenant auth accounts
ALTER TABLE public.inquilinos ADD COLUMN auth_user_id uuid UNIQUE;

-- Allow tenants to read their own inquilino record
CREATE POLICY "Tenants can view their own record"
ON public.inquilinos FOR SELECT TO authenticated
USING (auth.uid() = auth_user_id);

-- Allow tenants to update their own record (email, phone)
CREATE POLICY "Tenants can update their own record"
ON public.inquilinos FOR UPDATE TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Allow tenants to read their assigned property
CREATE POLICY "Tenants can view their property"
ON public.properties FOR SELECT TO authenticated
USING (
  id IN (SELECT property_id FROM public.inquilinos WHERE auth_user_id = auth.uid() AND property_id IS NOT NULL)
);

-- Allow tenants to read property photos of their property
CREATE POLICY "Tenants can view their property photos"
ON public.property_photos FOR SELECT TO authenticated
USING (
  property_id IN (SELECT property_id FROM public.inquilinos WHERE auth_user_id = auth.uid() AND property_id IS NOT NULL)
);

-- Function to link auth user to inquilino record on first login
CREATE OR REPLACE FUNCTION public.link_tenant_auth(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquilino inquilinos%ROWTYPE;
BEGIN
  -- Find active, non-moroso inquilino by email
  SELECT * INTO v_inquilino
  FROM public.inquilinos
  WHERE email = p_email
    AND estado IN ('activo', 'Activo')
  LIMIT 1;

  IF v_inquilino.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No se encontró un inquilino activo con este email.');
  END IF;

  -- Link auth user
  UPDATE public.inquilinos
  SET auth_user_id = auth.uid()
  WHERE id = v_inquilino.id;

  RETURN json_build_object(
    'success', true,
    'inquilino_id', v_inquilino.id,
    'nombre', v_inquilino.nombre,
    'property_id', v_inquilino.property_id
  );
END;
$$;
