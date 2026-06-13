-- Remove any existing duplicates first (keep the one with the most data)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY property_id, inquilino_id, mes, anio
           ORDER BY
             (propietario_confirmado)::int DESC,
             (importe_pagado IS NOT NULL)::int DESC,
             updated_at DESC NULLS LAST,
             created_at DESC
         ) AS rn
  FROM public.pagos_renta
)
DELETE FROM public.pagos_renta
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS pagos_renta_unique_period
  ON public.pagos_renta (property_id, inquilino_id, mes, anio);