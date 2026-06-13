
-- Drop the old policy that only matches by nombre
DROP POLICY IF EXISTS "Tenants can view their own incidencias" ON public.incidencias;

-- Create new policy matching by full name (nombre + apellidos)
CREATE POLICY "Tenants can view their own incidencias"
ON public.incidencias FOR SELECT TO authenticated
USING (
  inquilino_nombre IN (
    SELECT 
      CASE 
        WHEN apellidos IS NOT NULL AND apellidos != '' 
        THEN nombre || ' ' || apellidos
        ELSE nombre
      END
    FROM public.inquilinos
    WHERE auth_user_id = auth.uid()
  )
  OR inquilino_nombre IN (
    SELECT nombre FROM public.inquilinos
    WHERE auth_user_id = auth.uid()
  )
);
