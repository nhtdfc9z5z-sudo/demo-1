/**
 * Contract visual status calculation.
 * 
 * Computes display-only states from contract data without modifying DB.
 * Follows Spanish LAU logic for automatic renewal and preaviso periods.
 * 
 * Three-date system:
 *   1. Fecha fin efectiva (next renewal/end date)
 *   2. Fecha límite preaviso (last day to notify non-renewal)
 *   3. Fecha aviso interno (30 days before preaviso — app reminder)
 */

import type { Contrato } from "@/hooks/useContratos";

export type ContratoVisualStatus =
  | "aviso_interno"       // Internal app alert — 30d before preaviso starts
  | "preaviso_activo"     // Within preaviso period — requires action
  | "proximo_vencer"      // < 90 days to fecha_fin — informational
  | "requiere_atencion"   // IPC pending or stagnant issues
  | "vigente"             // Normal active contract
  | "prorrogado"          // Past original fecha_fin, auto-renewed by LAU
  | "finalizado"          // Ended
  | "archivado";          // Soft-deleted

export interface ContratoDateTimeline {
  /** Effective next renewal/end date (auto-rolled per LAU) */
  fechaFinEfectiva: Date | null;
  /** Last day to notify tenant of non-renewal */
  fechaLimitePreaviso: Date | null;
  /** Internal app reminder (30d before preaviso starts) */
  fechaAvisoInterno: Date | null;
  /** Is the original fecha_fin in the past (auto-renewed) */
  isProrrogado: boolean;
}

export interface ContratoStatusInfo {
  status: ContratoVisualStatus;
  label: string;
  color: string;          // Tailwind bg class
  textColor: string;      // Tailwind text class
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  daysUntilEnd: number | null;
  daysUntilPreaviso: number | null;
  daysUntilAvisoInterno: number | null;
  isProrrogado: boolean;
  urgencyScore: number;   // Higher = more urgent, used for sorting
  timeline: ContratoDateTimeline;
}

/**
 * Calculate the three key dates for a contract.
 */
export function getContratoTimeline(contrato: Contrato): ContratoDateTimeline {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fechaFin = contrato.fecha_fin ? new Date(contrato.fecha_fin) : null;
  const isProrrogado = fechaFin ? fechaFin < today : false;

  // Roll forward if auto-renewed per LAU
  let fechaFinEfectiva: Date | null = null;
  if (fechaFin) {
    fechaFinEfectiva = new Date(fechaFin);
    while (fechaFinEfectiva <= today) {
      fechaFinEfectiva.setFullYear(fechaFinEfectiva.getFullYear() + 1);
    }
  }

  // Preaviso deadline = end date minus preaviso months
  const preavisoMeses = contrato.preaviso_meses || 2;
  let fechaLimitePreaviso: Date | null = null;
  if (fechaFinEfectiva) {
    fechaLimitePreaviso = new Date(fechaFinEfectiva);
    fechaLimitePreaviso.setMonth(fechaLimitePreaviso.getMonth() - preavisoMeses);
  }

  // Internal alert = 30 days before preaviso deadline
  let fechaAvisoInterno: Date | null = null;
  if (fechaLimitePreaviso) {
    fechaAvisoInterno = new Date(fechaLimitePreaviso);
    fechaAvisoInterno.setDate(fechaAvisoInterno.getDate() - 30);
  }

  return { fechaFinEfectiva, fechaLimitePreaviso, fechaAvisoInterno, isProrrogado };
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the visual status of a contract based on LAU rules.
 */
export function getContratoStatus(
  contrato: Contrato,
  options?: {
    lastIpcDate?: string | null;
    openIncidenciasCount?: number;
  }
): ContratoStatusInfo {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Archived
  if (contrato.archivado) {
    return {
      status: "archivado",
      label: "Archivado",
      color: "bg-muted",
      textColor: "text-muted-foreground",
      badgeVariant: "outline",
      daysUntilEnd: null,
      daysUntilPreaviso: null,
      daysUntilAvisoInterno: null,
      isProrrogado: false,
      urgencyScore: 0,
      timeline: { fechaFinEfectiva: null, fechaLimitePreaviso: null, fechaAvisoInterno: null, isProrrogado: false },
    };
  }

  // Finalizado
  if (contrato.estado === "finalizado") {
    return {
      status: "finalizado",
      label: "Finalizado",
      color: "bg-muted-foreground/20",
      textColor: "text-muted-foreground",
      badgeVariant: "secondary",
      daysUntilEnd: null,
      daysUntilPreaviso: null,
      daysUntilAvisoInterno: null,
      isProrrogado: false,
      urgencyScore: 1,
      timeline: { fechaFinEfectiva: null, fechaLimitePreaviso: null, fechaAvisoInterno: null, isProrrogado: false },
    };
  }

  // Active contract — calculate timeline
  const timeline = getContratoTimeline(contrato);
  const { fechaFinEfectiva, fechaLimitePreaviso, fechaAvisoInterno, isProrrogado } = timeline;

  const daysUntilEnd = fechaFinEfectiva ? daysBetween(today, fechaFinEfectiva) : null;
  const daysUntilPreaviso = fechaLimitePreaviso ? daysBetween(today, fechaLimitePreaviso) : null;
  const daysUntilAvisoInterno = fechaAvisoInterno ? daysBetween(today, fechaAvisoInterno) : null;

  const inPreavisoPeriod = daysUntilPreaviso !== null && daysUntilPreaviso <= 0;
  const inAvisoInternoPeriod = daysUntilAvisoInterno !== null && daysUntilAvisoInterno <= 0 && !inPreavisoPeriod;

  // Check if IPC might be pending (>11 months since last update)
  let ipcPending = false;
  if (options?.lastIpcDate && contrato.renta_mensual) {
    const lastUpdate = new Date(options.lastIpcDate);
    const monthsSince = (today.getFullYear() - lastUpdate.getFullYear()) * 12 +
      (today.getMonth() - lastUpdate.getMonth());
    ipcPending = monthsSince >= 11;
  }

  const base = { daysUntilEnd, daysUntilPreaviso, daysUntilAvisoInterno, isProrrogado, timeline };

  // Priority 1: Preaviso activo (highest urgency)
  if (inPreavisoPeriod) {
    return {
      ...base,
      status: "preaviso_activo",
      label: "Preaviso activo",
      color: "bg-red-500",
      textColor: "text-red-700",
      badgeVariant: "destructive",
      urgencyScore: 100,
    };
  }

  // Priority 2: Internal alert period (30d before preaviso)
  if (inAvisoInternoPeriod) {
    return {
      ...base,
      status: "aviso_interno",
      label: "Aviso: preaviso próximo",
      color: "bg-orange-500",
      textColor: "text-orange-700",
      badgeVariant: "destructive",
      urgencyScore: 90,
    };
  }

  // Priority 3: Requiere atención (IPC pending or stagnant incidencias)
  if (ipcPending || (options?.openIncidenciasCount && options.openIncidenciasCount >= 3)) {
    return {
      ...base,
      status: "requiere_atencion",
      label: ipcPending ? "IPC pendiente" : "Requiere atención",
      color: "bg-amber-500",
      textColor: "text-amber-700",
      badgeVariant: "default",
      urgencyScore: 80,
    };
  }

  // Priority 4: Próximo a renovarse (< 90 days)
  if (daysUntilEnd !== null && daysUntilEnd <= 90 && daysUntilEnd > 0) {
    return {
      ...base,
      status: "proximo_vencer",
      label: `Se renueva en ${daysUntilEnd}d`,
      color: "bg-amber-400",
      textColor: "text-amber-600",
      badgeVariant: "outline",
      urgencyScore: 60,
    };
  }

  // Priority 5: Prorrogado automáticamente
  if (isProrrogado) {
    return {
      ...base,
      status: "prorrogado",
      label: "Prórroga automática",
      color: "bg-sky-500",
      textColor: "text-sky-700",
      badgeVariant: "outline",
      urgencyScore: 20,
    };
  }

  // Default: Vigente
  return {
    ...base,
    status: "vigente",
    label: "Vigente",
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    badgeVariant: "default",
    urgencyScore: 10,
  };
}

/**
 * Sort contracts by urgency (highest first), then by date.
 */
export function sortContratosByUrgency(
  contratos: Contrato[],
  getStatusInfo: (c: Contrato) => ContratoStatusInfo,
): Contrato[] {
  return [...contratos].sort((a, b) => {
    const sa = getStatusInfo(a);
    const sb = getStatusInfo(b);
    if (sa.urgencyScore !== sb.urgencyScore) return sb.urgencyScore - sa.urgencyScore;
    if (sa.daysUntilEnd !== null && sb.daysUntilEnd !== null) {
      return sa.daysUntilEnd - sb.daysUntilEnd;
    }
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

/**
 * Find active (non-archived, non-finalized) contract for a property.
 */
export function findActiveContrato(
  contratos: Contrato[],
  propertyId: string,
): Contrato | null {
  return contratos.find(
    c => c.property_id === propertyId && !c.archivado && c.estado !== "finalizado"
  ) || null;
}

/**
 * Check if a property already has an active contract.
 */
export function hasActiveContrato(
  contratos: Contrato[],
  propertyId: string,
): boolean {
  return !!findActiveContrato(contratos, propertyId);
}

/**
 * Format a date for display in Spanish.
 */
export function formatDateEs(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Visual mapping for alta-guiada lifecycle states (free-text on contratos_arrendamiento.estado).
 * Returns null if the state is not one of the alta-guiada extras.
 */
export function getAltaGuiadaEstadoInfo(estado: string | null | undefined): { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" } | null {
  switch (estado) {
    case "pendiente_regularizacion":
      return { label: "Pendiente de regularizar", tone: "warning" };
    case "historico_regularizado":
      return { label: "Histórico regularizado", tone: "info" };
    case "con_pagos_pendientes":
      return { label: "Con pagos pendientes", tone: "danger" };
    case "activo":
    case "vigente":
      return { label: "Activo", tone: "success" };
    case "finalizado":
      return { label: "Finalizado", tone: "muted" };
    default:
      return null;
  }
}
