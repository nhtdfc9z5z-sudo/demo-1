ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_devengo DATE;
ALTER TABLE public.property_gastos ADD COLUMN IF NOT EXISTS fecha_devengo DATE;
COMMENT ON COLUMN public.facturas.fecha_devengo IS 'Fecha de devengo fiscal (opcional). Si está, se usa para imputar al ejercicio en lugar de fecha.';
COMMENT ON COLUMN public.property_gastos.fecha_devengo IS 'Fecha de devengo fiscal (opcional). Si está, se usa para imputar al ejercicio en lugar de fecha.';
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_devengo ON public.facturas(user_id, fecha_devengo);
CREATE INDEX IF NOT EXISTS idx_property_gastos_fecha_devengo ON public.property_gastos(user_id, fecha_devengo);