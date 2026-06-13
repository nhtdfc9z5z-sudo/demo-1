import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Property } from "./useProperties";
import type { Contrato } from "./useContratos";
import type { PagoRenta } from "./usePagosRenta";

/**
 * Sprint 4.0 — progreso de onboarding del propietario.
 * Usa exclusivamente datos reales ya disponibles. No persiste nada en backend.
 * Los hitos UI-only (panel fiscal revisado, descartar) van en localStorage.
 */

const FISCAL_KEY = "cr.onboarding.fiscalRevisado";
const DISMISS_KEY = "cr.onboarding.dismissed";
const STORAGE_EVENT = "cr:onboarding:changed";

function safeGet(key: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function safeSet(key: string) {
  try {
    localStorage.setItem(key, "1");
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    /* noop */
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  } catch {
    /* noop */
  }
}

export function markFiscalRevisado() {
  safeSet(FISCAL_KEY);
}

export function dismissOnboarding() {
  safeSet(DISMISS_KEY);
}

export function resetOnboardingDismiss() {
  safeRemove(DISMISS_KEY);
}

/** Suscripción ligera a cambios en los flags locales del onboarding. */
function useOnboardingFlags() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(STORAGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(STORAGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return useMemo(() => ({
    fiscalRevisado: safeGet(FISCAL_KEY),
    dismissed: safeGet(DISMISS_KEY),
    // tick fuerza recomputo
    _tick: tick,
  }), [tick]);
}

function useHasGastos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["onboarding", "hasGastos", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("property_gastos")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", user!.id)
        .limit(1);
      if (error) return false;
      return (count || 0) > 0;
    },
  });
}

export type OnboardingStepId =
  | "activo"
  | "alquiler"
  | "cobro"
  | "gasto"
  | "fiscal";

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  hint: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  allDone: boolean;
  dismissed: boolean;
  loading: boolean;
}

export function useOnboardingProgress(
  properties: Property[],
  contratos: Contrato[],
  pagos: PagoRenta[]
): OnboardingProgress {
  const flags = useOnboardingFlags();
  const { data: hasGastos = false, isLoading } = useHasGastos();

  const hasActivo = properties.length > 0;
  const hasAlquiler = contratos.some((c) => !!c.id);
  const hasCobro = pagos.some((p) => !!p.propietario_confirmado);

  const steps: OnboardingStep[] = [
    {
      id: "activo",
      label: "Añade tu primer activo",
      hint: "Una vivienda, habitación, local o garaje.",
      done: hasActivo,
    },
    {
      id: "alquiler",
      label: "Crea tu primer alquiler",
      hint: "Vincula un inquilino y una renta al activo.",
      done: hasAlquiler,
    },
    {
      id: "cobro",
      label: "Registra tu primer cobro",
      hint: "Marca el primer pago recibido del inquilino.",
      done: hasCobro,
    },
    {
      id: "gasto",
      label: "Registra tu primer gasto",
      hint: "IBI, comunidad, reformas o cualquier factura.",
      done: hasGastos,
    },
    {
      id: "fiscal",
      label: "Revisa tu panel fiscal",
      hint: "Comprueba ingresos, gastos y rendimiento neto.",
      done: flags.fiscalRevisado,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    allDone: completed === steps.length,
    dismissed: flags.dismissed,
    loading: isLoading,
  };
}