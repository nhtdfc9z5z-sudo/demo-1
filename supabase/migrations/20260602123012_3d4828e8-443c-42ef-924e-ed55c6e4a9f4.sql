-- Tabla nueva: compensaciones de pago de renta
-- Un pago puede tener N compensaciones (caldera, suministros, acuerdo...).
-- Las compensaciones cubren renta a efectos de deuda, pero NO entran en tesorería.

CREATE TABLE public.pago_compensaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pago_renta_id uuid NOT NULL,
  contrato_id uuid,
  property_id uuid NOT NULL,
  inquilino_id uuid,
  mes integer NOT NULL,
  anio integer NOT NULL,
  importe numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT 'otro',
  descripcion text,
  documento_url text,
  documento_path text,
  crear_gasto boolean NOT NULL DEFAULT false,
  deducible boolean NOT NULL DEFAULT false,
  factura_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pago_compensaciones TO authenticated;
GRANT ALL ON public.pago_compensaciones TO service_role;

ALTER TABLE public.pago_compensaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pago_compensaciones"
  ON public.pago_compensaciones
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_pago_compensaciones_pago ON public.pago_compensaciones(pago_renta_id);
CREATE INDEX idx_pago_compensaciones_periodo ON public.pago_compensaciones(user_id, property_id, anio, mes);

CREATE TRIGGER trg_pago_compensaciones_updated_at
  BEFORE UPDATE ON public.pago_compensaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();