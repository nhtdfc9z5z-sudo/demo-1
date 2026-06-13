-- Add OCR/storage columns to property_gastos for the "He comprado" flow
ALTER TABLE public.property_gastos
  ADD COLUMN IF NOT EXISTS nif_proveedor text,
  ADD COLUMN IF NOT EXISTS archivo_url text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS ocr_procesado boolean NOT NULL DEFAULT false;

-- Ensure importe is positive (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_gastos_importe_positive'
  ) THEN
    ALTER TABLE public.property_gastos
      ADD CONSTRAINT property_gastos_importe_positive CHECK (importe > 0) NOT VALID;
  END IF;
END $$;