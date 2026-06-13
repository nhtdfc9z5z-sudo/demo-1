-- Allow tenants to view their own contract (linked via inquilino_id)
CREATE POLICY "Tenants can view their own contract"
ON public.contratos_arrendamiento
FOR SELECT
TO authenticated
USING (
  inquilino_id IN (
    SELECT id FROM public.inquilinos
    WHERE auth_user_id = auth.uid()
  )
);