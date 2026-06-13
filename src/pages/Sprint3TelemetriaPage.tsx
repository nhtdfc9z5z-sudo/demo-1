import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  dedupeTelemetry,
  PAGOS_DEDUPE_FASE4_DEPRECATION,
  type DedupeTelemetrySnapshot,
} from "@/lib/pagosDedupe";
import { captureAppError } from "@/lib/observability";

/**
 * Sprint 3 — Fase F: panel de telemetría del deduper Fase 4.
 *
 * Lee el snapshot in-memory de `dedupeTelemetry` (alimentado por
 * `finanzasEngine` y `fiscalPack` en cada cálculo). Permite:
 *  - Ver cuántos grupos pasan por el bucket legacy_fase4 vs por_contrato.
 *  - Volcar el snapshot a `error_logs` (audit) para análisis longitudinal.
 *  - Reiniciar contadores tras flush.
 *
 * Sin PII. Sólo agregados.
 */
export default function Sprint3TelemetriaPage() {
  const [snap, setSnap] = useState<DedupeTelemetrySnapshot>(dedupeTelemetry.snapshot());
  const [flushing, setFlushing] = useState(false);

  const refresh = () => setSnap(dedupeTelemetry.snapshot());

  useEffect(() => {
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const total = snap.legacy_fase4_groups + snap.por_contrato_groups;
  const pctLegacy = total > 0 ? Math.round((snap.legacy_fase4_groups / total) * 100) : 0;

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await captureAppError({
        event: "sprint3_dedupe_telemetry_flush",
        message: "snapshot manual del deduper Fase 4",
        severity: "info",
        audit: true,
        context: {
          ...snap,
          deprecation_status: PAGOS_DEDUPE_FASE4_DEPRECATION.status,
          deprecation_since: PAGOS_DEDUPE_FASE4_DEPRECATION.since,
          source: "Sprint3TelemetriaPage.flush",
        },
      });
      toast.success("Snapshot enviado a audit log");
    } finally {
      setFlushing(false);
    }
  };

  const handleReset = () => {
    dedupeTelemetry.reset();
    refresh();
    toast.info("Contadores reiniciados");
  };

  const Stat = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/propietarios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Volver
        </Link>
        <Badge variant={PAGOS_DEDUPE_FASE4_DEPRECATION.status === "removable" ? "default" : "secondary"}>
          deduper Fase 4 · {PAGOS_DEDUPE_FASE4_DEPRECATION.status}
        </Badge>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Sprint 3 · Telemetría deduper</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mide cuántas veces se sigue activando el fallback heurístico Fase 4 frente al
          motor canónico por contrato (Fase C). Objetivo: 0 hits sostenidos en legacy_fase4
          ⇒ marcar como <code>removable</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Grupos por contrato" value={snap.por_contrato_groups} />
            <Stat label="Grupos legacy Fase 4" value={snap.legacy_fase4_groups} accent={snap.legacy_fase4_groups > 0} />
            <Stat label="Dedupes activados (por contrato)" value={snap.por_contrato_dedupes} />
            <Stat label="Dedupes activados (legacy)" value={snap.legacy_fase4_dedupes} accent={snap.legacy_fase4_dedupes > 0} />
            <Stat label="Warnings totales" value={snap.warnings_total} />
            <Stat label="% legacy" value={`${pctLegacy}%`} accent={pctLegacy > 5} />
          </div>
          <p className="text-xs text-muted-foreground">
            Snapshot iniciado: {new Date(snap.started_at).toLocaleString("es-ES")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw size={14} /> Refrescar
            </Button>
            <Button size="sm" onClick={handleFlush} disabled={flushing || total === 0}>
              <Send size={14} /> {flushing ? "Enviando..." : "Enviar al audit log"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <Trash2 size={14} /> Reiniciar contadores
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de deprecación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Estado:</span> <strong>{PAGOS_DEDUPE_FASE4_DEPRECATION.status}</strong></p>
          <p><span className="text-muted-foreground">Desde:</span> {PAGOS_DEDUPE_FASE4_DEPRECATION.since}</p>
          <p><span className="text-muted-foreground">Sustituido por:</span> <code>{PAGOS_DEDUPE_FASE4_DEPRECATION.replacedBy}</code></p>
          <p className="text-xs text-muted-foreground pt-2">{PAGOS_DEDUPE_FASE4_DEPRECATION.notes}</p>
        </CardContent>
      </Card>
    </div>
  );
}