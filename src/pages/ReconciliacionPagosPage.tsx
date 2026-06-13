import { Link } from "react-router-dom";
import { ArrowLeft, Play, Loader2, AlertTriangle, Check, EyeOff, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useReconciliacionPagos, type ReconciliacionItem } from "@/hooks/useReconciliacionPagos";

const CATEGORIAS: Array<{
  key: keyof Pick<NonNullable<ReturnType<typeof useReconciliacionPagos>["summary"]>,
    "duplicado_real" | "historico_fiscal_coincide" | "pago_cero_solidario" | "excede_renta" | "sin_contrato_id">;
  label: string;
  desc: string;
}> = [
  { key: "duplicado_real", label: "Pagos reales duplicados", desc: "Mismo contrato/periodo con >1 cobro real." },
  { key: "historico_fiscal_coincide", label: "Histórico fiscal coincide con pago real", desc: "Caso PV6 — histórico con afecta_fiscalidad=true que solapa con un pago real." },
  { key: "pago_cero_solidario", label: "Pagos 0 € de solidarios", desc: "Otro inquilino del contrato ya cubre el mes." },
  { key: "excede_renta", label: "Excede renta esperada", desc: "Suma de cobros reales > renta del periodo (tolerancia 5%)." },
  { key: "sin_contrato_id", label: "Sin contrato_id", desc: "Pagos sin contrato asignado tras backfill." },
];

const Inner = () => {
  const { phase, summary, error, applying, runScan, applyDecision, reset } = useReconciliacionPagos();
  const { toast } = useToast();

  const handle = async (
    item: ReconciliacionItem,
    decision: "kept" | "marked_non_fiscal" | "pending" | "invalidated_duplicate",
    targetPagoId?: string,
  ) => {
    try {
      await applyDecision(item, decision, targetPagoId ? { targetPagoId } : {});
      toast({ title: "Decisión registrada", description: `${item.categoria} · ${decision}` });
    } catch (e) {
      toast({ title: "No se pudo aplicar", description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-14">
          <Link to="/propietarios">
            <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
          </Link>
          <h1 className="text-base font-semibold">Sprint 3 · Reconciliación de pagos</h1>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="rounded-lg border border-border p-4 bg-card space-y-2">
          <p className="text-sm text-muted-foreground">
            Detecta pagos ambiguos sin tocar nada. Cada decisión se registra en
            el audit log y, salvo “Marcar no fiscal”, no modifica el pago.
          </p>
          <div className="flex gap-2 pt-2">
            <Button onClick={runScan} disabled={phase === "loading"} size="sm" className="gap-1.5">
              {phase === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Escanear
            </Button>
            {phase !== "idle" && <Button variant="outline" size="sm" onClick={reset}>Reiniciar</Button>}
          </div>
          {error && <div className="rounded-md bg-red-50 text-red-800 text-sm px-3 py-2">{error}</div>}
        </section>

        {summary && (
          <section className="space-y-4">
            <div className="text-xs font-mono text-muted-foreground">
              {summary.total} casos ambiguos detectados
            </div>
            {CATEGORIAS.map(({ key, label, desc }) => {
              const items = summary[key];
              return (
                <details key={key} open={items.length > 0} className="rounded-lg border border-border bg-card">
                  <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {key === "historico_fiscal_coincide" && <AlertTriangle size={14} className="text-amber-600" />}
                      <span className="text-sm font-semibold">{label}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">{items.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </summary>
                  {items.length > 0 && (
                    <div className="border-t border-border divide-y divide-border">
                      {items.map((it) => {
                        const principal = it.pago_ids[0];
                        const busy = applying.has(principal);
                        return (
                          <div key={`${it.categoria}-${principal}`} className="px-4 py-3 text-xs font-mono space-y-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="text-muted-foreground">periodo</span> {it.mes}/{it.anio}</span>
                              <span><span className="text-muted-foreground">contrato</span> {it.contrato_id?.slice(0, 8) ?? "—"}</span>
                              <span><span className="text-muted-foreground">property</span> {it.property_id?.slice(0, 8) ?? "—"}</span>
                              <span><span className="text-muted-foreground">importes</span> {it.detalle.importes.map(n => n.toFixed(2)).join(" + ")}</span>
                              {it.detalle.renta_esperada != null && (
                                <span><span className="text-muted-foreground">esperada</span> {Number(it.detalle.renta_esperada).toFixed(2)}</span>
                              )}
                              <span><span className="text-muted-foreground">tipos</span> {it.detalle.tipos.join("/")}</span>
                            </div>
                            <div className="text-muted-foreground">{it.motivo}</div>
                            {it.categoria === "duplicado_real" && (
                              <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-2 space-y-1">
                                <div className="text-[11px] text-amber-900 font-sans">
                                  Duplicado real: invalida el pago incorrecto (no se borra, queda con
                                  <code className="px-1">afecta_finanzas_actuales=false</code> y
                                  <code className="px-1">afecta_fiscalidad=false</code>).
                                </div>
                                <div className="flex flex-col gap-1">
                                  {it.pago_ids.map((pid, idx) => (
                                    <div key={pid} className="flex items-center justify-between gap-2">
                                      <span>
                                        <span className="text-muted-foreground">pago</span> {pid.slice(0, 8)}
                                        {" · "}
                                        <span className="text-muted-foreground">importe</span> {Number(it.detalle.importes[idx] ?? 0).toFixed(2)}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              `Invalidar el pago ${pid.slice(0, 8)} (no se elimina, deja de contar en finanzas y fiscalidad). ¿Continuar?`,
                                            )
                                          ) {
                                            handle(it, "invalidated_duplicate", pid);
                                          }
                                        }}
                                        className="gap-1.5 h-7 text-[11px]"
                                      >
                                        <Ban size={12} /> Invalidar
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              {it.categoria !== "duplicado_real" && (
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handle(it, "kept")} className="gap-1.5">
                                  <Check size={12} /> Mantener
                                </Button>
                              )}
                              {it.categoria === "historico_fiscal_coincide" && (
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handle(it, "marked_non_fiscal")} className="gap-1.5">
                                  <EyeOff size={12} /> Marcar no fiscal
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => handle(it, "pending")} className="gap-1.5">
                                <Clock size={12} /> Revisar luego
                              </Button>
                              {busy && <Loader2 size={14} className="animate-spin self-center" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </details>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
};

const ReconciliacionPagosPage = () => (
  <ProtectedRoute><Inner /></ProtectedRoute>
);

export default ReconciliacionPagosPage;
