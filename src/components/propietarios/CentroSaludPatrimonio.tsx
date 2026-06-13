import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarClock, Clock, ShieldAlert, ArrowRight, Euro, RefreshCw } from "lucide-react";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { useAuditoriaHallazgos } from "@/hooks/useAuditoriaHallazgos";
import { useRecordatorios } from "@/hooks/useRecordatorios";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Contrato } from "@/hooks/useContratos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Incidencia } from "@/hooks/useIncidencias";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  contratos: Contrato[];
  pagos: PagoRenta[];
  incidencias: Incidencia[];
  onVerAlertas: () => void;
  onVerVencimientos: () => void;
  onVerPendientes: () => void;
  onVerAuditoria: () => void;
  onAbrirRevision?: (contratoId: string, fechaSugerida?: string) => void;
  onAbrirRenovacion?: (contratoId: string) => void;
}

type Tone = "ok" | "warn" | "danger";

const toneStyles: Record<Tone, { ring: string; bg: string; icon: string; chip: string }> = {
  ok: {
    ring: "border-emerald-200/60",
    bg: "bg-emerald-50/40",
    icon: "text-emerald-600",
    chip: "bg-emerald-100/70 text-emerald-700",
  },
  warn: {
    ring: "border-amber-200/70",
    bg: "bg-amber-50/50",
    icon: "text-amber-600",
    chip: "bg-amber-100/70 text-amber-700",
  },
  danger: {
    ring: "border-red-200/70",
    bg: "bg-red-50/50",
    icon: "text-red-600",
    chip: "bg-red-100/70 text-red-700",
  },
};

function HealthCard({
  icon: Icon,
  label,
  value,
  detail,
  emptyMsg,
  tone,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  detail: string;
  emptyMsg: string;
  tone: Tone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  const isEmpty = value === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isEmpty}
      className={`group text-left rounded-xl border bg-card p-4 transition-all ${
        isEmpty
          ? "border-border/60 opacity-90 cursor-default"
          : `${styles.ring} ${styles.bg} hover:shadow-md`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isEmpty ? "bg-muted text-muted-foreground" : styles.chip}`}>
          <Icon size={18} />
        </div>
        {!isEmpty && (
          <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`mt-1 font-mono text-2xl font-semibold ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>
          {value}
        </p>
        <p className={`mt-1 text-xs ${isEmpty ? "text-muted-foreground" : "text-foreground/80"}`}>
          {isEmpty ? emptyMsg : detail}
        </p>
      </div>
    </button>
  );
}

/**
 * Sprint 4.0 — Centro de salud del patrimonio.
 * Agrega 4 KPIs vivos: alertas críticas, contratos próximos a renovación,
 * rentas pendientes del mes y hallazgos de auditoría (Sprint 3.9).
 * Si no hay datos en una métrica muestra un mensaje útil, nunca un panel vacío.
 */
export default function CentroSaludPatrimonio({
  properties,
  inquilinos,
  contratos,
  pagos,
  incidencias,
  onVerAlertas,
  onVerVencimientos,
  onVerPendientes,
  onVerAuditoria,
  onAbrirRevision,
  onAbrirRenovacion,
}: Props) {
  const { total: hallazgosTotal } = useAuditoriaHallazgos();
  const { recordatorios } = useRecordatorios();

  const { revisionesPendientes, renovacionesPendientes, primeraRevision, primeraRenovacion } = useMemo(() => {
    const pendientes = recordatorios.filter((r) => r.estado === "pendiente");
    const rev = pendientes.filter((r) => r.tipo === "revision_renta_anualidad");
    const ren = pendientes.filter((r) => r.tipo === "renovacion_sugerida");
    return {
      revisionesPendientes: rev.length,
      renovacionesPendientes: ren.length,
      primeraRevision: rev[0],
      primeraRenovacion: ren[0],
    };
  }, [recordatorios]);

  const stats = useMemo(() => {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();

    // 1. Alertas críticas: incidencias prioridad 1 (más urgente) abiertas
    const alertasCriticas = incidencias.filter(
      (i) => i.prioridad === 1 && i.estado !== "Cerrada"
    ).length;

    // 2. Contratos próximos a vencer (≤ 60 días)
    const limite = new Date();
    limite.setDate(limite.getDate() + 60);
    const vencenPronto = contratos.filter((c) => {
      if (!c.fecha_fin) return false;
      const fin = new Date(c.fecha_fin);
      return fin >= now && fin <= limite;
    }).length;

    // 3. Rentas pendientes del mes en curso (por activo, no por inquilino)
    let activosPendientes = 0;
    let totalPendiente = 0;
    for (const prop of properties) {
      const tenants = inquilinos.filter(
        (i) => i.property_id === prop.id && i.rol_inquilino !== "avalista"
      );
      if (tenants.length === 0) continue;
      const esperado = resolveRentaEsperada(prop.id, inquilinos, contratos) || 0;
      if (esperado <= 0) continue;
      const cobrado = pagos
        .filter(
          (p) =>
            p.property_id === prop.id &&
            p.mes === mes &&
            p.anio === anio &&
            p.propietario_confirmado
        )
        .reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
      const falta = esperado - cobrado;
      if (falta > 0) {
        activosPendientes++;
        totalPendiente += falta;
      }
    }

    return { alertasCriticas, vencenPronto, activosPendientes, totalPendiente };
  }, [incidencias, contratos, properties, inquilinos, pagos]);

  // Si no hay nada que mostrar (todo a cero y sin activos), no renderizamos.
  const tieneActivos = properties.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      aria-label="Centro de salud del patrimonio"
    >
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Centro de salud</h2>
          <p className="text-xs text-muted-foreground">Lo que requiere tu atención ahora mismo.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <HealthCard
          icon={AlertTriangle}
          label="Alertas críticas"
          value={stats.alertasCriticas}
          tone={stats.alertasCriticas > 0 ? "danger" : "ok"}
          detail={
            stats.alertasCriticas === 1
              ? "1 incidencia urgente abierta"
              : `${stats.alertasCriticas} incidencias urgentes abiertas`
          }
          emptyMsg={tieneActivos ? "Sin urgencias" : "Aún no hay activos que vigilar"}
          onClick={onVerAlertas}
        />
        <HealthCard
          icon={CalendarClock}
          label="Renovaciones"
          value={stats.vencenPronto}
          tone={stats.vencenPronto > 0 ? "warn" : "ok"}
          detail={
            stats.vencenPronto === 1
              ? "1 contrato vence en 60 días"
              : `${stats.vencenPronto} contratos vencen en 60 días`
          }
          emptyMsg={contratos.length === 0 ? "Aún no hay contratos" : "Ninguno vence pronto"}
          onClick={onVerVencimientos}
        />
        <HealthCard
          icon={Euro}
          label="Revisiones de renta"
          value={revisionesPendientes}
          tone={revisionesPendientes > 0 ? "warn" : "ok"}
          detail={
            revisionesPendientes === 1
              ? "1 anualidad próxima sin revisar"
              : `${revisionesPendientes} anualidades próximas sin revisar`
          }
          emptyMsg={contratos.length === 0 ? "Aún no hay contratos" : "Sin anualidades próximas"}
          onClick={() => {
            if (!primeraRevision || !onAbrirRevision) return;
            const contratoId = String(primeraRevision.origen_id || "").split(":")[0];
            if (contratoId) onAbrirRevision(contratoId, primeraRevision.fecha_objetivo || undefined);
          }}
        />
        <HealthCard
          icon={RefreshCw}
          label="Renovaciones por confirmar"
          value={renovacionesPendientes}
          tone={renovacionesPendientes > 0 ? "warn" : "ok"}
          detail={
            renovacionesPendientes === 1
              ? "1 renovación sugerida sin confirmar"
              : `${renovacionesPendientes} renovaciones sugeridas sin confirmar`
          }
          emptyMsg={contratos.length === 0 ? "Aún no hay contratos" : "Nada por confirmar"}
          onClick={() => {
            if (!primeraRenovacion || !onAbrirRenovacion) return;
            const contratoId = String(primeraRenovacion.origen_id || "").split(":")[0];
            if (contratoId) onAbrirRenovacion(contratoId);
          }}
        />
        <HealthCard
          icon={Clock}
          label="Rentas pendientes"
          value={stats.activosPendientes}
          tone={stats.activosPendientes > 0 ? "warn" : "ok"}
          detail={
            stats.totalPendiente > 0
              ? `${stats.totalPendiente.toLocaleString("es-ES")} € por cobrar este mes`
              : "Todo cobrado este mes"
          }
          emptyMsg={tieneActivos ? "Todo cobrado este mes" : "Aún no hay rentas que cobrar"}
          onClick={onVerPendientes}
        />
        <HealthCard
          icon={ShieldAlert}
          label="Hallazgos auditoría"
          value={hallazgosTotal}
          tone={hallazgosTotal > 0 ? "warn" : "ok"}
          detail={
            hallazgosTotal === 1
              ? "1 dato legacy por revisar"
              : `${hallazgosTotal} datos legacy por revisar`
          }
          emptyMsg="Sin inconsistencias detectadas"
          onClick={onVerAuditoria}
        />
      </div>
    </motion.section>
  );
}