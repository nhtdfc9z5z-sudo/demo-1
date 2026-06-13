-- Fix pagos_renta RLS: change restrictive policies to permissive
DROP POLICY IF EXISTS "Owners can manage own pagos" ON public.pagos_renta;
DROP POLICY IF EXISTS "Tenants can insert own pagos" ON public.pagos_renta;
DROP POLICY IF EXISTS "Tenants can notify payment" ON public.pagos_renta;
DROP POLICY IF EXISTS "Tenants can view own pagos" ON public.pagos_renta;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Owners can manage own pagos"
ON public.pagos_renta FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Tenants can view own pagos"
ON public.pagos_renta FOR SELECT
TO authenticated
USING (inquilino_id IN (
  SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Tenants can insert own pagos"
ON public.pagos_renta FOR INSERT
TO authenticated
WITH CHECK (inquilino_id IN (
  SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Tenants can notify payment"
ON public.pagos_renta FOR UPDATE
TO authenticated
USING (inquilino_id IN (
  SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
))
WITH CHECK (inquilino_id IN (
  SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
));