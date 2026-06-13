
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS gestor_nombre text,
  ADD COLUMN IF NOT EXISTS gestor_telefono text,
  ADD COLUMN IF NOT EXISTS gestor_email text,
  ADD COLUMN IF NOT EXISTS gestor_empresa text,
  ADD COLUMN IF NOT EXISTS gestor_nif text,
  ADD COLUMN IF NOT EXISTS gestor_notas text,
  ADD COLUMN IF NOT EXISTS admin_fincas_nombre text,
  ADD COLUMN IF NOT EXISTS admin_fincas_telefono text,
  ADD COLUMN IF NOT EXISTS admin_fincas_email text,
  ADD COLUMN IF NOT EXISTS admin_fincas_empresa text,
  ADD COLUMN IF NOT EXISTS admin_fincas_nif text,
  ADD COLUMN IF NOT EXISTS admin_fincas_notas text;
