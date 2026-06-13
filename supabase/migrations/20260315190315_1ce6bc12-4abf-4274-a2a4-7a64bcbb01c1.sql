ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS tiene_inventario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renovacion_automatica boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agua_paga_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS luz_paga_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gas_paga_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS internet_paga_inquilino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ibi_paga_inquilino boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS basuras_paga_inquilino boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comunidad_paga_inquilino boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuota_comunidad numeric DEFAULT NULL;