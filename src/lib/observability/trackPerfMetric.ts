/**
 * trackPerfMetric — métricas de rendimiento del núcleo fiscal y exportaciones.
 *
 * Reglas:
 * - Insert async no bloqueante: nunca esperar el resultado.
 * - Nunca romper la app si falla.
 * - No persistir datos sensibles ni importes detallados.
 * - Solo eventos del núcleo: build_owner_pack, export_fiscal_pdf, export_fiscal_excel.
 */
import { supabase } from "@/integrations/supabase/client";

export type PerfEvent =
  | "build_owner_pack"
  | "build_owner_pack_dashboard"
  | "export_fiscal_pdf"
  | "export_fiscal_excel";

export interface PerfMetricInput {
  event: PerfEvent;
  durationMs: number;
  success: boolean;
  errorType?: string | null;
  context?: Record<string, unknown>;
}

export function trackPerfMetric(input: PerfMetricInput): void {
  // Fire-and-forget; nunca bloquea
  void (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      await supabase.from("perf_metrics").insert([{
        user_id: userId,
        event_name: input.event,
        duration_ms: Math.max(0, Math.round(input.durationMs * 100) / 100),
        success: input.success,
        error_type: input.errorType ?? null,
        context: (input.context ?? null) as never,
      }]);
    } catch {
      /* noop — nunca romper la app */
    }
  })();
}

/** Helper para medir una función async con captura automática de métrica. */
export async function measureAsync<T>(
  event: PerfEvent,
  context: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = performance.now();
  try {
    const out = await fn();
    trackPerfMetric({ event, durationMs: performance.now() - t0, success: true, context });
    return out;
  } catch (err) {
    trackPerfMetric({
      event,
      durationMs: performance.now() - t0,
      success: false,
      errorType: (err as Error)?.name || "Error",
      context,
    });
    throw err;
  }
}

/** Versión sync para medir builders puros como buildOwnerPack. */
export function measureSync<T>(
  event: PerfEvent,
  context: Record<string, unknown> | undefined,
  fn: () => T,
): T {
  const t0 = performance.now();
  try {
    const out = fn();
    trackPerfMetric({ event, durationMs: performance.now() - t0, success: true, context });
    return out;
  } catch (err) {
    trackPerfMetric({
      event,
      durationMs: performance.now() - t0,
      success: false,
      errorType: (err as Error)?.name || "Error",
      context,
    });
    throw err;
  }
}