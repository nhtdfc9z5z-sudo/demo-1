
ALTER TABLE public.properties
  ALTER COLUMN agua_paga_inquilino SET DEFAULT true,
  ALTER COLUMN luz_paga_inquilino SET DEFAULT true,
  ALTER COLUMN gas_paga_inquilino SET DEFAULT true,
  ALTER COLUMN calefaccion_paga_inquilino SET DEFAULT true,
  ALTER COLUMN internet_paga_inquilino SET DEFAULT true;

UPDATE public.properties SET
  agua_paga_inquilino = true,
  luz_paga_inquilino = true,
  gas_paga_inquilino = true,
  calefaccion_paga_inquilino = true,
  internet_paga_inquilino = true;
