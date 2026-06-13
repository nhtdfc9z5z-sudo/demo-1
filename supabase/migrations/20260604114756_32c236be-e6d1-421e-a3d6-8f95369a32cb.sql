
-- Sprint 4.3 — Recordatorios internos
DO $$ BEGIN
  CREATE TYPE public.recordatorio_estado AS ENUM ('pendiente', 'completado', 'descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.recordatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  origen_tipo text NOT NULL,
  origen_id text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  fecha_objetivo date,
  prioridad smallint NOT NULL DEFAULT 3,
  estado public.recordatorio_estado NOT NULL DEFAULT 'pendiente',
  completado_at timestamptz,
  descartado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recordatorios TO authenticated;
GRANT ALL ON public.recordatorios TO service_role;

ALTER TABLE public.recordatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recordatorios_owner_all" ON public.recordatorios;
CREATE POLICY "recordatorios_owner_all" ON public.recordatorios
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dedupe: solo un pendiente por (user, tipo, origen).
CREATE UNIQUE INDEX IF NOT EXISTS recordatorios_unique_pendiente
  ON public.recordatorios (user_id, tipo, origen_tipo, origen_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS recordatorios_user_estado_idx
  ON public.recordatorios (user_id, estado, fecha_objetivo);

DROP TRIGGER IF EXISTS recordatorios_set_updated_at ON public.recordatorios;
CREATE TRIGGER recordatorios_set_updated_at
  BEFORE UPDATE ON public.recordatorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
