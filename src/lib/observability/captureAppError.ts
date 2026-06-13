/**
 * captureAppError — helper central de captura de errores.
 *
 * Capas:
 * 1. Sentry → observabilidad técnica (siempre, si está inicializado).
 * 2. Supabase `error_logs` → auditoría fiscal/negocio (solo si `audit: true`).
 *
 * Reglas:
 * - Nunca romper la app si la captura falla.
 * - No persistir datos sensibles (importes detallados, datos personales)
 *   en `context`. Pasar solo claves agregadas (ejercicio, num_inmuebles, etc.).
 * - Si no hay sesión, igualmente registra en Sentry pero salta el insert.
 */
import { supabase } from "@/integrations/supabase/client";
import { sentryCapture } from "./sentry";

export type AppErrorSeverity = "info" | "warning" | "error" | "critical";

export interface CaptureAppErrorOptions {
  /** Nombre de evento (ej: "fiscal_pack.build", "export.pdf"). */
  event: string;
  /** Mensaje legible. */
  message: string;
  /** Severidad lógica (default: "error"). */
  severity?: AppErrorSeverity;
  /** Contexto agregado, sin datos sensibles. */
  context?: Record<string, unknown>;
  /** Si true, además inserta en `error_logs` (auditoría fiscal). */
  audit?: boolean;
  /** Error original (para stack trace). */
  error?: unknown;
}

function extractStack(err: unknown): string | null {
  if (err && typeof err === "object" && "stack" in err) {
    const s = (err as { stack?: unknown }).stack;
    return typeof s === "string" ? s.slice(0, 4000) : null;
  }
  return null;
}

export async function captureAppError(opts: CaptureAppErrorOptions): Promise<void> {
  const { event, message, severity = "error", context, audit = false, error } = opts;

  // 1. Sentry (siempre que esté inicializado)
  try {
    sentryCapture(error ?? new Error(`[${event}] ${message}`), {
      event,
      severity,
      ...(context || {}),
    });
  } catch {
    /* noop */
  }

  // 2. console (para visibilidad en dev)
  if (severity === "error" || severity === "critical") {
    console.error(`[${event}] ${message}`, context || "");
  } else if (severity === "warning") {
    console.warn(`[${event}] ${message}`, context || "");
  }

  // 3. Auditoría fiscal en Supabase (opt-in)
  if (!audit) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return;
    await supabase.from("error_logs").insert([{
      user_id: userId,
      event_name: event,
      severity,
      message: message.slice(0, 1000),
      context: (context ? sanitizeContext(context) : null) as never,
      stack: extractStack(error),
    }]);
  } catch {
    // Nunca romper la app por un fallo de logging
  }
}

/** Filtro defensivo: quita claves obvias con datos personales. */
function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "dni", "nif", "email", "telefono", "phone", "iban", "address", "direccion",
    "nombre_completo", "apellidos", "password", "token", "secret",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (blocked.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}