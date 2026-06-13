
-- Tanda 1: cerrar políticas públicas redundantes en storage
DROP POLICY IF EXISTS "Public can view facturas" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for tenant docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view incidencia docs" ON storage.objects;

-- Tanda 1: restringir self-insert en user_roles al rol 'propietario'
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

CREATE POLICY "Users can insert their own propietario role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'propietario'::public.app_role
);
