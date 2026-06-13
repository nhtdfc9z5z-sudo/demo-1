
ALTER TABLE public.pagos_renta
  ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'pago_real',
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'registro_manual',
  ADD COLUMN IF NOT EXISTS fecha_devengo date,
  ADD COLUMN IF NOT EXISTS fecha_pago_real date,
  ADD COLUMN IF NOT EXISTS afecta_finanzas_actuales boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS afecta_fiscalidad boolean NOT NULL DEFAULT true;

-- Backfill fecha_devengo from mes/anio for existing rows
UPDATE public.pagos_renta
SET fecha_devengo = make_date(anio, mes, 1)
WHERE fecha_devengo IS NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_renta_tipo_registro
  ON public.pagos_renta (property_id, tipo_registro);

CREATE INDEX IF NOT EXISTS idx_pagos_renta_afecta_finanzas
  ON public.pagos_renta (user_id, afecta_finanzas_actuales);
