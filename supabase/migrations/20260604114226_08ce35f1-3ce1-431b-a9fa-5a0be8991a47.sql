
-- Sprint 4.2 — Vencimientos y recordatorios documentales
DO $$ BEGIN
  CREATE TYPE public.documento_estado_revision AS ENUM ('pendiente', 'revisado', 'caducado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS fecha_documento date,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date,
  ADD COLUMN IF NOT EXISTS requiere_revision boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_dias_antes integer,
  ADD COLUMN IF NOT EXISTS estado_revision public.documento_estado_revision NOT NULL DEFAULT 'pendiente';

CREATE INDEX IF NOT EXISTS documentos_vencimiento_idx
  ON public.documentos (user_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;
