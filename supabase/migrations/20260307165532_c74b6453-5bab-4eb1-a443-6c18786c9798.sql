
ALTER TABLE public.properties
  ADD COLUMN agua_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN agua_incluida_comunidad BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN luz_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN gas_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN calefaccion_paga_inquilino BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN calefaccion_incluida_comunidad BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN internet_paga_inquilino BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.properties DROP COLUMN suministros_paga_inquilino;
