ALTER TABLE public.property_gastos
  ADD COLUMN IF NOT EXISTS gasto_compartido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS porcentaje_usuario numeric(5,2);

ALTER TABLE public.property_gastos
  DROP CONSTRAINT IF EXISTS property_gastos_porcentaje_usuario_range;
ALTER TABLE public.property_gastos
  ADD CONSTRAINT property_gastos_porcentaje_usuario_range
  CHECK (porcentaje_usuario IS NULL OR (porcentaje_usuario > 0 AND porcentaje_usuario <= 100));