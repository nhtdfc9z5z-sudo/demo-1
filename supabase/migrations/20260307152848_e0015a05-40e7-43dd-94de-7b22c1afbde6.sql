
-- Add visibility columns to inquilino_eventos
ALTER TABLE public.inquilino_eventos 
  ADD COLUMN IF NOT EXISTS visible_para_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_inquilino boolean NOT NULL DEFAULT false;

-- RLS: Tenants can view events created by the owner IF visible_para_inquilino = true
CREATE POLICY "Tenants can view visible owner events"
  ON public.inquilino_eventos
  FOR SELECT
  TO authenticated
  USING (
    visible_para_inquilino = true
    AND inquilino_id IN (
      SELECT id FROM public.inquilinos WHERE auth_user_id = auth.uid()
    )
  );
