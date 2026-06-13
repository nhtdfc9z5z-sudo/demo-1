
-- Add columns for tenant upload tracking and visibility
ALTER TABLE public.inquilino_documentos 
  ADD COLUMN IF NOT EXISTS visible_para_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subido_por text NOT NULL DEFAULT 'propietario';

-- Tenants can upload documents for their own inquilino record (insert only)
CREATE POLICY "Tenants can insert own docs"
  ON public.inquilino_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    inquilino_id IN (
      SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
    )
  );

-- Tenants can view documents that are visible to them
CREATE POLICY "Tenants can view visible docs"
  ON public.inquilino_documentos
  FOR SELECT
  TO authenticated
  USING (
    visible_para_inquilino = true
    AND inquilino_id IN (
      SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
    )
  );
