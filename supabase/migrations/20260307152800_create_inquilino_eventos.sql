-- Reconstruct the `inquilino_eventos` table, which was created in the Lovable UI
-- without a corresponding migration file (the export only contained the later
-- ALTER TABLE in 20260307152848). Column definitions are derived from the
-- generated Supabase types (src/integrations/supabase/types.ts). The
-- visibility columns (visible_para_inquilino, notificar_inquilino) are added by
-- the subsequent migration, so they are intentionally omitted here.

CREATE TABLE IF NOT EXISTS public.inquilino_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  inquilino_id uuid NOT NULL REFERENCES public.inquilinos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'general',
  titulo text NOT NULL,
  descripcion text,
  fecha date NOT NULL,
  hora time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inquilino_eventos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inquilino_eventos_inquilino_id
  ON public.inquilino_eventos (inquilino_id);
CREATE INDEX IF NOT EXISTS idx_inquilino_eventos_auth_user_id
  ON public.inquilino_eventos (auth_user_id);

-- Owner CRUD policy (the matching tenant-visibility SELECT policy is created in
-- the next migration). Guarded so it is safe if it already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquilino_eventos'
      AND policyname = 'Owners manage own inquilino_eventos'
  ) THEN
    CREATE POLICY "Owners manage own inquilino_eventos"
      ON public.inquilino_eventos
      FOR ALL
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid());
  END IF;
END $$;
