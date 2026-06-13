ALTER TABLE public.fianzas
  ADD COLUMN IF NOT EXISTS importe_inicial numeric NULL,
  ADD COLUMN IF NOT EXISTS fecha_efecto_actual date NULL;

COMMENT ON COLUMN public.fianzas.importe IS 'Fianza actualmente depositada / vigente';
COMMENT ON COLUMN public.fianzas.importe_inicial IS 'Importe de fianza entregada al inicio del contrato (dato histórico)';
COMMENT ON COLUMN public.fianzas.fecha_efecto_actual IS 'Fecha desde la que aplica el importe actual de la fianza, si difiere del inicial';