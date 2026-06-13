
ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS proveedor_cif text,
  ADD COLUMN IF NOT EXISTS proveedor_direccion text,
  ADD COLUMN IF NOT EXISTS proveedor_telefono text,
  ADD COLUMN IF NOT EXISTS proveedor_email text,
  ADD COLUMN IF NOT EXISTS presupuesto_descripcion text,
  ADD COLUMN IF NOT EXISTS presupuesto_importe numeric,
  ADD COLUMN IF NOT EXISTS presupuesto_iva_porcentaje numeric,
  ADD COLUMN IF NOT EXISTS presupuesto_iva_cuota numeric,
  ADD COLUMN IF NOT EXISTS presupuesto_total numeric,
  ADD COLUMN IF NOT EXISTS presupuesto_fecha text,
  ADD COLUMN IF NOT EXISTS presupuesto_validez text,
  ADD COLUMN IF NOT EXISTS presupuesto_observaciones text,
  ADD COLUMN IF NOT EXISTS presupuesto_archivo_url text,
  ADD COLUMN IF NOT EXISTS presupuesto_archivo_path text;
