ALTER TABLE public.contratos_arrendamiento
ADD COLUMN IF NOT EXISTS fecha_inicio_control date;

COMMENT ON COLUMN public.contratos_arrendamiento.fecha_inicio_control IS
'Fecha desde la que CapitalRent controla los pagos de este contrato. Puede ser posterior a fecha_inicio cuando el contrato es antiguo y se importa ya en marcha. No se genera deuda histórica antes de esta fecha.';