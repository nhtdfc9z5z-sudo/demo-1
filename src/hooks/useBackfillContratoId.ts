import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { captureAppError } from "@/lib/observability";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import {
  buildAuditContext,
  buildBackfillSummary,
  classifyPagoForBackfill,
  type BackfillRow,
  type BackfillSummary,
  type ContratoForBackfill,
  type PagoForBackfill,
  type PersonasPorContrato,
} from "@/lib/sprint3/backfillContratoId";

export type BackfillPhase = "idle" | "loading" | "preview_ready" | "applying" | "done" | "error";

interface UseBackfillState {
  phase: BackfillPhase;
  summary: BackfillSummary | null;
  applyResult: { ok: number; fail: number; firstError?: string } | null;
  error?: string;
}

/**
 * Hook administrativo (Sprint 3, Fase B). Carga pagos + contratos +
 * personas del usuario actual (RLS), lanza un dry-run con
 * `classifyPagoForBackfill` y deja preparado el plan de aplicación.
 * Sólo modifica filas tras llamada explícita a `apply()`.
 */
export function useBackfillContratoId() {
  const qc = useQueryClient();
  const [state, setState] = useState<UseBackfillState>({
    phase: "idle", summary: null, applyResult: null,
  });

  const runPreview = useCallback(async () => {
    setState({ phase: "loading", summary: null, applyResult: null });
    try {
      const [pagosRes, contratosRes, personasRes] = await Promise.all([
        supabase.from("pagos_renta")
          .select("id, property_id, inquilino_id, mes, anio, contrato_id"),
        supabase.from("contratos_arrendamiento")
          .select("id, property_id, inquilino_id, fecha_inicio, fecha_fin, archivado"),
        supabase.from("contrato_personas")
          .select("contrato_id, inquilino_id"),
      ]);
      if (pagosRes.error) throw pagosRes.error;
      if (contratosRes.error) throw contratosRes.error;
      if (personasRes.error) throw personasRes.error;

      const pagos = (pagosRes.data || []) as PagoForBackfill[];
      const contratos = (contratosRes.data || []) as ContratoForBackfill[];
      const personasPorContrato: PersonasPorContrato = {};
      for (const row of (personasRes.data || []) as { contrato_id: string; inquilino_id: string | null }[]) {
        if (!row.contrato_id || !row.inquilino_id) continue;
        (personasPorContrato[row.contrato_id] = personasPorContrato[row.contrato_id] || [])
          .push(row.inquilino_id);
      }

      const rows: BackfillRow[] = pagos.map((p) =>
        classifyPagoForBackfill(p, contratos, personasPorContrato),
      );
      const summary = buildBackfillSummary(rows);

      void captureAppError({
        event: "sprint3.backfill_contrato_id.preview",
        message: "Dry-run de backfill de contrato_id",
        severity: "info",
        audit: true,
        context: buildAuditContext(summary, "preview"),
      });

      setState({ phase: "preview_ready", summary, applyResult: null });
      return summary;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState({ phase: "error", summary: null, applyResult: null, error: msg });
      void captureAppError({
        event: "sprint3.backfill_contrato_id.preview_error",
        message: "Fallo al ejecutar dry-run",
        severity: "error", audit: true, error,
      });
      return null;
    }
  }, []);

  const apply = useCallback(async () => {
    if (state.phase !== "preview_ready" || !state.summary) return;
    const asignables = state.summary.rows.filter((r) => r.status === "asignable");
    if (asignables.length === 0) {
      setState((s) => ({ ...s, phase: "done", applyResult: { ok: 0, fail: 0 } }));
      return;
    }
    setState((s) => ({ ...s, phase: "applying", applyResult: null }));
    let ok = 0;
    let fail = 0;
    let firstError: string | undefined;
    for (const row of asignables) {
      const { error } = await supabase
        .from("pagos_renta")
        .update({ contrato_id: row.contrato_id_propuesto } as any)
        .eq("id", row.pago_id)
        .is("contrato_id", null); // doble seguro: nunca pisar uno ya asignado
      if (error) {
        fail++;
        firstError = firstError || error.message;
        void captureAppError({
          event: "sprint3.backfill_contrato_id.row_error",
          message: "Fallo aplicando fila de backfill",
          severity: "error", audit: true, error,
          context: {
            pago_id: row.pago_id,
            property_id: row.property_id,
            contrato_id: row.contrato_id_propuesto,
            mes: row.mes,
            anio: row.anio,
          },
        });
      } else {
        ok++;
      }
    }
    void captureAppError({
      event: "sprint3.backfill_contrato_id.apply",
      message: "Backfill aplicado",
      severity: ok && !fail ? "info" : "warning",
      audit: true,
      context: { ...buildAuditContext(state.summary, "apply"), ok, fail },
    });
    qc.invalidateQueries({ queryKey: ["pagos_renta"] });
    invalidateFiscalChain(qc);
    setState((s) => ({ ...s, phase: "done", applyResult: { ok, fail, firstError } }));
  }, [state, qc]);

  const reset = useCallback(() => {
    setState({ phase: "idle", summary: null, applyResult: null });
  }, []);

  return { ...state, runPreview, apply, reset };
}
