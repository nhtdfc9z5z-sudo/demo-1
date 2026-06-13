
-- Allow tenants to view incidencias where their name matches inquilino_nombre
CREATE POLICY "Tenants can view their own incidencias"
ON public.incidencias FOR SELECT TO authenticated
USING (
  inquilino_nombre IN (
    SELECT nombre FROM public.inquilinos
    WHERE auth_user_id = auth.uid()
  )
);
