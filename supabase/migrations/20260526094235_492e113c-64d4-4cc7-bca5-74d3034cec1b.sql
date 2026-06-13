
CREATE TABLE public.contrato_garantias_adicionales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contrato_id uuid NOT NULL,
  property_id uuid NOT NULL,
  inquilino_id uuid,
  importe numeric NOT NULL DEFAULT 0,
  mensualidades_equivalentes numeric,
  tipo text NOT NULL DEFAULT 'metalico',
  estado text NOT NULL DEFAULT 'vigente',
  fecha_entrega date,
  fecha_devolucion date,
  notas text,
  documento_url text,
  documento_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_garantias_adicionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own garantias adicionales"
ON public.contrato_garantias_adicionales
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_garantias_contrato ON public.contrato_garantias_adicionales(contrato_id);
CREATE INDEX idx_garantias_property ON public.contrato_garantias_adicionales(property_id);

CREATE TRIGGER update_garantias_updated_at
BEFORE UPDATE ON public.contrato_garantias_adicionales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
