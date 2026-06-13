import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useBackfillContratoId } from "@/hooks/useBackfillContratoId";
import type { BackfillRow } from "@/lib/sprint3/backfillContratoId";

function StatusBadge({ status }: { status: BackfillRow["status"] }) {
  const map: Record<BackfillRow["status"], { label: string; cls: string }> = {
    ya_asignado:   { label: "ya asignado",   cls: "bg-muted text-muted-foreground" },
    asignable:     { label: "asignable",     cls: "bg-emerald-100 text-emerald-800" },
    ambiguo:       { label: "ambiguo",       cls: "bg-amber-100 text-amber-800" },
    sin_contrato:  { label: "sin contrato",  cls: "bg-sky-100 text-sky-800" },
    error_input:   { label: "error",         cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[status];
  return <Badge className={cls + " font-mono text-[10px]"}>{label}</Badge>;
}

const BackfillContratoIdInner = () => {
  const { phase, summary, applyResult, error, runPreview, apply, reset } = useBackfillContratoId();

  const grupos = useMemo(() => {
    if (!summary) return null;
    const by = (s: BackfillRow["status"]) => summary.rows.filter((r) => r.status === s);
    return {
      asignables: by("asignable"),
      ambiguos: by("ambiguo"),
      sin_contrato: by("sin_contrato"),
      ya_asignados: by("ya_asignado"),
      errores: by("error_input"),
    };
  }, [summary]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-14">
          <Link to="/propietarios">
            <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
          </Link>
          <h1 className="text-base font-semibold text-foreground">
            Sprint 3 · Backfill <span className="font-mono text-xs text-muted-foreground">contrato_id</span>
          </h1>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="rounded-lg border border-border p-4 bg-card space-y-2">
          <h2 className="text-sm font-semibold">Asignar contrato a pagos existentes</h2>
          <p className="text-sm text-muted-foreground">
            Esta herramienta clasifica tus pagos contra los contratos vigentes y propone
            asignar <span className="font-mono">contrato_id</span> sólo cuando hay un
            match único. Los casos ambiguos quedan intactos. Nunca se borran ni se
            fusionan pagos.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={runPreview}
              disabled={phase === "loading" || phase === "applying"}
              size="sm"
              className="gap-1.5"
            >
              {phase === "loading" ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              Ejecutar dry-run
            </Button>
            {phase !== "idle" && (
              <Button variant="outline" size="sm" onClick={reset}>Reiniciar</Button>
            )}
          </div>
          {error && (
            <div className="rounded-md bg-red-50 text-red-800 text-sm px-3 py-2 mt-2">
              {error}
            </div>
          )}
        </section>

        {summary && grupos && (
          <section className="rounded-lg border border-border p-4 bg-card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold">Resumen dry-run</h2>
              <div className="text-xs text-muted-foreground font-mono">
                {summary.total} pagos analizados
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
              <Stat label="Asignables" value={summary.asignables} tone="emerald" />
              <Stat label="Ambiguos" value={summary.ambiguos} tone="amber" />
              <Stat label="Sin contrato" value={summary.sin_contrato} tone="sky" />
              <Stat label="Ya asignados" value={summary.ya_asignados} tone="muted" />
              <Stat label="Errores" value={summary.errores} tone="red" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={
                      phase === "applying" ||
                      phase === "done" ||
                      summary.asignables === 0
                    }
                  >
                    {phase === "applying"
                      ? <Loader2 className="animate-spin" size={14} />
                      : <CheckCircle2 size={14} />}
                    Aplicar backfill ({summary.asignables})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar backfill</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se asignará <strong>contrato_id</strong> a {summary.asignables} pago(s)
                      con match único. Los {summary.ambiguos} ambiguos y los{" "}
                      {summary.sin_contrato} sin contrato vigente quedarán intactos.
                      No se borra ni se modifica ningún importe.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void apply()}>
                      Aplicar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {applyResult && (
              <div className={`rounded-md text-sm px-3 py-2 ${
                applyResult.fail ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
              }`}>
                Aplicados: <strong>{applyResult.ok}</strong> · Errores:{" "}
                <strong>{applyResult.fail}</strong>
                {applyResult.firstError ? ` — ${applyResult.firstError}` : ""}
              </div>
            )}

            <RowsTable title={`Asignables (${grupos.asignables.length})`} rows={grupos.asignables} />
            <RowsTable
              title={`Ambiguos (${grupos.ambiguos.length})`}
              rows={grupos.ambiguos}
              icon={<AlertTriangle size={12} className="text-amber-600" />}
            />
            <RowsTable title={`Sin contrato (${grupos.sin_contrato.length})`} rows={grupos.sin_contrato} collapsedByDefault />
            <RowsTable title={`Ya asignados (${grupos.ya_asignados.length})`} rows={grupos.ya_asignados} collapsedByDefault />
            <RowsTable title={`Errores (${grupos.errores.length})`} rows={grupos.errores} collapsedByDefault />
          </section>
        )}
      </div>
    </div>
  );
};

function Stat({ label, value, tone }: {
  label: string; value: number;
  tone: "emerald" | "amber" | "sky" | "muted" | "red";
}) {
  const cls: Record<typeof tone, string> = {
    emerald: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-900",
    sky: "bg-sky-50 text-sky-900",
    muted: "bg-muted text-muted-foreground",
    red: "bg-red-50 text-red-900",
  } as const;
  return (
    <div className={`rounded-md ${cls[tone]} py-3`}>
      <div className="text-xl font-bold font-mono">{value}</div>
      <div className="text-[11px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function RowsTable({
  title, rows, collapsedByDefault, icon,
}: { title: string; rows: BackfillRow[]; collapsedByDefault?: boolean; icon?: React.ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <details open={!collapsedByDefault} className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold flex items-center gap-2">
        {icon}{title}
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-2 py-1">pago_id</th>
              <th className="px-2 py-1">property</th>
              <th className="px-2 py-1">inquilino</th>
              <th className="px-2 py-1">mes/año</th>
              <th className="px-2 py-1">status</th>
              <th className="px-2 py-1">contrato propuesto</th>
              <th className="px-2 py-1">candidatos</th>
              <th className="px-2 py-1">motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.pago_id} className="border-t border-border">
                <td className="px-2 py-1">{r.pago_id.slice(0, 8)}</td>
                <td className="px-2 py-1">{r.property_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-2 py-1">{r.inquilino_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-2 py-1">{r.mes}/{r.anio}</td>
                <td className="px-2 py-1"><StatusBadge status={r.status} /></td>
                <td className="px-2 py-1">{r.contrato_id_propuesto?.slice(0, 8) ?? "—"}</td>
                <td className="px-2 py-1">{r.candidatos.length}</td>
                <td className="px-2 py-1 text-muted-foreground">{r.motivo ?? ""}</td>
              </tr>
            ))}
            {rows.length > 200 && (
              <tr><td colSpan={8} className="px-2 py-1 text-muted-foreground">
                … {rows.length - 200} filas más
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const BackfillContratoIdPage = () => (
  <ProtectedRoute>
    <BackfillContratoIdInner />
  </ProtectedRoute>
);

export default BackfillContratoIdPage;
