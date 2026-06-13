import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { captureAppError } from "@/lib/observability";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import {
  buildReconciliacion,
  buildReconciliacionAuditContext,
  type ContratoForReconciliacion,
  type PagoForReconciliacion,
  type PersonasPorContrato,
  type ReconciliacionCategoria,
  type ReconciliacionItem,
  type ReconciliacionSummary,
  type TramosPorContrato,
} from "@/lib/sprint3/reconciliacion";
import type { RentaTramo } from "@/lib/rentaUtils";

export type ReconciliacionPhase = "idle" | "loading" | "ready" | "error";
export type ReconciliacionDecision =
  | "kept"
  | "marked_non_fiscal"
  | "invalidated_duplicate"
  | "pending";

interface State {
  phase: ReconciliacionPhase;
  summary: ReconciliacionSummary | null;
  error?: string;
  applying: Set<string>; // pago_id principal en aplicación
}

/**
 * Hook Sprint 3 · Fase E. Carga el snapshot necesario, clasifica con
 * `buildReconciliacion` y expone acciones SEGURAS (kept / non_fiscal /
 * pending) por fila. Todas las acciones:
 *  - registran un row en `pagos_renta_reconciliacion`
 *  - actualizan flags concretos cuando aplica (sin borrar ni fusionar)
 *  - eliminan el item resuelto del summary en memoria
 */
export function useReconciliacionPagos() {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({
    phase: "idle", summary: null, applying: new Set(),
  });

  const runScan = useCallback(async () => {
    setState((s) => ({ ...s, phase: "loading", error: undefined }));
    try {
      const [pagosRes, contratosRes, tramosRes, personasRes] = await Promise.all([
        supabase.from("pagos_renta").select(
          "id, property_id, inquilino_id, contrato_id, mes, anio, importe_pagado, tipo_registro, afecta_finanzas_actuales, afecta_fiscalidad",
        ),
        supabase.from("contratos_arrendamiento").select(
          "id, property_id, inquilino_id, renta_mensual, fecha_inicio, fecha_fin, modalidad_alquiler",
        ),
        supabase.from("renta_actualizaciones").select(
          "id, contrato_id, fecha_efectiva, importe_anterior, importe_nuevo",
        ),
        supabase.from("contrato_personas").select("contrato_id, inquilino_id"),
      ]);
      if (pagosRes.error) throw pagosRes.error;
      if (contratosRes.error) throw contratosRes.error;
      if (tramosRes.error) throw tramosRes.error;
      if (personasRes.error) throw personasRes.error;

      const pagos = (pagosRes.data || []) as unknown as PagoForReconciliacion[];
      const contratos = (contratosRes.data || []) as unknown as ContratoForReconciliacion[];

      const tramosPorContrato: TramosPorContrato = {};
      for (const t of (tramosRes.data || []) as Array<RentaTramo & { contrato_id: string }>) {
        if (!t.contrato_id) continue;
        (tramosPorContrato[t.contrato_id] = tramosPorContrato[t.contrato_id] || []).push(t);
      }
      const personasPorContrato: PersonasPorContrato = {};
      for (const row of (personasRes.data || []) as { contrato_id: string; inquilino_id: string | null }[]) {
        if (!row.contrato_id || !row.inquilino_id) continue;
        (personasPorContrato[row.contrato_id] = personasPorContrato[row.contrato_id] || [])
          .push(row.inquilino_id);
      }

      const summary = buildReconciliacion(pagos, contratos, tramosPorContrato, personasPorContrato);
      void captureAppError({
        event: "sprint3.reconciliacion.scan",
        message: "Escaneo de reconciliación generado",
        severity: "info", audit: true,
        context: buildReconciliacionAuditContext(summary),
      });
      setState({ phase: "ready", summary, applying: new Set() });
      return summary;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState({ phase: "error", summary: null, applying: new Set(), error: msg });
      void captureAppError({
        event: "sprint3.reconciliacion.scan_error",
        message: "Fallo al escanear reconciliación",
        severity: "error", audit: true, error,
      });
      return null;
    }
  }, []);

  const applyDecision = useCallback(
    async (
      item: ReconciliacionItem,
      decision: ReconciliacionDecision,
      options: { targetPagoId?: string; motivoExtra?: string } = {},
    ) => {
      const principal = options.targetPagoId ?? item.pago_ids[0];
      const relacionado = item.pago_ids.find((id) => id !== principal) ?? null;
      // Validación de aplicabilidad
      if (decision === "marked_non_fiscal" && item.categoria !== "historico_fiscal_coincide") {
        throw new Error("'Marcar no fiscal' sólo aplica a histórico que coincide con pago real.");
      }
      if (decision === "invalidated_duplicate" && item.categoria !== "duplicado_real") {
        throw new Error("'Invalidar duplicado' sólo aplica a pagos reales duplicados.");
      }
      if (decision === "kept" && item.categoria === "duplicado_real") {
        throw new Error(
          "No se permite 'Mantener' silencioso sobre duplicados reales. Invalida uno o márcalo para revisión.",
        );
      }
      if (decision === "invalidated_duplicate" && !item.pago_ids.includes(principal)) {
        throw new Error("El pago a invalidar no pertenece a este caso.");
      }

      setState((s) => {
        const next = new Set(s.applying); next.add(principal);
        return { ...s, applying: next };
      });

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      if (!userId) throw new Error("Sesión no disponible");

      try {
        // Acción real sobre la fila (sólo en el caso seguro non_fiscal)
        if (decision === "marked_non_fiscal") {
          const { error } = await supabase
            .from("pagos_renta")
            .update({ afecta_fiscalidad: false } as any)
            .eq("id", principal)
            .in("tipo_registro", ["historico_reconstruido", "regularizado"]);
          if (error) throw error;
        }

        // Invalidación de duplicado real: marca el pago como no contable
        // (ni finanzas ni fiscalidad) SIN borrarlo. Sólo aplica a pago_real.
        if (decision === "invalidated_duplicate") {
          const { error } = await supabase
            .from("pagos_renta")
            .update({
              afecta_finanzas_actuales: false,
              afecta_fiscalidad: false,
            } as any)
            .eq("id", principal)
            .eq("tipo_registro", "pago_real");
          if (error) throw error;
        }

        // Audit log en tabla de reconciliación
        const auditRow = {
          user_id: userId,
          pago_id: principal,
          pago_relacionado_id: relacionado,
          property_id: item.property_id,
          contrato_id: item.contrato_id,
          categoria: item.categoria as string,
          decision,
          motivo: item.motivo.slice(0, 500),
          payload_original: {
            mes: item.mes,
            anio: item.anio,
            importes: item.detalle.importes,
            tipos: item.detalle.tipos,
            renta_esperada: item.detalle.renta_esperada ?? null,
            suma_real: item.detalle.suma_real ?? null,
            pago_ids: item.pago_ids,
            target_pago_id: principal,
            motivo_extra: options.motivoExtra ?? null,
          },
          decidido_por: userId,
        };
        const { error: auditErr } = await supabase
          .from("pagos_renta_reconciliacion")
          .insert(auditRow as any);
        if (auditErr) throw auditErr;

        void captureAppError({
          event: "sprint3.reconciliacion.decision",
          message: `Decisión aplicada: ${decision}`,
          severity: "info", audit: true,
          context: {
            categoria: item.categoria,
            decision,
            mes: item.mes,
            anio: item.anio,
            property_id: item.property_id,
            contrato_id: item.contrato_id,
            pago_id: principal,
            n_relacionados: item.pago_ids.length - 1,
          },
        });

        // Retirar del summary local (siempre identificamos por categoría +
        // primer pago_id del item original, no por el target invalidado).
        const itemKey = item.pago_ids[0];
        setState((s) => {
          if (!s.summary) return s;
          const remove = (lst: ReconciliacionItem[]) =>
            lst.filter((it) => it.pago_ids[0] !== itemKey || it.categoria !== item.categoria);
          const summary: ReconciliacionSummary = {
            ...s.summary,
            duplicado_real: remove(s.summary.duplicado_real),
            historico_fiscal_coincide: remove(s.summary.historico_fiscal_coincide),
            pago_cero_solidario: remove(s.summary.pago_cero_solidario),
            excede_renta: remove(s.summary.excede_renta),
            sin_contrato_id: remove(s.summary.sin_contrato_id),
          };
          summary.total =
            summary.duplicado_real.length +
            summary.historico_fiscal_coincide.length +
            summary.pago_cero_solidario.length +
            summary.excede_renta.length +
            summary.sin_contrato_id.length;
          const next = new Set(s.applying); next.delete(principal);
          return { ...s, summary, applying: next };
        });

        if (decision === "marked_non_fiscal" || decision === "invalidated_duplicate") {
          qc.invalidateQueries({ queryKey: ["pagos_renta"] });
          invalidateFiscalChain(qc);
        }
      } catch (error) {
        setState((s) => {
          const next = new Set(s.applying); next.delete(principal);
          return { ...s, applying: next };
        });
        void captureAppError({
          event: "sprint3.reconciliacion.decision_error",
          message: "Fallo aplicando decisión de reconciliación",
          severity: "error", audit: true, error,
          context: {
            categoria: item.categoria,
            decision,
            pago_id: principal,
          },
        });
        throw error;
      }
    },
    [qc],
  );

  const reset = useCallback(
    () => setState({ phase: "idle", summary: null, applying: new Set() }),
    [],
  );

  return { ...state, runScan, applyDecision, reset };
}

export type { ReconciliacionItem, ReconciliacionCategoria };
