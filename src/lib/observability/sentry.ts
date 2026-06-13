/**
 * Sentry lazy init.
 *
 * - Solo se inicializa si existe `import.meta.env.VITE_SENTRY_DSN`.
 * - Si no hay DSN, fallback silencioso: la app sigue funcionando.
 * - Ámbito: observabilidad técnica (errores frontend, crashes, exceptions).
 *   La auditoría fiscal/negocio va por `error_logs` (ver captureAppError).
 */
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // fallback silencioso
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      // No capturar PII por defecto
      sendDefaultPii: false,
    });
    initialized = true;
  } catch {
    // No romper la app si Sentry falla al inicializar
  }
}

export function sentryCapture(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* noop */
  }
}

export function isSentryReady(): boolean {
  return initialized;
}