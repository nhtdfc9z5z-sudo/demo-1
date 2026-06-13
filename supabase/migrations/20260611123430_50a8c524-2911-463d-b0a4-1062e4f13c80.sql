
-- ACCIÓN 1: incidencia_evidencias UPDATE
CREATE POLICY "Users can update own evidencias"
  ON public.incidencia_evidencias FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ACCIÓN 2: user_roles SELECT → authenticated
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ACCIÓN 3: property_mensajes 4 policies → authenticated
DROP POLICY IF EXISTS "Users can view own property_mensajes" ON public.property_mensajes;
CREATE POLICY "Users can view own property_mensajes"
  ON public.property_mensajes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own property_mensajes" ON public.property_mensajes;
CREATE POLICY "Users can insert own property_mensajes"
  ON public.property_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own property_mensajes" ON public.property_mensajes;
CREATE POLICY "Users can update own property_mensajes"
  ON public.property_mensajes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own property_mensajes" ON public.property_mensajes;
CREATE POLICY "Users can delete own property_mensajes"
  ON public.property_mensajes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
