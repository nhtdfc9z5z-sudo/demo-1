-- Tabla para soportar múltiples personas vinculadas a un contrato
-- (titulares, cotitulares, ocupantes, avalistas)
CREATE TABLE public.contrato_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contrato_id UUID NOT NULL,
  property_id UUID NOT NULL,
  inquilino_id UUID NULL,
  rol TEXT NOT NULL DEFAULT 'titular_principal',
  nombre TEXT NOT NULL,
  dni TEXT NULL,
  telefono TEXT NULL,
  email TEXT NULL,
  notas TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contrato_personas"
ON public.contrato_personas
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_contrato_personas_contrato ON public.contrato_personas(contrato_id);
CREATE INDEX idx_contrato_personas_user ON public.contrato_personas(user_id);

CREATE TRIGGER update_contrato_personas_updated_at
BEFORE UPDATE ON public.contrato_personas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();