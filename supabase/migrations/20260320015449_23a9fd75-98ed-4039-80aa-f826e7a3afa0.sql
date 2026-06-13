-- Add fields to store the original uploaded document separately from the generated contract
ALTER TABLE public.contratos_arrendamiento
  ADD COLUMN IF NOT EXISTS documento_original_nombre text,
  ADD COLUMN IF NOT EXISTS documento_original_path text,
  ADD COLUMN IF NOT EXISTS documento_original_url text;