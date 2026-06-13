/**
 * Selección de mensaje prioritario para el banner inteligente.
 * Función pura: recibe inputs, devuelve mensaje o null.
 * No hace fetches ni toca Supabase.
 */

import type { Property } from "@/hooks/useProperties";
import type { Contrato } from "@/hooks/useContratos";
import type { Inquilino } from "@/hooks/useInquilinos";

export type AccionTipo =
  | "abrir-activo"
  | "abrir-contrato"
  | "abrir-fiscalidad"
  | "navegar";

export interface AccionMensaje {
  tipo: AccionTipo;
  propertyId?: string;
  contratoId?: string;
  ruta?: string;
}

export interface MensajeInteligente {
  id: string;
  prioridad: 1 | 2 | 3 | 4 | 5;
  titulo: string;
  descripcion: string;
  ctaLabel: string;
  accion: AccionMensaje;
}

export interface SeleccionInput {
  properties: Property[];
  contratos: Contrato[];
  inquilinos: Inquilino[];
  now: Date;
}

const MS_DIA = 1000 * 60 * 60 * 24;

function diffDias(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / MS_DIA);
}

function nombreActivo(p: Property): string {
  return p.nombre_interno || p.direccion_completa || "tu activo";
}

function nombreInquilino(c: Contrato, inquilinos: Inquilino[]): string {
  if (!c.inquilino_id) return c.titulo || "tu inquilino";
  const inq = inquilinos.find((i) => i.id === c.inquilino_id);
  if (!inq) return c.titulo || "tu inquilino";
  return [inq.nombre, inq.apellidos].filter(Boolean).join(" ").trim() || "tu inquilino";
}

function getPendientesTitularidad(p: Property): string[] {
  const td = p.titularidad_detalle as { pendientes?: unknown } | null | undefined;
  if (!td || typeof td !== "object") return [];
  const pend = (td as { pendientes?: unknown }).pendientes;
  return Array.isArray(pend) ? (pend as string[]) : [];
}

/**
 * Construye candidatos por prioridad y elige uno.
 * Devuelve `null` si no hay nada relevante.
 */
export function seleccionarMensaje(input: SeleccionInput): MensajeInteligente | null {
  const { properties, contratos, inquilinos, now } = input;

  if (!properties || properties.length === 0) return null;

  // ============ P1 — Crítico / urgente ============
  // Contratos activos con fecha_fin dentro de 30 días
  const contratosUrgentes = contratos
    .filter((c) => c.estado === "activo" && c.fecha_fin)
    .map((c) => {
      const dias = diffDias(new Date(c.fecha_fin as string), now);
      return { c, dias };
    })
    .filter(({ dias }) => dias >= 0 && dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  if (contratosUrgentes.length > 0) {
    const { c, dias } = contratosUrgentes[0];
    const nom = nombreInquilino(c, inquilinos);
    return {
      id: `contrato-vence-${c.id}`,
      prioridad: 1,
      titulo: "Renovación próxima",
      descripcion:
        dias === 0
          ? `El contrato de ${nom} vence hoy.`
          : dias === 1
          ? `El contrato de ${nom} vence mañana.`
          : `El contrato de ${nom} vence en ${dias} días.`,
      ctaLabel: "Revisar contrato",
      accion: { tipo: "abrir-contrato", contratoId: c.id, propertyId: c.property_id },
    };
  }

  // ============ P2 — Bloqueante de expediente ============
  // Titularidad pendiente
  const propsConTitPendiente = properties.filter(
    (p) => getPendientesTitularidad(p).length > 0
  );
  if (propsConTitPendiente.length > 0) {
    const p = propsConTitPendiente[0];
    return {
      id: `titularidad-${p.id}`,
      prioridad: 2,
      titulo: "Titularidad incompleta",
      descripcion:
        propsConTitPendiente.length === 1
          ? `Falta completar la titularidad de ${nombreActivo(p)}.`
          : `Tienes ${propsConTitPendiente.length} activos con titularidad incompleta.`,
      ctaLabel: "Completar titularidad",
      accion: { tipo: "abrir-activo", propertyId: p.id },
    };
  }

  // Referencia catastral
  const sinCatastro = properties.filter((p) => !p.referencia_catastral);
  if (sinCatastro.length > 0) {
    const p = sinCatastro[0];
    return {
      id: `catastro-${p.id}`,
      prioridad: 2,
      titulo: "Referencia catastral pendiente",
      descripcion:
        sinCatastro.length === 1
          ? `${nombreActivo(p)} no tiene referencia catastral.`
          : `Tienes ${sinCatastro.length} activos sin referencia catastral.`,
      ctaLabel: "Añadir referencia",
      accion: { tipo: "abrir-activo", propertyId: p.id },
    };
  }

  // Certificado energético
  const sinCEE = properties.filter((p) => !p.tiene_certificado_energetico);
  if (sinCEE.length > 0) {
    const p = sinCEE[0];
    return {
      id: `cee-${p.id}`,
      prioridad: 2,
      titulo: "Certificado energético pendiente",
      descripcion:
        sinCEE.length === 1
          ? `A ${nombreActivo(p)} le falta el certificado energético.`
          : `Tienes ${sinCEE.length} activos sin certificado energético.`,
      ctaLabel: "Añadir CEE",
      accion: { tipo: "abrir-activo", propertyId: p.id },
    };
  }

  // ============ P3 — Fiscal / administrativo ============
  const mes = now.getMonth() + 1; // 1-12
  const hayContratosVigentes = contratos.some((c) => c.estado === "activo");
  if ((mes === 1 || mes === 6) && hayContratosVigentes) {
    return {
      id: `fiscal-renta-${now.getFullYear()}-${mes}`,
      prioridad: 3,
      titulo: "Declaración de renta",
      descripcion: `Prepara tu declaración de renta de ${now.getFullYear()}.`,
      ctaLabel: "Ir a fiscalidad",
      accion: { tipo: "abrir-fiscalidad" },
    };
  }

  // ============ P5 — Onboarding ============
  // (P4 mejora completitud — no implementado aún; queda como TODO.)
  // Si no hay contratos en absoluto, empujar al onboarding básico.
  if (contratos.length === 0) {
    return {
      id: "onboarding-sin-contrato",
      prioridad: 5,
      titulo: "Empieza a controlar tus alquileres",
      descripcion: "Aún no tienes contratos dados de alta.",
      ctaLabel: "Dar de alta un alquiler",
      accion: { tipo: "navegar", ruta: "/propietarios" },
    };
  }

  return null;
}