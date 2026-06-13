
-- Table for tenant economic profile (scoring / evaluation)
CREATE TABLE public.inquilino_perfil_economico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id uuid NOT NULL REFERENCES public.inquilinos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ingresos_mensuales numeric NULL,
  ingresos_tipo text NULL DEFAULT 'netos',
  situacion_laboral text NULL,
  empresa_actual text NULL,
  antiguedad_laboral_meses integer NULL,
  renta_maxima_estimada numeric NULL,
  ratio_esfuerzo numeric NULL,
  scoring_estado text NOT NULL DEFAULT 'sin_datos',
  scoring_notas text NULL,
  tiene_aval_bancario boolean NOT NULL DEFAULT false,
  deudas_conocidas boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inquilino_id)
);

-- RLS
ALTER TABLE public.inquilino_perfil_economico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own perfil_economico"
ON public.inquilino_perfil_economico
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_perfil_economico_updated_at
  BEFORE UPDATE ON public.inquilino_perfil_economico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
