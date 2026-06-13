import { useMemo, useState } from "react";
import { Receipt, FileText, AlertTriangle, CalendarDays, CheckCircle2, Clock, ChevronDown, ArrowUpCircle, Bell, ShieldCheck, History } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import {
  buildPagoAgendaItems,
  formatDevengo,
  formatDevengoRango,
  isRegistradoHoy,
} from "@/lib/agendaRecientes";

interface AgendaItem {
  id: string;
  tipo: "renta" | "contrato" | "incidencia" | "evento" | "confirmado" | "historico";
  fecha: Date;
  titulo: string;
  inmueble: string;
  subtitulo?: string;
  estado: string;
  estadoClass: string;
  icon: typeof Receipt;
  dateOverride?: string;
  payload?: {
    contratoId?: string | null;
    propertyId?: string;
    pagoId?: string;
    pagoIds?: string[];
  };
}

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos: Contrato[];
  incidencias: Incidencia[];
  eventos: PropertyEvento[];
  onShowCalendar?: () => void;
  onItemClick?: (item: AgendaItem) => void;
}

export default function AgendaProxima({ properties, inquilinos, pagos, contratos, incidencias, eventos, onShowCalendar, onItemClick }: Props) {
  const [showMoreProximo, setShowMoreProximo] = useState(false);
  const [showMoreReciente, setShowMoreReciente] = useState(false);
  const now = new Date();
  const propMap = useMemo(() => new Map(properties.map(p => [p.id, p.nombre_interno])), [properties]);

  // ─── PRÓXIMAMENTE ───
  const proximoItems = useMemo(() => {
    const result: AgendaItem[] = [];
    const mesActual = now.getMonth() + 1;
    const anioActual = now.getFullYear();

    // Pending rents
    for (const prop of properties) {
      const tenants = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      if (tenants.length === 0) continue;
      const pagoMes = pagos.find(p => p.property_id === prop.id && p.mes === mesActual && p.anio === anioActual);
      if (pagoMes?.propietario_confirmado) continue;
      const notificado = pagoMes?.inquilino_notificado;
      result.push({
        id: `renta-${prop.id}`,
        tipo: "renta",
        fecha: new Date(anioActual, mesActual - 1, 1),
        titulo: notificado ? "Pago notificado — pendiente de confirmar" : "Renta pendiente de cobro",
        inmueble: prop.nombre_interno,
        estado: notificado ? "Notificado" : "Pendiente",
        estadoClass: notificado ? "bg-amber-100 text-amber-800" : "bg-destructive/10 text-destructive",
        icon: notificado ? Bell : Receipt,
      });
    }

    // Contract expirations (next 90 days)
    const in90 = new Date(now.getTime() + 90 * 86400000);
    for (const c of contratos) {
      if (c.archivado || c.estado === "finalizado" || !c.fecha_fin) continue;
      const fin = new Date(c.fecha_fin);
      if (fin < now || fin > in90) continue;
      const days = Math.ceil((fin.getTime() - now.getTime()) / 86400000);
      result.push({
        id: `contrato-${c.id}`,
        tipo: "contrato",
        fecha: fin,
        titulo: `Contrato vence en ${days} días`,
        inmueble: propMap.get(c.property_id) || "—",
        estado: days <= 30 ? "Urgente" : "Próximo",
        estadoClass: days <= 30 ? "bg-destructive/10 text-destructive" : "bg-violet-100 text-violet-800",
        icon: FileText,
      });
    }

    // Incidencias — only stalled (>7 days open)
    for (const inc of incidencias) {
      if (inc.estado === "Cerrada" || inc.estado === "Resuelta") continue;
      const age = Math.ceil((now.getTime() - new Date(inc.created_at).getTime()) / 86400000);
      if (age < 7) continue;
      result.push({
        id: `inc-${inc.id}`,
        tipo: "incidencia",
        fecha: new Date(inc.created_at),
        titulo: inc.concepto || `Incidencia #${inc.numero_incidencia}`,
        inmueble: propMap.get(inc.property_id || "") || "—",
        estado: age > 14 ? "Requiere atención" : "Pendiente",
        estadoClass: age > 14 ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800",
        icon: AlertTriangle,
      });
    }

    // Upcoming eventos/citas (next 30 days)
    const in30 = new Date(now.getTime() + 30 * 86400000);
    for (const ev of eventos) {
      const d = new Date(ev.fecha);
      if (d < now || d > in30) continue;
      result.push({
        id: `ev-${ev.id}`,
        tipo: "evento",
        fecha: d,
        titulo: ev.titulo,
        inmueble: propMap.get(ev.property_id || "") || "General",
        estado: ev.tipo === "cita" ? "Cita" : "Evento",
        estadoClass: "bg-sky-100 text-sky-800",
        icon: CalendarDays,
      });
    }

    result.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return result;
  }, [properties, inquilinos, pagos, contratos, incidencias, eventos, now, propMap]);

  // ─── RECIENTE (high-value actions only) ───
  const recienteItems = useMemo(() => {
    const result: AgendaItem[] = [];
    const hace30 = new Date(now.getTime() - 30 * 86400000);

    // H2.6 — Pagos: separar pago_real (cobrado) vs histórico reconstruido (agrupado)
    const pagoItems = buildPagoAgendaItems(pagos, { since: hace30 });
    for (const it of pagoItems) {
      if (it.kind === "pago_real") {
        const p = it.pago;
        result.push({
          id: it.id,
          tipo: "confirmado",
          fecha: it.fechaOrden,
          titulo: `Renta cobrada — ${Number(p.importe_pagado || 0).toLocaleString("es-ES")} € · ${formatDevengo(p.mes, p.anio)}`,
          inmueble: propMap.get(p.property_id) || "—",
          estado: "Cobrado",
          estadoClass: "bg-emerald-100 text-emerald-800",
          icon: CheckCircle2,
          payload: { propertyId: p.property_id, contratoId: p.contrato_id ?? null, pagoId: p.id },
        });
      } else if (it.kind === "historico_individual") {
        const p = it.pago;
        const registradoHoy = isRegistradoHoy(it.fechaOrden, now);
        result.push({
          id: it.id,
          tipo: "historico",
          fecha: it.fechaOrden,
          titulo: `Mes regularizado históricamente — ${Number(p.importe_pagado || 0).toLocaleString("es-ES")} €`,
          inmueble: propMap.get(p.property_id) || "—",
          subtitulo: `Devengo ${formatDevengo(p.mes, p.anio)} · registrado ${registradoHoy ? "hoy" : it.fechaOrden.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} en CapitalRent`,
          estado: "Histórico",
          estadoClass: "bg-amber-100 text-amber-800",
          icon: History,
          dateOverride: formatDevengo(p.mes, p.anio),
          payload: { propertyId: p.property_id, contratoId: p.contrato_id ?? null, pagoId: p.id },
        });
      } else {
        // historico_grupo
        const registradoHoy = isRegistradoHoy(it.fechaOrden, now);
        const rango = formatDevengoRango(it.mesMin, it.mesMax);
        result.push({
          id: it.id,
          tipo: "historico",
          fecha: it.fechaOrden,
          titulo: `Histórico reconstruido — ${it.pagos.length} meses · ${it.totalImporte.toLocaleString("es-ES")} €`,
          inmueble: propMap.get(it.propertyId) || "—",
          subtitulo: `${rango} · registrado ${registradoHoy ? "hoy" : it.fechaOrden.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} en CapitalRent`,
          estado: "Histórico",
          estadoClass: "bg-amber-100 text-amber-800",
          icon: History,
          dateOverride: rango,
          payload: {
            propertyId: it.propertyId,
            contratoId: it.contratoId,
            pagoIds: it.pagos.map((p) => p.id),
          },
        });
      }
    }

    // Resolved incidencias
    for (const inc of incidencias) {
      if (inc.estado !== "Cerrada" && inc.estado !== "Resuelta") continue;
      const d = new Date(inc.updated_at);
      if (d < hace30) continue;
      result.push({
        id: `inc-done-${inc.id}`,
        tipo: "incidencia",
        fecha: d,
        titulo: `Resuelta: ${inc.concepto || `Incidencia #${inc.numero_incidencia}`}`,
        inmueble: propMap.get(inc.property_id || "") || "—",
        estado: "Resuelta",
        estadoClass: "bg-emerald-100 text-emerald-800",
        icon: CheckCircle2,
      });
    }

    // Recently updated contracts (meaningful changes only)
    for (const c of contratos) {
      const d = new Date(c.updated_at);
      if (d < hace30) continue;
      const created = new Date(c.created_at);
      if (Math.abs(d.getTime() - created.getTime()) < 60000) continue;
      result.push({
        id: `contrato-upd-${c.id}`,
        tipo: "contrato",
        fecha: d,
        titulo: c.archivado ? "Contrato archivado" : "Contrato actualizado",
        inmueble: propMap.get(c.property_id) || "—",
        estado: "Actualizado",
        estadoClass: "bg-violet-100 text-violet-800",
        icon: ArrowUpCircle,
      });
    }

    result.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return result;
  }, [pagos, incidencias, contratos, now, propMap]);

  if (proximoItems.length === 0 && recienteItems.length === 0) return null;

  const MAX = 3;
  const visProximo = showMoreProximo ? proximoItems.slice(0, 10) : proximoItems.slice(0, MAX);
  const visReciente = showMoreReciente ? recienteItems.slice(0, 10) : recienteItems.slice(0, MAX);
  const allClear = proximoItems.length === 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3.5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Actividad</h3>

      {/* ── Próximamente ── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          Próximamente
        </p>
        {allClear ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Todo en orden. Sin acciones pendientes.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {visProximo.map((item) => <AgendaRow key={item.id} item={item} onItemClick={onItemClick} />)}
            </div>
            {proximoItems.length > MAX && (
              <ExpandButton
                expanded={showMoreProximo}
                remaining={proximoItems.length - MAX}
                onClick={() => setShowMoreProximo(!showMoreProximo)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Reciente ── */}
      {recienteItems.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Reciente
          </p>
          <div className="space-y-0">
            {visReciente.map((item) => <AgendaRow key={item.id} item={item} onItemClick={onItemClick} />)}
          </div>
          {recienteItems.length > MAX && (
            <ExpandButton
              expanded={showMoreReciente}
              remaining={recienteItems.length - MAX}
              onClick={() => setShowMoreReciente(!showMoreReciente)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Row ── */
function AgendaRow({ item, onItemClick }: { item: AgendaItem; onItemClick?: (i: AgendaItem) => void }) {
  const Icon = item.icon;
  const isToday = item.fecha.toDateString() === new Date().toDateString();
  const dateLabel = item.dateOverride
    ?? (isToday
      ? "Hoy"
      : item.fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" }));
  const highlightDate = !item.dateOverride && isToday;

  return (
    <button
      onClick={() => onItemClick?.(item)}
      className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-secondary/50 transition-colors"
    >
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground leading-snug truncate">{item.titulo}</p>
        <p className="text-[11px] text-muted-foreground leading-snug truncate">
          {item.subtitulo ? `${item.inmueble} · ${item.subtitulo}` : item.inmueble}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${item.estadoClass}`}>
          {item.estado}
        </span>
        <span className={`text-[10px] ${highlightDate ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          {dateLabel}
        </span>
      </div>
    </button>
  );
}

/* ── Expand toggle ── */
function ExpandButton({ expanded, remaining, onClick }: { expanded: boolean; remaining: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
    >
      <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      {expanded ? "Mostrar menos" : `${remaining} más`}
    </button>
  );
}
