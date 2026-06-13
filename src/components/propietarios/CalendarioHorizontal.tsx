import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveRentaEsperada, type RentaTramo, isPagoRealEffective, isPagoHistorico, calcularEstadoMesCalendario } from "@/lib/rentaUtils";
import { getEstadoMesContrato, isContratoActivoEnMes } from "@/lib/estadoMesContrato";
import { usePagoCompensaciones } from "@/hooks/usePagoCompensaciones";
import { useAuth } from "@/hooks/useAuth";
import { parseMonthFromFechaPago } from "@/lib/finanzasEngine";
import { useAllRentaActualizaciones } from "@/hooks/useAllRentaActualizaciones";
import { Plus, Eye, EyeOff, Euro, FileText, Calendar as CalendarIcon, Home, Users, Wrench, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, Clock, Check, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Property, InsuranceEntry } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { Incidencia } from "@/hooks/useIncidencias";
import HeCobradoSheet from "./HeCobradoSheet";
import RentaDetailDialog from "./RentaDetailDialog";
import DeudaDetalleDialog from "./DeudaDetalleDialog";
import MesCompletoView from "./MesCompletoView";

type EventFilter = "todos" | "cobros" | "gastos" | "contratos" | "incidencias" | "citas";
type GastoSubFilter = "todos" | "comunidad" | "impuestos" | "seguro" | "suministros" | "reparaciones" | "otros";
type CitaSubFilter = "todos" | "visitas" | "tecnicos" | "mantenimiento";

const GASTO_SUB_FILTERS: { value: GastoSubFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "comunidad", label: "Comunidad" },
  { value: "impuestos", label: "Impuestos" },
  { value: "seguro", label: "Seguro" },
  { value: "suministros", label: "Suministros" },
  { value: "reparaciones", label: "Reparaciones" },
  { value: "otros", label: "Otros" },
];

const CITA_SUB_FILTERS: { value: CitaSubFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "visitas", label: "Visitas" },
  { value: "tecnicos", label: "Técnicos" },
  { value: "mantenimiento", label: "Mantenimiento" },
];

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  type: "renta" | "impuesto" | "seguro" | "contrato" | "comunidad" | "derrama" | "evento" | "suministro" | "vencimiento" | "cita" | "incidencia" | "revision_renta_anualidad" | "renovacion_sugerida";
  status?: "pagado" | "parcial" | "pendiente" | "impago" | "notificado" | "historico";
  importe?: number | null;
  rentaEsperada?: number | null;
  deuda?: number;
  /** true cuando el mes tiene simultáneamente cobro real e histórico (warning). */
  inconsistente?: boolean;
  /** Cobertura histórica (informativa). No se suma al "cobrado" real. */
  cobertoHistorico?: number;
  flow?: "income" | "expense";
  propertyName?: string;
  propertyId?: string;
  visible_para_inquilino?: boolean;
  eventoId?: string;
  contratoId?: string;
  incidenciaId?: string;
  fueraDeControl?: boolean;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  renta: { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", icon: <Euro size={12} /> },
  impuesto: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: <FileText size={12} /> },
  seguro: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", icon: <AlertTriangle size={12} /> },
  contrato: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: <Users size={12} /> },
  comunidad: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", icon: <Home size={12} /> },
  derrama: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", icon: <Euro size={12} /> },
  evento: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", icon: <CalendarIcon size={12} /> },
  suministro: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", icon: <Wrench size={12} /> },
  vencimiento: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: <Clock size={12} /> },
  cita: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", icon: <Wrench size={12} /> },
  incidencia: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", icon: <AlertTriangle size={12} /> },
  revision_renta_anualidad: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-200", icon: <Euro size={12} /> },
  renovacion_sugerida: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-200", icon: <Clock size={12} /> },
};

const STATUS_COLORS: Record<string, string> = {
  pagado: "bg-emerald-500",
  parcial: "bg-yellow-500",
  pendiente: "bg-amber-500",
  impago: "bg-red-500",
  notificado: "bg-orange-500",
  historico: "bg-amber-400",
};

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const TIPO_OPTIONS = [
  { value: "impuesto", label: "Impuesto" },
  { value: "seguro", label: "Seguro / Vencimiento" },
  { value: "suministro", label: "Suministro (luz, agua, gas...)" },
  { value: "comunidad", label: "Comunidad" },
  { value: "evento", label: "Evento (otro)" },
  { value: "cita_visita", label: "Visita" },
  { value: "cita_tecnico", label: "Técnico (caldera, electricista...)" },
  { value: "cita_mantenimiento", label: "Mantenimiento" },
];

const TYPE_FILTERS: { value: EventFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "cobros", label: "Renta" },
  { value: "gastos", label: "Gastos" },
  { value: "contratos", label: "Renovaciones" },
  { value: "citas", label: "Citas" },
  { value: "incidencias", label: "Incidencias" },
];

interface CalendarioHorizontalProps {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  eventos: PropertyEvento[];
  incidencias?: Incidencia[];
  filterPropertyId?: string | null;
  onCreateEvento: (data: any) => Promise<any>;
  onUpdateEvento: (id: string, data: any) => Promise<void>;
  onDeleteEvento: (id: string) => Promise<void>;
  onConfirmarPago?: (propertyId: string, inquilinoId: string, datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }, mes: number, anio: number) => Promise<void>;
  contratos?: any[];
  onContratoVencimientoClick?: (contratoId: string) => void;
  onIncidenciaClick?: (incidenciaId: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onPropertyClick?: (propertyId: string) => void;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// parseMonthFromFechaPago imported from finanzasEngine

/**
 * Contracts auto-renew annually per Spanish LAU unless either party gives notice.
 * This calculates the next future renewal date by rolling forward from the reference end date.
 */
function getNextRenewalDate(referenceEnd: Date): Date {
  const now = new Date();
  const result = new Date(referenceEnd);
  while (result <= now) {
    result.setFullYear(result.getFullYear() + 1);
  }
  return result;
}

/**
 * Gets the contract end date used as base for renewals.
 * Priority: explicit fecha_fin -> computed from fecha_inicio + duración/prórroga -> LAU fallback (5 años).
 */
function getContractReferenceEndDate(contrato: any): Date | null {
  if (contrato.fecha_fin) {
    const explicitEnd = new Date(contrato.fecha_fin);
    if (!Number.isNaN(explicitEnd.getTime())) return explicitEnd;
  }

  if (!contrato.fecha_inicio) return null;
  const startDate = new Date(contrato.fecha_inicio);
  if (Number.isNaN(startDate.getTime())) return null;

  const duracionAnos = Number(contrato.duracion_anos ?? 0);
  const prorrogaAnos = Number(contrato.prorroga_anos ?? 0);
  const totalAnos = duracionAnos + prorrogaAnos;
  const anosAplicados = totalAnos > 0 ? totalAnos : 5;

  const computedEnd = new Date(startDate);
  computedEnd.setFullYear(computedEnd.getFullYear() + anosAplicados);
  return computedEnd;
}

export function generateCalendarEvents(
  properties: Property[],
  inquilinos: Inquilino[],
  pagos: PagoRenta[],
  eventos: PropertyEvento[],
  year: number,
  month: number,
  filterPropertyIds: string[],
  contratos?: any[],
  incidencias?: Incidencia[],
  tramosByProperty?: Map<string, RentaTramo[]>,
  /**
   * Función opcional para resolver compensaciones no monetarias por
   * (property, mes, año). Cubre renta (reduce deuda) pero NO suma a caja.
   */
  compensadoEnMes?: (propertyId: string, mes: number, anio: number) => number,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const filteredProps = filterPropertyIds.length > 0
    ? properties.filter(p => filterPropertyIds.includes(p.id))
    : properties;

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const thisMonth = year * 12 + month;

  // Aggregate rent status across all properties
  // A property counts as "rented" if it has estado=alquilada OR has active inquilinos
  let totalActiveProperties = 0;
  let paidProperties = 0;
  let globalWorstStatus: CalendarEvent["status"] = thisMonth > currentMonth ? undefined : "pagado";
  let totalRentImporte = 0;
  let totalRentaEsperada = 0;
  let totalDeudaParcial = 0;
  let totalHistoricoCobertura = 0;
  let anyInconsistente = false;

  for (const prop of filteredProps) {
    const propInquilinos = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");

    const activeInquilinos = propInquilinos.filter(inq => {
      const entrada = inq.fecha_entrada ? new Date(inq.fecha_entrada) : null;
      if (entrada) {
        const entradaMonth = entrada.getFullYear() * 12 + entrada.getMonth();
        if (year * 12 + month < entradaMonth) return false;
      }
      const salida = inq.fecha_salida ? new Date(inq.fecha_salida) : null;
      if (salida) {
        const salidaMonth = salida.getFullYear() * 12 + salida.getMonth();
        if (year * 12 + month > salidaMonth) return false;
      }
      return true;
    });

    // Sprint 3.8 — contratos vigentes en (mes, año) para este activo.
    // La unidad económica es el CONTRATO; el inmueble sólo agrupa visualmente.
    const activeContratosProp = (contratos || []).filter(
      c => c.property_id === prop.id && isContratoActivoEnMes(c, month + 1, year),
    );

    // Property is rented if it has active contracts, active tenants, or estado=alquilada.
    const isRented =
      activeContratosProp.length > 0 ||
      activeInquilinos.length > 0 ||
      prop.estado === "alquilada";
    if (!isRented) continue;

    totalActiveProperties++;

    // ── Sprint 3.8 — Estado económico POR CONTRATO ──────────────────
    // Iteramos contratos vigentes y delegamos en `getEstadoMesContrato`.
    // Properties sin contrato caen al cálculo legacy por activo.
    let propertyWorstStatus: CalendarEvent["status"] = "pagado";
    let propertyDeudaParcial = 0;
    let propertyInconsistente = false;
    const priority: Record<string, number> = {
      impago: 5, pendiente: 4, parcial: 3, notificado: 2, historico: 1, pagado: 0,
    };

    if (activeContratosProp.length > 0) {
      let allFueraControl = true;
      const tramosProp = tramosByProperty?.get(prop.id);
      for (const c of activeContratosProp) {
        // Reasignar pagos legacy sin contrato_id sólo si no es ambiguo.
        const pagosVirtuales = pagos
          .filter(p => {
            if (p.mes !== month + 1 || p.anio !== year) return false;
            if (p.contrato_id === c.id) return true;
            return (
              p.contrato_id == null &&
              p.property_id === prop.id &&
              activeContratosProp.length === 1
            );
          })
          .map(p => (p.contrato_id ? p : { ...p, contrato_id: c.id }));
        const est = getEstadoMesContrato({
          contrato: c,
          mes: month + 1,
          anio: year,
          pagos: pagosVirtuales,
          actualizaciones: tramosProp ?? null,
          compensado: compensadoEnMes
            ? compensadoEnMes(prop.id, month + 1, year)
            : 0,
          today: now,
        });
        if (!est.fueraDeControl) allFueraControl = false;
        totalRentImporte += est.cobradoReal;
        totalHistoricoCobertura += est.cobradoHistorico;
        totalRentaEsperada += est.rentaEsperada;
        if (est.inconsistente) propertyInconsistente = true;
        if (est.status === "parcial") propertyDeudaParcial += est.deuda;
        if (est.status && est.status !== "no_gestionado") {
          const s = est.status as CalendarEvent["status"];
          if (s && (priority[s] ?? -1) > (priority[propertyWorstStatus || "pagado"] ?? 0)) {
            propertyWorstStatus = s;
          }
        }
      }
      if (allFueraControl) {
        totalActiveProperties--;
        continue;
      }
    } else {
      // Legacy fallback: activo sin contrato registrado pero con inquilinos.
      const propertyPagos = pagos.filter(
        p => p.property_id === prop.id && p.mes === month + 1 && p.anio === year,
      );
      const confirmedReales = propertyPagos.filter(
        p => p.propietario_confirmado && isPagoRealEffective(p),
      );
      const confirmedHistoricos = propertyPagos.filter(
        p => p.propietario_confirmado && isPagoHistorico(p),
      );
      const hasNotified = propertyPagos.some(p => p.inquilino_notificado);
      const cobradoReal = confirmedReales.reduce(
        (s, p) => s + Number(p.importe_pagado || 0), 0,
      );
      const cobradoHistorico = confirmedHistoricos.reduce(
        (s, p) => s + Number(p.importe_pagado || 0), 0,
      );
      totalRentImporte += cobradoReal;
      totalHistoricoCobertura += cobradoHistorico;
      const tramosProp = tramosByProperty?.get(prop.id);
      const rentaEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || [], {
        actualizaciones: tramosProp,
        mes: month + 1,
        anio: year,
      });
      if (rentaEsperada) totalRentaEsperada += rentaEsperada;
      const hasUnconfirmedNotified = propertyPagos.some(
        p => p.inquilino_notificado && !p.propietario_confirmado,
      );
      const estadoCalendario = calcularEstadoMesCalendario({
        contrato: null,
        mes: month + 1,
        anio: year,
        rentaEsperada: rentaEsperada ?? null,
        cobradoReal,
        cobradoHistorico,
        hasReal: confirmedReales.length > 0,
        hasHistorico: confirmedHistoricos.length > 0,
        hasNotificado: hasUnconfirmedNotified || hasNotified,
        compensado: compensadoEnMes
          ? compensadoEnMes(prop.id, month + 1, year)
          : 0,
        today: now,
      });
      if (estadoCalendario.fueraDeControl || estadoCalendario.status === "no_gestionado") {
        totalActiveProperties--;
        continue;
      }
      propertyWorstStatus = estadoCalendario.status;
      if (estadoCalendario.inconsistente) propertyInconsistente = true;
      if (estadoCalendario.status === "parcial") propertyDeudaParcial += estadoCalendario.deuda;
    }

    if (propertyInconsistente) anyInconsistente = true;
    if (propertyWorstStatus === "pagado") {
      paidProperties++;
    } else if (propertyWorstStatus === "parcial") {
      totalDeudaParcial += propertyDeudaParcial;
    }

    // Prioridad: impago > pendiente > parcial > notificado > historico > pagado
    if ((priority[propertyWorstStatus] || 0) > (priority[globalWorstStatus || "pagado"] || 0)) globalWorstStatus = propertyWorstStatus;

    // IBI
    if (prop.ibi_importe && prop.ibi_fecha_pago) {
      const ibiMonth = parseMonthFromFechaPago(prop.ibi_fecha_pago);
      if (ibiMonth === month) {
        result.push({
          id: `ibi-${prop.id}`,
          date: new Date(year, month, 15),
          title: `IBI`,
          type: "impuesto",
          importe: prop.ibi_importe,
          flow: "expense" as const,
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
        });
      }
    }

    // Basuras
    if (prop.basuras_importe && prop.basuras_fecha_pago) {
      const basMonth = parseMonthFromFechaPago(prop.basuras_fecha_pago);
      if (basMonth === month) {
        result.push({
          id: `basuras-${prop.id}`,
          date: new Date(year, month, 15),
          title: `Basuras`,
          type: "impuesto",
          importe: prop.basuras_importe,
          flow: "expense" as const,
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
        });
      }
    }

    // Comunidad — hidden by default, only shown when "gastos" filter active
    // Will be filtered later based on typeFilter

    if (prop.cuota_comunidad) {
      result.push({
        id: `comunidad-${prop.id}-${month}`,
        date: new Date(year, month, 1),
        title: `Comunidad`,
        type: "comunidad",
        importe: prop.cuota_comunidad,
        flow: "expense" as const,
        propertyName: prop.nombre_interno,
        propertyId: prop.id,
      });
    }

    // Derrama
    if (prop.tiene_derrama && prop.importe_derrama) {
      const fechaFin = prop.fecha_fin_derrama ? new Date(prop.fecha_fin_derrama) : null;
      if (!fechaFin || new Date(year, month, 28) <= fechaFin) {
        result.push({
          id: `derrama-${prop.id}-${month}`,
          date: new Date(year, month, 5),
          title: `Derrama`,
          type: "derrama",
          importe: prop.importe_derrama,
          flow: "expense" as const,
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
        });
      }
    }

    // Insurance vencimientos
    const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
    for (const seg of seguros) {
      if (seg.vencimiento) {
        const vDate = new Date(seg.vencimiento);
        if (vDate.getMonth() === month && vDate.getFullYear() === year) {
          result.push({
            id: `seguro-${prop.id}-${seg.tipo}-${seg.num_poliza}`,
            date: vDate,
            title: `Vto. ${seg.tipo}${seg.compania ? ` (${seg.compania})` : ""}`,
            type: "seguro",
            importe: seg.importe,
            flow: "expense" as const,
            propertyName: prop.nombre_interno,
            propertyId: prop.id,
          });
        }
      }
    }

    // Contract vencimientos (from inquilinos)
    for (const inq of propInquilinos) {
      if (inq.fecha_salida) {
        const sDate = new Date(inq.fecha_salida);
        if (sDate.getMonth() === month && sDate.getFullYear() === year) {
          result.push({
            id: `contrato-${inq.id}`,
            date: sDate,
            title: `Fin periodo ${inq.nombre}`,
            type: "contrato",
            propertyName: prop.nombre_interno,
            propertyId: prop.id,
          });
        }
      }
    }

  }

  // Contract expiry events — generated for ALL properties regardless of rental status
  // Contracts auto-renew annually per LAU — roll forward fecha_fin to next future renewal
  if (contratos) {
    for (const contrato of contratos.filter(c => c.estado === "vigente" && !c.archivado)) {
      const prop = filteredProps.find(p => p.id === contrato.property_id);
      if (!prop) continue;

      const referenceEnd = getContractReferenceEndDate(contrato);
      if (!referenceEnd) continue;

      const effectiveEnd = getNextRenewalDate(referenceEnd);

      // Show the effective renewal/end date
      if (effectiveEnd.getMonth() === month && effectiveEnd.getFullYear() === year) {
        result.push({
          id: `contrato-end-${contrato.id}`,
          date: effectiveEnd,
          title: `📋 Renovación contrato — ${prop.nombre_interno}`,
          type: "renovacion_sugerida",
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
          contratoId: contrato.id,
        });
      }

      // 5-month informational warning
      const infoDate = new Date(effectiveEnd);
      infoDate.setMonth(infoDate.getMonth() - 5);
      if (infoDate.getMonth() === month && infoDate.getFullYear() === year) {
        result.push({
          id: `vencimiento-info-${contrato.id}`,
          date: infoDate,
          title: `📢 Contrato se renueva en 5 meses — ${prop.nombre_interno}`,
          type: "vencimiento",
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
          contratoId: contrato.id,
        });
      }

      // Urgent warning: preaviso + 1 month before effective end
      const preavisoMeses = contrato.preaviso_meses || 2;
      const urgentDate = new Date(effectiveEnd);
      urgentDate.setMonth(urgentDate.getMonth() - (preavisoMeses + 1));
      if (urgentDate.getMonth() === month && urgentDate.getFullYear() === year) {
        result.push({
          id: `vencimiento-urgent-${contrato.id}`,
          date: urgentDate,
          title: `⚠️ URGENTE: Gestionar renovación — ${prop.nombre_interno}`,
          type: "vencimiento",
          propertyName: prop.nombre_interno,
          propertyId: prop.id,
          contratoId: contrato.id,
        });
      }
    }
  }

  // Custom eventos
  const filteredEventos = filterPropertyIds.length > 0
    ? eventos.filter(e => (e.property_id && filterPropertyIds.includes(e.property_id)) || !e.property_id)
    : eventos;

  for (const ev of filteredEventos) {
    const evDate = new Date(ev.fecha);
    if (evDate.getMonth() === month && evDate.getFullYear() === year) {
      const propName = ev.property_id ? properties.find(p => p.id === ev.property_id)?.nombre_interno : undefined;
      // Map cita subtypes to "cita" type
      const isCita = ev.tipo?.startsWith("cita_") || ev.subtipo?.startsWith("cita_");
      const eventType: CalendarEvent["type"] = isCita ? "cita" : (ev.tipo as CalendarEvent["type"] || "evento");
      result.push({
        id: `evento-${ev.id}`,
        date: evDate,
        title: ev.titulo,
        type: eventType,
        importe: ev.importe,
        flow: ev.importe && !isCita ? "expense" as const : undefined,
        propertyName: propName,
        propertyId: ev.property_id || undefined,
        visible_para_inquilino: ev.visible_para_inquilino,
        eventoId: ev.id,
      });
    }
  }

  // Incidencias abiertas
  if (incidencias) {
    const filteredIncs = filterPropertyIds.length > 0
      ? incidencias.filter(inc => inc.property_id && filterPropertyIds.includes(inc.property_id))
      : incidencias;

    for (const inc of filteredIncs) {
      // Only show open/active incidencias
      const estado = (inc.estado || "").toLowerCase();
      if (estado === "cerrada" || estado === "resuelta") continue;

      const incDate = inc.fecha_hora_incidencia
        ? new Date(inc.fecha_hora_incidencia)
        : new Date(inc.created_at);
      if (incDate.getMonth() === month && incDate.getFullYear() === year) {
        const propName = inc.property_id ? properties.find(p => p.id === inc.property_id)?.nombre_interno : undefined;
        result.push({
          id: `incidencia-${inc.id}`,
          date: incDate,
          title: `#${inc.numero_incidencia} ${inc.concepto || inc.tipo_incidencia || "Incidencia"}`,
          type: "incidencia",
          propertyName: propName,
          propertyId: inc.property_id || undefined,
          incidenciaId: inc.id,
        });
      }
    }
  }

  if (totalActiveProperties > 0) {
    const allPaid = paidProperties >= totalActiveProperties && totalDeudaParcial === 0;
    const summaryStatus: CalendarEvent["status"] = allPaid ? "pagado" : globalWorstStatus;
    
    let title = "";
    if (totalRentImporte > 0) {
      title = `${paidProperties}/${totalActiveProperties} rentas · cobrado ${formatImporte(totalRentImporte)}€`;
      if (totalDeudaParcial > 0) {
        title += ` · deuda ${formatImporte(totalDeudaParcial)}€`;
      }
    } else if (totalHistoricoCobertura > 0 && summaryStatus === "historico") {
      title = `${totalActiveProperties} rentas · histórico ${formatImporte(totalHistoricoCobertura)}€`;
    } else {
      title = `${paidProperties}/${totalActiveProperties} rentas pagadas`;
    }
    
    result.push({
      id: `renta-grouped-${month}`,
      date: new Date(year, month, 1),
      title,
      type: "renta",
      status: summaryStatus,
      importe: null,
      rentaEsperada: totalRentaEsperada || null,
      deuda: totalDeudaParcial > 0 ? totalDeudaParcial : undefined,
      cobertoHistorico: totalHistoricoCobertura > 0 ? totalHistoricoCobertura : undefined,
      inconsistente: anyInconsistente || undefined,
      flow: "income" as const,
      propertyName: totalActiveProperties === 1 ? filteredProps.find(p => inquilinos.some(i => i.property_id === p.id && i.rol_inquilino !== "avalista"))?.nombre_interno : undefined,
      propertyId: totalActiveProperties === 1 ? filteredProps.find(p => inquilinos.some(i => i.property_id === p.id && i.rol_inquilino !== "avalista"))?.id : undefined,
    });
  }

  return result;
}

function filterEventsByType(events: CalendarEvent[], typeFilter: EventFilter, gastoSubFilter: GastoSubFilter = "todos", citaSubFilter: CitaSubFilter = "todos"): CalendarEvent[] {
  if (typeFilter === "todos") {
    return events.filter(e => e.type !== "comunidad");
  }
  if (typeFilter === "cobros") return events.filter(e => e.flow === "income");
  if (typeFilter === "gastos") {
    const gastoEvents = events.filter(e => e.flow === "expense" || e.type === "comunidad");
    if (gastoSubFilter === "todos") return gastoEvents;
    if (gastoSubFilter === "comunidad") return gastoEvents.filter(e => e.type === "comunidad" || e.type === "derrama");
    if (gastoSubFilter === "impuestos") return gastoEvents.filter(e => e.type === "impuesto");
    if (gastoSubFilter === "seguro") return gastoEvents.filter(e => e.type === "seguro");
    if (gastoSubFilter === "suministros") return gastoEvents.filter(e => e.type === "suministro");
    if (gastoSubFilter === "reparaciones") return gastoEvents.filter(e => {
      const t = e.title.toLowerCase();
      return e.type === "evento" && (t.includes("reparaci") || t.includes("reforma") || t.includes("arreglo") || t.includes("mantenimiento"));
    });
    if (gastoSubFilter === "otros") return gastoEvents.filter(e =>
      e.type !== "comunidad" && e.type !== "derrama" && e.type !== "impuesto" && e.type !== "seguro" && e.type !== "suministro" &&
      !(e.type === "evento" && /reparaci|reforma|arreglo|mantenimiento/i.test(e.title))
    );
    return gastoEvents;
  }
  if (typeFilter === "contratos") return events.filter(e => e.type === "contrato" || e.type === "vencimiento" || e.type === "renovacion_sugerida" || e.type === "revision_renta_anualidad");
  if (typeFilter === "incidencias") return events.filter(e => e.type === "incidencia");
  if (typeFilter === "citas") {
    const citaEvents = events.filter(e => e.type === "cita");
    if (citaSubFilter === "todos") return citaEvents;
    if (citaSubFilter === "visitas") return citaEvents.filter(e => {
      const t = e.title.toLowerCase();
      return t.includes("visita") || t.includes("inspección") || t.includes("inspeccion");
    });
    if (citaSubFilter === "tecnicos") return citaEvents.filter(e => {
      const t = e.title.toLowerCase();
      return t.includes("técnico") || t.includes("tecnico") || t.includes("caldera") || t.includes("electricista") || t.includes("fontaner") || t.includes("revisión") || t.includes("revision");
    });
    if (citaSubFilter === "mantenimiento") return citaEvents.filter(e => {
      const t = e.title.toLowerCase();
      return t.includes("mantenimiento") || t.includes("limpieza") || t.includes("jardin") || t.includes("jardín") || t.includes("pintura");
    });
    return citaEvents;
  }
  return events;
}

const CalendarioHorizontal = ({
  properties,
  inquilinos,
  pagos,
  eventos,
  incidencias,
  filterPropertyId,
  onCreateEvento,
  onUpdateEvento,
  onDeleteEvento,
  onConfirmarPago,
  contratos,
  onContratoVencimientoClick,
  onIncidenciaClick,
  onEventClick,
  onPropertyClick,
}: CalendarioHorizontalProps) => {
  const now = new Date();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { compensadoEnMes } = usePagoCompensaciones({ userId: user?.id, asOwner: true });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [visibilityConfirm, setVisibilityConfirm] = useState<{ eventoId: string; currentVisible: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [typeFilter, setTypeFilter] = useState<EventFilter>("todos");
  const [gastoSubFilter, setGastoSubFilter] = useState<GastoSubFilter>("todos");
  const [citaSubFilter, setCitaSubFilter] = useState<CitaSubFilter>("todos");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(
    filterPropertyId ? [filterPropertyId] : []
  );
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [showBackToToday, setShowBackToToday] = useState(false);
  const [heCobradoOpen, setHeCobradoOpen] = useState(false);
  const [heCobradoInitial, setHeCobradoInitial] = useState<{ propertyId?: string; mes?: number; anio?: number }>({});
  const [deudaDialogOpen, setDeudaDialogOpen] = useState(false);
  const [mesCompletoOpen, setMesCompletoOpen] = useState(false);
  const [visibleMonthIdx, setVisibleMonthIdx] = useState(6);
  const [mobileMonthIdx, setMobileMonthIdx] = useState(6); // Index into months array (6 = current month)
  const [rentaDetailOpen, setRentaDetailOpen] = useState(false);
  const [rentaDetailMonth, setRentaDetailMonth] = useState<{ mes: number; anio: number }>({ mes: 0, anio: 2026 });

  // New event form state
  const [newEvento, setNewEvento] = useState({
    titulo: "",
    tipo: "evento",
    fecha: "",
    importe: "",
    descripcion: "",
    property_id: filterPropertyId || "",
  });

  // Sync external filter
  useEffect(() => {
    if (filterPropertyId) setSelectedPropertyIds([filterPropertyId]);
    else setSelectedPropertyIds([]);
  }, [filterPropertyId]);

  const { byProperty: tramosByProperty } = useAllRentaActualizaciones();

  // Generate 24 months: 6 past + current + 17 future
  const months = useMemo(() => {
    const result = [];
    for (let offset = -6; offset <= 17; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const m = date.getMonth();
      const y = date.getFullYear();
      const events = generateCalendarEvents(properties, inquilinos, pagos, eventos, y, m, selectedPropertyIds, contratos, incidencias, tramosByProperty, compensadoEnMes);
      result.push({ month: m, year: y, events, isCurrent: offset === 0 });
    }
    return result;
  }, [properties, inquilinos, pagos, eventos, selectedPropertyIds, contratos, incidencias, tramosByProperty]);

  // Calculate unpaid rents summary grouped by property
  const deudas = useMemo(() => {
    const byProperty: Record<string, { propertyName: string; propertyId: string; meses: { mes: number; anio: number; importe: number }[]; total: number }> = {};
    for (const { events } of months) {
      for (const ev of events) {
        // Include impago (full rent owed) and parcial (remaining debt)
        if (ev.type === "renta" && ev.propertyId) {
          if (ev.status === "impago" && ev.rentaEsperada) {
            if (!byProperty[ev.propertyId]) {
              byProperty[ev.propertyId] = { propertyName: ev.propertyName || "", propertyId: ev.propertyId, meses: [], total: 0 };
            }
            byProperty[ev.propertyId].meses.push({ mes: ev.date.getMonth() + 1, anio: ev.date.getFullYear(), importe: ev.rentaEsperada });
            byProperty[ev.propertyId].total += ev.rentaEsperada;
          } else if (ev.status === "parcial" && ev.deuda) {
            if (!byProperty[ev.propertyId]) {
              byProperty[ev.propertyId] = { propertyName: ev.propertyName || "", propertyId: ev.propertyId, meses: [], total: 0 };
            }
            byProperty[ev.propertyId].meses.push({ mes: ev.date.getMonth() + 1, anio: ev.date.getFullYear(), importe: ev.deuda });
            byProperty[ev.propertyId].total += ev.deuda;
          }
        }
      }
    }
    return Object.values(byProperty);
  }, [months]);

  const totalDeuda = deudas.reduce((s, d) => s + d.total, 0);

  // Calculate net balance per property for filter pills
  const propertyBalances = useMemo(() => {
    const balances: Record<string, number> = {};

    // Add expenses from calendar events
    for (const { events } of months) {
      for (const ev of events) {
        if (ev.propertyId && ev.importe != null && ev.flow === "expense") {
          if (!balances[ev.propertyId]) balances[ev.propertyId] = 0;
          balances[ev.propertyId] -= ev.importe;
        }
      }
    }

    // Add confirmed rent income from pagos for the months shown in the calendar
    for (const { month: mo, year: yr } of months) {
      for (const prop of properties) {
        const propPagos = pagos.filter(p =>
          p.property_id === prop.id && p.mes === mo + 1 && p.anio === yr && p.propietario_confirmado && isPagoRealEffective(p)
        );
        const totalCobrado = propPagos.reduce((sum, p) => sum + Number(p.importe_pagado || 0), 0);
        if (totalCobrado > 0) {
          if (!balances[prop.id]) balances[prop.id] = 0;
          balances[prop.id] += totalCobrado;
        }
      }
    }

    return balances;
  }, [months, properties, pagos]);

  // Auto-scroll to current month on mount
  useEffect(() => {
    if (currentMonthRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = currentMonthRef.current;
      container.scrollLeft = target.offsetLeft - container.offsetLeft - 16;
    }
  }, []);

  // Detect scroll position for "back to today" button + track visible month
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !currentMonthRef.current) return;
    const container = scrollRef.current;
    const target = currentMonthRef.current;
    const targetLeft = target.offsetLeft - container.offsetLeft;
    const isVisible = container.scrollLeft >= targetLeft - 300 && container.scrollLeft <= targetLeft + 300;
    setShowBackToToday(!isVisible);

    // Track which month is most centered
    const children = Array.from(container.children) as HTMLElement[];
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - containerCenter);
      if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
    });
    setVisibleMonthIdx(closestIdx);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const scrollToToday = () => {
    if (currentMonthRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = currentMonthRef.current;
      container.scrollTo({ left: target.offsetLeft - container.offsetLeft - 16, behavior: "smooth" });
    }
  };

  // Find months with events matching current filter
  const monthsWithFilteredEvents = useMemo(() => {
    if (typeFilter === "todos") return [];
    return months
      .map((m, idx) => ({
        idx,
        key: `${m.year}-${m.month}`,
        hasEvents: filterEventsByType(m.events, typeFilter, gastoSubFilter, citaSubFilter).length > 0,
      }))
      .filter(m => m.hasEvents);
  }, [months, typeFilter, gastoSubFilter, citaSubFilter]);

  const [currentFilterIdx, setCurrentFilterIdx] = useState(0);

  const scrollToMonthIdx = useCallback((monthIdx: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const monthCards = container.children;
    if (monthIdx >= 0 && monthIdx < monthCards.length) {
      const card = monthCards[monthIdx] as HTMLElement;
      container.scrollTo({ left: card.offsetLeft - container.offsetLeft - 16, behavior: "smooth" });
    }
  }, []);

  // Reset filter index and auto-scroll to first match when filter changes
  useEffect(() => {
    setCurrentFilterIdx(0);
    if (typeFilter !== "todos" && monthsWithFilteredEvents.length > 0) {
      setTimeout(() => scrollToMonthIdx(monthsWithFilteredEvents[0].idx), 100);
    }
  }, [typeFilter, gastoSubFilter, citaSubFilter, monthsWithFilteredEvents.length, scrollToMonthIdx]);


  const navigateFilteredEvent = useCallback((direction: "prev" | "next") => {
    if (monthsWithFilteredEvents.length === 0) return;
    let newIdx = currentFilterIdx;
    if (direction === "next") {
      newIdx = Math.min(currentFilterIdx + 1, monthsWithFilteredEvents.length - 1);
    } else {
      newIdx = Math.max(currentFilterIdx - 1, 0);
    }
    setCurrentFilterIdx(newIdx);
    scrollToMonthIdx(monthsWithFilteredEvents[newIdx].idx);
  }, [currentFilterIdx, monthsWithFilteredEvents, scrollToMonthIdx]);

  // Touch/mouse drag scrolling — use threshold to distinguish click from drag
  const dragThreshold = 5;
  const hasDragged = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;

    const target = e.target as HTMLElement | null;
    const isInteractive = !!target?.closest("button, a, input, textarea, select, [role='button'], [data-clickable]");
    if (isInteractive) return;

    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > dragThreshold) {
      hasDragged.current = true;
      scrollRef.current.style.cursor = "grabbing";
    }
    if (hasDragged.current) {
      scrollRef.current.scrollLeft = scrollLeft.current - dx;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleAddEvento = async () => {
    if (!newEvento.titulo || !newEvento.fecha) return;
    await onCreateEvento({
      titulo: newEvento.titulo,
      tipo: newEvento.tipo,
      fecha: newEvento.fecha,
      importe: newEvento.importe ? parseFloat(newEvento.importe) : null,
      descripcion: newEvento.descripcion || null,
      property_id: newEvento.property_id || null,
      visible_para_inquilino: false,
      recurrente: false,
      recurrencia_meses: null,
      hora: null,
      subtipo: null,
    });
    setAddDialogOpen(false);
    setNewEvento({ titulo: "", tipo: "evento", fecha: "", importe: "", descripcion: "", property_id: filterPropertyId || "" });
  };

  const handleToggleVisibility = async () => {
    if (!visibilityConfirm) return;
    await onUpdateEvento(visibilityConfirm.eventoId, {
      visible_para_inquilino: !visibilityConfirm.currentVisible,
    });
    setVisibilityConfirm(null);
  };

  const toggleMonthExpand = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // All events for MesCompleto
  const allEventsFlat = useMemo(() => months.flatMap(m => m.events), [months]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Calendario</h3>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1 rounded-lg min-h-[40px]" onClick={() => setAddDialogOpen(true)}>
          <Plus size={13} />
          Evento
        </Button>
      </div>

      {/* Filters — simplified on mobile */}
      <div className="bg-secondary/50 rounded-xl p-2.5 sm:p-3 mb-3 space-y-2.5">
        {isMobile ? (
          /* Mobile: single Select for type filter */
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={(v: EventFilter) => { setTypeFilter(v); if (v !== "gastos") setGastoSubFilter("todos"); if (v !== "citas") setCitaSubFilter("todos"); }}>
              <SelectTrigger className="min-h-[44px] text-sm flex-1">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeFilter === "gastos" && (
              <Select value={gastoSubFilter} onValueChange={(v: GastoSubFilter) => setGastoSubFilter(v)}>
                <SelectTrigger className="min-h-[44px] text-sm flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GASTO_SUB_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {typeFilter === "citas" && (
              <Select value={citaSubFilter} onValueChange={(v: CitaSubFilter) => setCitaSubFilter(v)}>
                <SelectTrigger className="min-h-[44px] text-sm flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITA_SUB_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          /* Desktop: tab-style type filter */
          <>
            <div className="flex items-center gap-1">
              <div className="flex bg-card rounded-lg border border-border overflow-x-auto shadow-sm scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                {TYPE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setTypeFilter(f.value); if (f.value !== "gastos") setGastoSubFilter("todos"); if (f.value !== "citas") setCitaSubFilter("todos"); }}
                    className={`text-xs px-3 sm:px-3.5 py-2 font-medium transition-all border-r border-border last:border-r-0 whitespace-nowrap min-h-[40px] ${
                      typeFilter === f.value
                        ? "bg-foreground text-background"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                className="ml-auto p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm min-w-[40px] min-h-[40px] flex items-center justify-center"
                title="Filtros"
              >
                <ListFilter size={16} />
              </button>
            </div>

            {/* Gasto sub-filters */}
            {typeFilter === "gastos" && (
              <div className="flex flex-wrap gap-1.5">
                {GASTO_SUB_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setGastoSubFilter(f.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-full transition-all ${
                      gastoSubFilter === f.value
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Cita sub-filters */}
            {typeFilter === "citas" && (
              <div className="flex flex-wrap gap-1.5">
                {CITA_SUB_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setCitaSubFilter(f.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-full transition-all ${
                      citaSubFilter === f.value
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Property filter — use Select on mobile, pills on desktop */}
        {!filterPropertyId && (
          isMobile ? (
            <Select
              value={selectedPropertyIds.length === 0 ? "all" : selectedPropertyIds[0]}
              onValueChange={(v) => setSelectedPropertyIds(v === "all" ? [] : [v])}
            >
              <SelectTrigger className="min-h-[44px] text-sm">
                <SelectValue placeholder="Todos los activos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los activos</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedPropertyIds([])}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                  selectedPropertyIds.length === 0
                    ? "bg-card border-primary/40 text-foreground font-medium"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                  selectedPropertyIds.length === 0
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card"
                }`}>
                  {selectedPropertyIds.length === 0 && <Check size={10} strokeWidth={3} />}
                </span>
                <span>Todas</span>
              </button>

              {properties.map(p => {
                const isSelected = selectedPropertyIds.includes(p.id) || selectedPropertyIds.length === 0;
                const balance = propertyBalances[p.id] || 0;
                const balanceColor = balance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : balance < 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground";

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (selectedPropertyIds.length === 0) {
                        setSelectedPropertyIds([p.id]);
                      } else if (selectedPropertyIds.includes(p.id)) {
                        const next = selectedPropertyIds.filter(id => id !== p.id);
                        setSelectedPropertyIds(next);
                      } else {
                        setSelectedPropertyIds(prev => [...prev, p.id]);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                      isSelected
                        ? "bg-card border-primary/40 text-foreground font-medium"
                        : "bg-card border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card"
                    }`}>
                      {isSelected && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>{p.nombre_interno}</span>
                    <span className={`font-semibold tabular-nums text-xs ${balanceColor}`}>
                      {balance >= 0 ? "+" : ""}{formatImporte(balance)}€
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* "He cobrado" button */}
      {onConfirmarPago && (
        <div className="mb-3">
          <Button
            onClick={() => setHeCobradoOpen(true)}
            className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
            size="sm"
          >
            <Euro size={15} />
            He cobrado
          </Button>
        </div>
      )}

      {/* ─── MOBILE: Single month with prev/next ─── */}
      {isMobile ? (() => {
        const currentData = months[mobileMonthIdx];
        if (!currentData) return null;
        const { month, year, events, isCurrent } = currentData;
        const filteredEvents = filterEventsByType(events, typeFilter, gastoSubFilter, citaSubFilter);
        const rentEvents = events.filter(e => e.type === "renta");
        const isFutureMonth = rentEvents.length > 0 && rentEvents.every(e => !e.status);
        const allPaid = rentEvents.length === 0 || rentEvents.every(e => e.status === "pagado");
        const hasParcial = rentEvents.some(e => e.status === "parcial");
        const hasImpago = rentEvents.some(e => e.status === "impago");
        const hasNotificado = rentEvents.some(e => e.status === "notificado");
        const hasPendiente = rentEvents.some(e => e.status === "pendiente");
        const hasHistorico = rentEvents.some(e => e.status === "historico");
        const hasInconsistente = rentEvents.some(e => e.inconsistente);

        return (
          <div>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setMobileMonthIdx(i => Math.max(0, i - 1))}
                disabled={mobileMonthIdx <= 0}
                className="w-11 h-11 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <span className={`text-base font-bold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                  {isCurrent && <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1.5 animate-pulse align-middle" />}
                  {MESES[month]} {year}
                </span>
                {rentEvents.length > 0 && !isFutureMonth && (
                  <button
                    onClick={() => {
                      setRentaDetailMonth({ mes: month, anio: year });
                      setRentaDetailOpen(true);
                    }}
                    className={`ml-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      allPaid ? "bg-emerald-100 text-emerald-700"
                      : hasImpago ? "bg-red-100 text-red-700"
                      : hasParcial ? "bg-yellow-100 text-yellow-700"
                      : hasPendiente ? "bg-amber-100 text-amber-700"
                      : hasNotificado ? "bg-orange-100 text-orange-700"
                      : hasHistorico ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {allPaid ? "✓ Al corriente" : hasImpago ? "✗ Impago" : hasParcial ? "⚠ Parcial" : hasPendiente ? "⚠ Pendiente" : hasNotificado ? "⏳ Notificado" : hasHistorico ? "≈ Histórico" : "✓ Al corriente"}
                      {hasInconsistente ? " ⚠" : ""}
                    </button>
                  )}
              </div>
              <button
                onClick={() => setMobileMonthIdx(i => Math.min(months.length - 1, i + 1))}
                disabled={mobileMonthIdx >= months.length - 1}
                className="w-11 h-11 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* "Hoy" shortcut if not on current month */}
            {!isCurrent && (
              <button
                onClick={() => setMobileMonthIdx(6)}
                className="mb-3 text-xs text-primary font-medium flex items-center gap-1 mx-auto"
              >
                <ArrowLeft size={12} /> Ir a hoy
              </button>
            )}

            {/* Events list */}
            {filteredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">Sin eventos este mes</p>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((ev) => {
                  const style = EVENT_COLORS[ev.type] || EVENT_COLORS.evento;
                  const statusBorder = ev.status === "pagado"
                    ? "border-l-2 border-l-emerald-500"
                    : ev.status === "parcial"
                    ? "border-l-2 border-l-yellow-500"
                    : ev.status === "impago" || ev.status === "pendiente"
                    ? "border-l-2 border-l-red-400"
                    : ev.status === "notificado"
                    ? "border-l-2 border-l-orange-400"
                    : ev.status === "historico"
                    ? "border-l-2 border-l-amber-400"
                    : "";
                  const isClickable = !!(
                    (ev.contratoId && onContratoVencimientoClick && (ev.type === "vencimiento" || ev.type === "contrato")) ||
                    ev.type === "renta" ||
                    ev.type === "impuesto" ||
                    (ev.type === "incidencia" && ev.incidenciaId && onIncidenciaClick) ||
                    onEventClick
                  );
                  const handleEventClick = isClickable ? () => {
                    if (ev.contratoId && onContratoVencimientoClick && (ev.type === "vencimiento" || ev.type === "contrato")) {
                      onContratoVencimientoClick(ev.contratoId!);
                    } else if (ev.type === "renta") {
                      setRentaDetailMonth({ mes: ev.date.getMonth(), anio: ev.date.getFullYear() });
                      setRentaDetailOpen(true);
                    } else if (ev.type === "impuesto" && ev.propertyId) {
                      navigate(`/finanzas?propertyId=${ev.propertyId}`);
                    } else if (ev.type === "incidencia" && ev.incidenciaId && onIncidenciaClick) {
                      onIncidenciaClick(ev.incidenciaId);
                    } else if (onEventClick) {
                      onEventClick(ev);
                    }
                  } : undefined;

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm ${style.bg} ${style.text} ${statusBorder} ${isClickable ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
                      onClick={handleEventClick}
                    >
                      <span className="shrink-0">{style.icon}</span>
                      <span className="flex-1 min-w-0 truncate">{ev.title}</span>
                      {ev.importe != null && (
                        <span className={`font-semibold shrink-0 tabular-nums ${
                          ev.flow === "income" ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {ev.flow === "income" ? "+" : "−"}{formatImporte(ev.importe)}€
                        </span>
                      )}
                      {ev.status && (
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[ev.status] || ""}`} title={ev.status} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })() : (
        /* ─── DESKTOP: Horizontal scroll ─── */
        <div className="relative">
          {showBackToToday && (
            <button
              onClick={scrollToToday}
              className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs px-3 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in-0 min-h-[36px]"
            >
              <ArrowLeft size={12} />
              Hoy
            </button>
          )}

          {typeFilter !== "todos" && monthsWithFilteredEvents.length > 0 && (
            <>
              <button
                onClick={() => navigateFilteredEvent("prev")}
                disabled={currentFilterIdx <= 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Evento anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => navigateFilteredEvent("next")}
                disabled={currentFilterIdx >= monthsWithFilteredEvents.length - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Siguiente evento"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 select-none touch-pan-x"
            style={{ cursor: "grab", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {months.map(({ month, year, events, isCurrent }, monthIdx) => {
              const filteredEventsRaw = filterEventsByType(events, typeFilter, gastoSubFilter, citaSubFilter);
              const priorityTypes = new Set(["vencimiento", "contrato"]);
              const filteredEvents = [...filteredEventsRaw].sort((a, b) => {
                const aPriority = priorityTypes.has(a.type) ? 0 : 1;
                const bPriority = priorityTypes.has(b.type) ? 0 : 1;
                return aPriority - bPriority;
              });
              const rentEvents = events.filter(e => e.type === "renta");
              const isFutureMonth = rentEvents.length > 0 && rentEvents.every(e => !e.status);
              const allPaid = rentEvents.length === 0 || rentEvents.every(e => e.status === "pagado");
              const hasParcial = rentEvents.some(e => e.status === "parcial");
              const hasImpago = rentEvents.some(e => e.status === "impago");
              const hasNotificado = rentEvents.some(e => e.status === "notificado");
              const hasPendiente = rentEvents.some(e => e.status === "pendiente");
              const hasHistorico = rentEvents.some(e => e.status === "historico");
              const hasInconsistente = rentEvents.some(e => e.inconsistente);
              const monthKey = `${year}-${month}`;
              const isExpanded = expandedMonths.has(monthKey);
              const MAX_VISIBLE = 3;
              const visibleEvents = isExpanded ? filteredEvents : filteredEvents.slice(0, MAX_VISIBLE);
              const hiddenCount = filteredEvents.length - MAX_VISIBLE;
              const isSelected = visibleMonthIdx === monthIdx;

              return (
                <div
                  key={monthKey}
                  ref={isCurrent ? currentMonthRef : undefined}
                  data-clickable
                  onClick={() => { if (!hasDragged.current) setVisibleMonthIdx(monthIdx); }}
                  className={`min-w-[280px] w-[280px] sm:min-w-[260px] sm:w-[260px] flex-shrink-0 rounded-xl p-3.5 sm:p-3 transition-all cursor-pointer ${
                    isCurrent
                      ? "border-2 border-primary bg-primary/10 shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                      : isSelected
                      ? "border-2 border-primary/50 bg-primary/5 shadow-md"
                      : "border border-border/60 bg-card shadow-[0_1px_3px_0_hsl(var(--border)/0.15)] hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                      {isCurrent && <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1.5 animate-pulse" />}
                      {MESES[month]} {year}
                    </div>
                    {rentEvents.length > 0 && !isFutureMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRentaDetailMonth({ mes: month, anio: year });
                          setRentaDetailOpen(true);
                        }}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all hover:ring-2 hover:ring-primary/30 cursor-pointer min-h-[28px] ${
                        allPaid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : hasImpago ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : hasParcial ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : hasPendiente ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : hasNotificado ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : hasHistorico ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      }`}>
                        {allPaid ? "✓ Al corriente" : hasImpago ? "✗ Impago" : hasParcial ? "⚠ Pago parcial" : hasPendiente ? "⚠ Pendiente" : hasNotificado ? "⏳ Notificado" : hasHistorico ? "≈ Histórico" : "✓ Al corriente"}
                        {hasInconsistente ? " ⚠" : ""}
                      </button>
                    )}
                  </div>

                  {visibleEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3">Sin eventos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleEvents.map((ev) => {
                        const style = EVENT_COLORS[ev.type] || EVENT_COLORS.evento;
                        const statusBorder = ev.status === "pagado"
                          ? "border-l-2 border-l-emerald-500"
                          : ev.status === "parcial"
                          ? "border-l-2 border-l-yellow-500"
                          : ev.status === "impago" || ev.status === "pendiente"
                          ? "border-l-2 border-l-red-400"
                          : ev.status === "notificado"
                          ? "border-l-2 border-l-orange-400"
                          : ev.status === "historico"
                          ? "border-l-2 border-l-amber-400"
                          : "";
                        const isClickable = !!(
                          (ev.contratoId && onContratoVencimientoClick && (ev.type === "vencimiento" || ev.type === "contrato")) ||
                          ev.type === "renta" ||
                          ev.type === "impuesto" ||
                          (ev.type === "incidencia" && ev.incidenciaId && onIncidenciaClick) ||
                          onEventClick
                        );
                        const handleEventClick = isClickable ? (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (ev.contratoId && onContratoVencimientoClick && (ev.type === "vencimiento" || ev.type === "contrato")) {
                            onContratoVencimientoClick(ev.contratoId!);
                          } else if (ev.type === "renta") {
                            setRentaDetailMonth({ mes: ev.date.getMonth(), anio: ev.date.getFullYear() });
                            setRentaDetailOpen(true);
                          } else if (ev.type === "impuesto" && ev.propertyId) {
                            navigate(`/finanzas?propertyId=${ev.propertyId}`);
                          } else if (ev.type === "incidencia" && ev.incidenciaId && onIncidenciaClick) {
                            onIncidenciaClick(ev.incidenciaId);
                          } else if (onEventClick) {
                            onEventClick(ev);
                          }
                        } : undefined;
                        return (
                          <div
                            key={ev.id}
                            data-clickable
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${style.bg} ${style.text} ${statusBorder} group ${isClickable ? "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" : ""}`}
                            onClick={handleEventClick}
                          >
                            <span className="shrink-0">{style.icon}</span>
                            <span className="flex-1 min-w-0 truncate">{ev.title}</span>
                            {ev.importe != null && (
                              <span className={`font-semibold shrink-0 tabular-nums ${
                                ev.flow === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                              }`}>
                                {ev.flow === "income" ? "+" : "−"}{formatImporte(ev.importe)}€
                              </span>
                            )}
                            {ev.status && (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[ev.status] || ""}`} title={ev.status} />
                            )}
                            {ev.propertyName && selectedPropertyIds.length !== 1 && (
                              <span className="text-xs opacity-60 shrink-0 hidden sm:inline">{ev.propertyName}</span>
                            )}
                            {ev.eventoId && (
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                title={ev.visible_para_inquilino ? "Visible para inquilino" : "No visible para inquilino"}
                                onClick={(e) => { e.stopPropagation(); setVisibilityConfirm({ eventoId: ev.eventoId!, currentVisible: !!ev.visible_para_inquilino }); }}
                              >
                                {ev.visible_para_inquilino ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {hiddenCount > 0 && !isExpanded && (
                        <button
                          onClick={() => toggleMonthExpand(monthKey)}
                          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline w-full justify-center py-1.5 min-h-[36px]"
                        >
                          {hiddenCount} eventos más
                          <ChevronDown size={14} />
                        </button>
                      )}
                      {isExpanded && filteredEvents.length > MAX_VISIBLE && (
                        <button
                          onClick={() => toggleMonthExpand(monthKey)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full justify-center py-1"
                        >
                          Colapsar
                          <ChevronUp size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next event shortcut + Ver mes completo */}
      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
        {typeFilter !== "todos" && (() => {
          const now = new Date();
          const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          // Find the first future month index with matching events
          let nextMonthIdx: number | null = null;
          let nextEventTitle: string | null = null;
          for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const monthStart = new Date(m.year, m.month, 1).getTime();
            if (monthStart < todayTime - 31 * 86400000) continue; // skip far past months
            const filtered = filterEventsByType(m.events, typeFilter, gastoSubFilter, citaSubFilter);
            // Find events on or after today
            const futureEv = filtered.find(ev => ev.date.getTime() >= todayTime);
            if (futureEv) {
              nextMonthIdx = i;
              nextEventTitle = futureEv.title;
              break;
            }
          }
          if (nextMonthIdx === null) return null;

          const labelMap: Record<string, string> = {
            cobros: "Próxima renta",
            gastos: "Próximo gasto",
            contratos: "Próxima variación contrato",
            citas: "Próxima cita",
            incidencias: "Próxima incidencia",
          };
          const label = labelMap[typeFilter] || "Próximo evento";

          return (
            <button
              onClick={() => scrollToMonthIdx(nextMonthIdx!)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors border border-primary/20"
            >
              <ChevronRight size={13} />
              <span>{label}</span>
            </button>
          );
        })()}
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-lg gap-1"
          onClick={() => setMesCompletoOpen(true)}
        >
          <CalendarIcon size={13} />
          Ver mes completo
        </Button>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={newEvento.titulo} onChange={e => setNewEvento(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Revisión caldera" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newEvento.tipo} onValueChange={v => setNewEvento(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={newEvento.fecha} onChange={e => setNewEvento(p => ({ ...p, fecha: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Importe (€)</Label>
                <Input type="number" value={newEvento.importe} onChange={e => setNewEvento(p => ({ ...p, importe: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Propiedad</Label>
                <Select value={newEvento.property_id} onValueChange={v => setNewEvento(p => ({ ...p, property_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General (todas)</SelectItem>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={newEvento.descripcion} onChange={e => setNewEvento(p => ({ ...p, descripcion: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddEvento} disabled={!newEvento.titulo || !newEvento.fecha}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visibility confirmation dialog */}
      <AlertDialog open={!!visibilityConfirm} onOpenChange={() => setVisibilityConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {visibilityConfirm?.currentVisible
                ? "¿Ocultar este evento al inquilino?"
                : "¿Hacer visible este evento para el inquilino?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {visibilityConfirm?.currentVisible
                ? "El inquilino dejará de ver este evento en su calendario."
                : "¿Estás seguro? El inquilino podrá ver este evento en su portal."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleVisibility}>
              {visibilityConfirm?.currentVisible ? "Ocultar" : "Hacer visible"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* He Cobrado Sheet */}
      {onConfirmarPago && (
        <HeCobradoSheet
          open={heCobradoOpen}
          onOpenChange={setHeCobradoOpen}
          properties={properties}
          inquilinos={inquilinos}
          contratos={contratos}
          pagos={pagos}
          initialPropertyId={heCobradoInitial.propertyId}
          initialMes={heCobradoInitial.mes}
          initialAnio={heCobradoInitial.anio}
          onConfirmar={async (propertyId, inquilinoId, datos, mes, anio) => {
            await onConfirmarPago(propertyId, inquilinoId, datos, mes, anio);
          }}
        />
      )}

      {/* Deuda detail dialog */}
      <DeudaDetalleDialog
        open={deudaDialogOpen}
        onOpenChange={setDeudaDialogOpen}
        deudas={deudas}
        onPropertyClick={onPropertyClick}
      />

      {/* Mes Completo View */}
      <MesCompletoView
        open={mesCompletoOpen}
        onOpenChange={setMesCompletoOpen}
        events={filterEventsByType(allEventsFlat, typeFilter, gastoSubFilter, citaSubFilter)}
        initialMonth={months[visibleMonthIdx]?.month ?? now.getMonth()}
        initialYear={months[visibleMonthIdx]?.year ?? now.getFullYear()}
        properties={properties}
        selectedPropertyIds={selectedPropertyIds}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onPropertyFilterChange={setSelectedPropertyIds}
        onEventClick={(ev: any) => {
          if (ev.type === "renta") {
            setRentaDetailMonth({ mes: ev.date.getMonth(), anio: ev.date.getFullYear() });
            setRentaDetailOpen(true);
          } else if (ev.type === "impuesto" && ev.propertyId) {
            navigate(`/finanzas?propertyId=${ev.propertyId}`);
          } else if (onEventClick) {
            onEventClick(ev);
          }
        }}
      />

      {/* Renta Detail Dialog */}
      <RentaDetailDialog
        open={rentaDetailOpen}
        onOpenChange={setRentaDetailOpen}
        mes={rentaDetailMonth.mes}
        anio={rentaDetailMonth.anio}
        properties={properties}
        inquilinos={inquilinos}
        pagos={pagos}
        contratos={contratos}
        onPropertyRentClick={(propertyId) => {
          setRentaDetailOpen(false);
          onPropertyClick?.(propertyId);
        }}
        onRegistrarCobro={(propertyId, _inquilinoId, m, a) => {
          setRentaDetailOpen(false);
          if (onConfirmarPago) {
            setHeCobradoInitial({ propertyId, mes: m + 1, anio: a });
            setHeCobradoOpen(true);
            return;
          }
          onPropertyClick?.(propertyId);
        }}
      />
    </div>
  );
};

export { type CalendarEvent, type EventFilter, formatImporte };
export default CalendarioHorizontal;
