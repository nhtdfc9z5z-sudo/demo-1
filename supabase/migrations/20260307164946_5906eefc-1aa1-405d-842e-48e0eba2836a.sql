
ALTER TABLE public.properties
  ADD COLUMN ibi_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN basuras_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN suministros_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN seguro_impago_paga_inquilino BOOLEAN NOT NULL DEFAULT false;
