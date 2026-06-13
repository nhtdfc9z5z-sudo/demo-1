
-- History log for contract events (IPC changes, status changes, notes)
CREATE TABLE public.contrato_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contrato_id uuid NOT NULL REFERENCES public.contratos_arrendamiento(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'cambio',
  titulo text NOT NULL,
  detalle text,
  valor_anterior text,
  valor_nuevo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contrato_historial"
  ON public.contrato_historial FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Soft delete: contracts won't be truly deleted, mark as 'archivado'
ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS archivado boolean NOT NULL DEFAULT false;
