
-- 1. Add inquilino_id column with FK to incidencias
ALTER TABLE public.incidencias 
  ADD COLUMN IF NOT EXISTS inquilino_id uuid REFERENCES public.inquilinos(id) ON DELETE SET NULL;

-- 2. Migrate existing data: fill inquilino_id from property_id match
UPDATE public.incidencias i
SET inquilino_id = (
  SELECT inq.id 
  FROM public.inquilinos inq 
  WHERE inq.property_id = i.property_id 
    AND inq.user_id = i.user_id
    AND inq.rol_inquilino IS DISTINCT FROM 'avalista'
  ORDER BY inq.created_at DESC
  LIMIT 1
)
WHERE i.inquilino_id IS NULL 
  AND i.property_id IS NOT NULL;

-- 3. Drop the old text-based RLS policy for tenant viewing
DROP POLICY IF EXISTS "Tenants can view their own incidencias" ON public.incidencias;

-- 4. Create new RLS policy based on inquilino_id → auth_user_id
CREATE POLICY "Tenants can view their own incidencias"
  ON public.incidencias
  FOR SELECT
  TO authenticated
  USING (
    inquilino_id IN (
      SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
    )
  );

-- 5. Update the tenant INSERT policy to also set inquilino_id context
DROP POLICY IF EXISTS "Tenants can insert incidencias for their property" ON public.incidencias;

CREATE POLICY "Tenants can insert incidencias for their property"
  ON public.incidencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    property_id IN (
      SELECT property_id FROM public.inquilinos 
      WHERE auth_user_id = auth.uid() AND property_id IS NOT NULL
    )
  );

-- 6. Create index for performance
CREATE INDEX IF NOT EXISTS idx_incidencias_inquilino_id ON public.incidencias(inquilino_id);
