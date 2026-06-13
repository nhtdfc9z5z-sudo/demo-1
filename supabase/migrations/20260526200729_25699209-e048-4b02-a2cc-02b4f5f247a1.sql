-- =====================================================
-- error_logs: auditoría de eventos fiscales/negocio
-- =====================================================
CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event_name text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  context jsonb,
  stack text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_severity_check CHECK (severity IN ('info','warning','error','critical'))
);

CREATE INDEX idx_error_logs_user_created ON public.error_logs (user_id, created_at DESC);
CREATE INDEX idx_error_logs_event ON public.error_logs (event_name);

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own error_logs"
ON public.error_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own error_logs"
ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =====================================================
-- perf_metrics: métricas de rendimiento del núcleo
-- =====================================================
CREATE TABLE public.perf_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event_name text NOT NULL,
  duration_ms numeric NOT NULL,
  context jsonb,
  success boolean NOT NULL DEFAULT true,
  error_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perf_metrics_user_created ON public.perf_metrics (user_id, created_at DESC);
CREATE INDEX idx_perf_metrics_event ON public.perf_metrics (event_name);

GRANT SELECT, INSERT ON public.perf_metrics TO authenticated;
GRANT ALL ON public.perf_metrics TO service_role;

ALTER TABLE public.perf_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own perf_metrics"
ON public.perf_metrics FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own perf_metrics"
ON public.perf_metrics FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);