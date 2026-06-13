import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, X, ExternalLink, AlertTriangle, Clock, FileText,
  ShieldAlert, RefreshCw, Inbox, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useRecordatorios, type Recordatorio,
} from "@/hooks/useRecordatorios";
import { useContratos } from "@/hooks/useContratos";

type Filtro = "vencidos" | "proximos" | "criticos" | "completados";

interface Props {
  onNavigate?: (r: Recordatorio) => void;
  filterPropertyId?: string | null;
}

function iconoTipo(tipo: Recordatorio["tipo"]) {
  switch (tipo) {
    case "documento_vencido": return AlertTriangle;
    case "documento_vence_pronto": return Clock;
    case "contrato_vence": return FileText;
    case "renta_pendiente": return Clock;
    case "ocr_fallido": return RefreshCw;
    case "auditoria_hallazgo": return ShieldAlert;
    case "revision_renta_anualidad": return Clock;
    case "renovacion_sugerida": return FileText;
    default: return AlertTriangle;
  }
}

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "vencidos", label: "Vencidos" },
  { id: "proximos", label: "Próximos" },
  { id: "criticos", label: "Críticos" },
  { id: "completados", label: "Completados" },
];

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date();
  const t0 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const t1 = Date.UTC(y, m - 1, d);
  return Math.floor((t1 - t0) / 86400000);
}

/**
 * Sprint 4.3 — Panel "Tareas pendientes" para el Centro de salud.
 * Lee `useRecordatorios` (generador + persistencia) y permite completar,
 * descartar o navegar al origen. Nunca envía notificaciones externas.
 */
export default function TareasPendientesPanel({ onNavigate, filterPropertyId }: Props) {
  const { recordatorios, loading, completar, descartar, reabrir } = useRecordatorios();
  const { contratos } = useContratos();
  const [filtro, setFiltro] = useState<Filtro>("proximos");

  const recordatoriosFiltrados = useMemo(() => {
    if (!filterPropertyId) return recordatorios;
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    const resolvePropertyId = (r: Recordatorio): string | null => {
      if (r.origen_tipo === "pago_renta") {
        return String(r.origen_id || "").split(":")[0] || null;
      }
      if (r.origen_tipo === "contrato") {
        const cid = String(r.origen_id || "").split(":")[0];
        return contratoById.get(cid)?.property_id || null;
      }
      return null;
    };
    return recordatorios.filter((r) => resolvePropertyId(r) === filterPropertyId);
  }, [recordatorios, filterPropertyId, contratos]);

  const visibles = useMemo(() => {
    const pendientes = recordatoriosFiltrados.filter((r) => r.estado === "pendiente");
    switch (filtro) {
      case "vencidos":
        return pendientes.filter((r) => {
          const d = daysFromToday(r.fecha_objetivo);
          return d !== null && d < 0;
        });
      case "proximos":
        return pendientes.filter((r) => {
          const d = daysFromToday(r.fecha_objetivo);
          return d === null || d >= 0;
        });
      case "criticos":
        return pendientes.filter((r) => r.prioridad <= 2);
      case "completados":
        return recordatoriosFiltrados.filter((r) => r.estado === "completado");
    }
  }, [recordatoriosFiltrados, filtro]);

  const counts = useMemo(() => {
    const pendientes = recordatoriosFiltrados.filter((r) => r.estado === "pendiente");
    return {
      vencidos: pendientes.filter((r) => {
        const d = daysFromToday(r.fecha_objetivo);
        return d !== null && d < 0;
      }).length,
      proximos: pendientes.length,
      criticos: pendientes.filter((r) => r.prioridad <= 2).length,
      completados: recordatoriosFiltrados.filter((r) => r.estado === "completado").length,
    };
  }, [recordatoriosFiltrados]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      aria-label="Tareas pendientes"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ListChecks size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Tareas pendientes</h2>
            <p className="text-xs text-muted-foreground">Acciona desde aquí sin salir del panel.</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTROS.map((f) => {
          const active = filtro === f.id;
          const n = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`text-xs h-8 px-3 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 font-mono ${active ? "opacity-80" : "text-muted-foreground"}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Inbox size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Nada en esta bandeja</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filtro === "completados"
              ? "Aún no has completado ninguna tarea."
              : "Cuando aparezca algo que requiera tu atención lo verás aquí."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {visibles.map((r) => {
              const Icon = iconoTipo(r.tipo);
              const d = daysFromToday(r.fecha_objetivo);
              const tone =
                d !== null && d < 0
                  ? "bg-red-100/70 text-red-700"
                  : r.prioridad <= 2
                  ? "bg-amber-100/70 text-amber-700"
                  : "bg-muted text-muted-foreground";
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background"
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
                      <Badge variant="outline" className="rounded-md text-[10px] font-mono shrink-0">
                        P{r.prioridad}
                      </Badge>
                    </div>
                    {r.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.descripcion}</p>
                    )}
                    <div className="text-[11px] text-muted-foreground font-mono mt-1">
                      <span className="capitalize">{r.origen_tipo.replace("_", " ")}</span>
                      {r.fecha_objetivo && (
                        <>
                          <span> · </span>
                          <span>
                            {d !== null && d < 0
                              ? `Vencido hace ${-d}d`
                              : d !== null
                              ? `En ${d}d`
                              : r.fecha_objetivo}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {onNavigate && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg gap-1"
                          onClick={() => onNavigate(r)}
                        >
                          <ExternalLink size={13} /> Ver
                        </Button>
                      )}
                      {r.estado === "pendiente" ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 rounded-lg gap-1"
                            onClick={() => completar.mutate(r.id)}
                            disabled={completar.isPending}
                          >
                            <CheckCircle2 size={13} /> Completar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-lg gap-1 text-muted-foreground"
                            onClick={() => descartar.mutate(r.id)}
                            disabled={descartar.isPending}
                          >
                            <X size={13} /> Descartar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg"
                          onClick={() => reabrir.mutate(r.id)}
                          disabled={reabrir.isPending}
                        >
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </motion.section>
  );
}