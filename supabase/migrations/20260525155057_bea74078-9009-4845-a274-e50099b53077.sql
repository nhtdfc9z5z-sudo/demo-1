ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.inquilinos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.incidencias ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_deleted_at ON public.properties(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_inquilinos_deleted_at ON public.inquilinos(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_facturas_deleted_at ON public.facturas(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_incidencias_deleted_at ON public.incidencias(user_id, deleted_at);