
-- Create enum-like types as check constraints
CREATE TABLE public.contrato_modificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contrato_id uuid NOT NULL REFERENCES public.contratos_arrendamiento(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  
  -- What changed
  naturaleza text NOT NULL DEFAULT 'notificable' CHECK (naturaleza IN ('correccion_interna', 'notificable', 'requiere_acuerdo')),
  tipo_cambio text NOT NULL DEFAULT 'otro' CHECK (tipo_cambio IN ('ipc', 'renta_manual', 'suministro', 'condicion', 'anexo', 'otro')),
  campo_afectado text,
  valor_anterior text,
  valor_nuevo text,
  motivo text,
  
  -- When
  fecha_registro date NOT NULL DEFAULT CURRENT_DATE,
  fecha_efectiva date,
  
  -- Supporting document
  soporte text CHECK (soporte IN ('anexo_firmado', 'email', 'whatsapp', 'verbal', 'portal', 'otro')),
  soporte_archivo_path text,
  soporte_archivo_url text,
  
  -- Communication tracking
  comunicado boolean NOT NULL DEFAULT false,
  fecha_comunicacion timestamptz,
  canal_comunicacion text CHECK (canal_comunicacion IN ('portal', 'email', 'whatsapp', 'presencial', 'burofax', 'otro')),
  
  -- Confirmation (optional, not enforced)
  confirmado_por_inquilino boolean DEFAULT false,
  fecha_confirmacion timestamptz,
  
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contrato_modificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contrato_modificaciones"
  ON public.contrato_modificaciones
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tenants can view modifications on their contracts
CREATE POLICY "Tenants can view contract modifications"
  ON public.contrato_modificaciones
  FOR SELECT
  TO authenticated
  USING (
    contrato_id IN (
      SELECT ca.id FROM contratos_arrendamiento ca
      WHERE ca.inquilino_id IN (
        SELECT i.id FROM inquilinos i WHERE i.auth_user_id = auth.uid()
      )
    )
    AND naturaleza != 'correccion_interna'
  );
