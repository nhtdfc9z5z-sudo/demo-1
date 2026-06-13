/**
 * Unified financial data resolution.
 * 
 * Source of truth hierarchy:
 *   1. contratos_arrendamiento (renta_mensual, fianza_importe, deposito_garantia)
 *   2. inquilinos (legacy fallback — renta_mensual, fianza, deposito_garantia)
 * 
 * This module ensures every screen shows the same value.
 */

import type { Contrato } from "@/hooks/useContratos";
import type { Inquilino } from "@/hooks/useInquilinos";

/**
 * Tramos históricos de renta (renta_actualizaciones).
 * Solo se usa la forma mínima necesaria para evitar acoplar al hook.
 */
export interface RentaTramo {
  fecha_efectiva: string;
  importe_nuevo: number;
  /** Renta inmediatamente anterior al tramo (si se conoce). */
  importe_anterior?: number | null;
}

export interface ResolvedFinancials {
  renta_mensual: number | null;
  fianza: number | null;
  deposito_garantia: number | null;
  source: "contrato" | "inquilino" | "none";
  contratoId: string | null;
}

/**
 * [H2.9] Devuelve `true` si el periodo (mes, anio) cae DENTRO del alcance
 * de control económico de CapitalRent para el contrato dado. Si el contrato
 * no define `fecha_inicio_control`, asumimos que controla desde su
 * `fecha_inicio` (comportamiento legacy). Periodos anteriores a la fecha de
 * control se consideran "fuera del alcance" y no deben generar deuda,
 * impagos, pendientes, recordatorios ni métricas.
 */
export function isPeriodoBajoControl(
  contrato: Pick<Contrato, "fecha_inicio_control" | "fecha_inicio" | "created_at"> | null | undefined,
  mes: number,
  anio: number,
): boolean {
  if (!contrato) return true;
  // [H2.9] Fallback defensivo: si no hay `fecha_inicio_control` explícito,
  // CapitalRent solo controla desde el alta del contrato en la app (`created_at`).
  // Nunca usar `fecha_inicio` legal como fallback: generaría deuda retroactiva
  // ficticia para contratos antiguos importados antes de añadir el campo.
  const ctrl = contrato.fecha_inicio_control || contrato.created_at;
  if (!ctrl) return true;
  const d = new Date(ctrl);
  if (isNaN(d.getTime())) return true;
  const ctrlYM = d.getFullYear() * 12 + d.getMonth();
  const targetYM = anio * 12 + (mes - 1);
  return targetYM >= ctrlYM;
}

/**
 * Resolve renta_mensual for a given property+inquilino pair.
 * Prefers active (non-archived) contrato over inquilino legacy fields.
 */
export function resolveFinancials(
  propertyId: string | null | undefined,
  inquilino: Inquilino | null | undefined,
  contratos: Contrato[],
): ResolvedFinancials {
  const empty: ResolvedFinancials = {
    renta_mensual: null,
    fianza: null,
    deposito_garantia: null,
    source: "none",
    contratoId: null,
  };

  if (!propertyId) return empty;

  // Find the active contrato for this property (prefer one linked to this inquilino)
  const activeContratos = contratos.filter(
    c => c.property_id === propertyId && !c.archivado && c.estado !== "finalizado"
  );

  let contrato: Contrato | undefined;
  if (inquilino) {
    contrato = activeContratos.find(c => c.inquilino_id === inquilino.id);
  }
  if (!contrato) {
    contrato = activeContratos[0];
  }

  if (contrato && (contrato.renta_mensual != null || contrato.fianza_importe != null || contrato.deposito_garantia != null)) {
    return {
      renta_mensual: contrato.renta_mensual != null ? Number(contrato.renta_mensual) : null,
      fianza: contrato.fianza_importe != null ? Number(contrato.fianza_importe) : null,
      deposito_garantia: contrato.deposito_garantia != null ? Number(contrato.deposito_garantia) : null,
      source: "contrato",
      contratoId: contrato.id,
    };
  }

  // Fallback to inquilino legacy fields
  if (inquilino && (inquilino.renta_mensual != null || inquilino.fianza != null || inquilino.deposito_garantia != null)) {
    return {
      renta_mensual: inquilino.renta_mensual != null ? Number(inquilino.renta_mensual) : null,
      fianza: inquilino.fianza != null ? Number(inquilino.fianza) : null,
      deposito_garantia: inquilino.deposito_garantia != null ? Number(inquilino.deposito_garantia) : null,
      source: "inquilino",
      contratoId: null,
    };
  }

  return empty;
}

/**
 * Resolve the expected monthly rent for a property.
 * Used by calendars, charts, health indicators, and payment status calculations.
 */
export function resolveRentaEsperada(
  propertyId: string,
  inquilinos: Inquilino[],
  contratos: Contrato[],
  opts?: {
    /** Tramos en `renta_actualizaciones` ordenados o no por fecha. */
    actualizaciones?: RentaTramo[];
    /** Si se proporciona, devuelve la renta vigente en ese mes/año. */
    mes?: number;
    anio?: number;
  },
): number | null {
  const propInquilinos = inquilinos.filter(
    i => i.property_id === propertyId && i.rol_inquilino !== "avalista"
  );

  const activeContrato = contratos.find(
    c => c.property_id === propertyId && !c.archivado && c.estado !== "finalizado" && c.renta_mensual != null
  );

  // [H2.9] Si se pregunta por un periodo concreto y ese periodo está fuera
  // del alcance de control del contrato activo, no hay renta esperada.
  // Esto evita que el motor calcule deuda, pendientes o métricas para
  // meses anteriores al inicio de control de CapitalRent.
  if (
    activeContrato &&
    opts?.mes != null &&
    opts?.anio != null &&
    !isPeriodoBajoControl(activeContrato, opts.mes, opts.anio)
  ) {
    return null;
  }

  const fallback = activeContrato?.renta_mensual != null
    ? Number(activeContrato.renta_mensual)
    : null;

  if (fallback != null) {
    // Si pidieron renta por periodo y hay tramos → resolver tramo aplicable.
    if (opts?.actualizaciones && opts.mes != null && opts.anio != null) {
      return getRentaEnPeriodo(opts.actualizaciones, opts.mes, opts.anio, fallback);
    }
    return fallback;
  }

  // Legacy fallback
  const inqWithRenta = propInquilinos.find(i => i.renta_mensual != null);
  const legacy = inqWithRenta?.renta_mensual != null ? Number(inqWithRenta.renta_mensual) : null;
  if (legacy != null && opts?.actualizaciones && opts.mes != null && opts.anio != null) {
    return getRentaEnPeriodo(opts.actualizaciones, opts.mes, opts.anio, legacy);
  }
  return legacy;
}

/**
 * Devuelve la renta vigente en un mes/año concretos a partir de los tramos
 * de `renta_actualizaciones`. Si no hay tramo aplicable (mes anterior al
 * primer tramo) o no hay tramos, devuelve `fallback` (= renta vigente actual).
 *
 * Regla: el tramo aplica desde su `fecha_efectiva` (inclusive). Se evalúa
 * tomando el día 15 del mes para evitar ambigüedades de borde.
 *
 * IMPORTANTE: bajo el modelo acordado (Sprint 2.5+), `contrato.renta_mensual`
 * representa la renta vigente cacheada. Cuando no hay tramos registrados,
 * asumimos por backfill que la renta ha sido constante desde `fecha_inicio`,
 * de modo que `fallback` es seguro y NO genera deuda histórica falsa.
 */
export function getRentaEnPeriodo(
  actualizaciones: RentaTramo[] | null | undefined,
  mes: number,
  anio: number,
  fallback: number | null,
): number | null {
  if (!actualizaciones || actualizaciones.length === 0) return fallback;
  const target = new Date(anio, mes - 1, 15);
  let renta: number | null = null;
  // Recorrido robusto sin asumir orden previo.
  const ordenadas = [...actualizaciones].sort(
    (a, b) => new Date(a.fecha_efectiva).getTime() - new Date(b.fecha_efectiva).getTime(),
  );
  for (const t of ordenadas) {
    if (new Date(t.fecha_efectiva) <= target) {
      renta = Number(t.importe_nuevo);
    }
  }
  if (renta != null) return renta;
  // Periodo anterior a la 1ª actualización registrada:
  // 1) Si el primer tramo guarda `importe_anterior`, esa es la renta
  //    legalmente exigible antes de la actualización → la usamos.
  // 2) Si no, fallback a la renta cacheada (asunción de backfill: el
  //    contrato no ha cambiado de renta nunca antes).
  const primerTramo = ordenadas[0];
  if (primerTramo && primerTramo.importe_anterior != null) {
    return Number(primerTramo.importe_anterior);
  }
  return fallback;
}

// ─── Proration calculation ─────────────────────────────────────────

export interface ImporteEsperado {
  /** Amount expected for this period */
  importe: number;
  /** Days the tenant occupied during this month */
  diasOcupados: number;
  /** Total days in the month */
  diasMes: number;
  /** true if the expected amount differs from full monthly rent */
  esProrrata: boolean;
  /** Full monthly rent for reference */
  rentaMensual: number;
}

/**
 * Calculate the expected payment for a specific month, considering proration
 * when the contract/tenancy starts or ends within that month.
 *
 * Rules:
 * - Contract starts AFTER the month → importe = 0
 * - Contract ends BEFORE the month → importe = 0
 * - Contract starts within the month → prorate from fecha_inicio to end of month
 * - Contract ends within the month → prorate from start of month to fecha_fin
 * - Both within same month → prorate between both dates
 * - Otherwise → full monthly rent
 */
export function calcularImporteEsperado(
  rentaMensual: number,
  mes: number,        // 1-12
  anio: number,
  fechaInicio: string | Date | null | undefined,
  fechaFin: string | Date | null | undefined,
  actualizaciones?: RentaTramo[] | null,
  /**
   * [H2.9] Si se indica, los meses anteriores a esta fecha se consideran
   * fuera del alcance de control de CapitalRent y devuelven importe=0
   * (no generan deuda).
   */
  fechaInicioControl?: string | Date | null,
): ImporteEsperado {
  // Si se proporcionan tramos, la renta efectiva del mes es la del tramo
  // vigente en ese periodo (no la renta actual aplicada retroactivamente).
  const rentaPeriodo = actualizaciones && actualizaciones.length > 0
    ? (getRentaEnPeriodo(actualizaciones, mes, anio, rentaMensual) ?? rentaMensual)
    : rentaMensual;

  const diasMes = new Date(anio, mes, 0).getDate(); // days in month
  const primerDia = new Date(anio, mes - 1, 1);
  const ultimoDia = new Date(anio, mes - 1, diasMes);

  // [H2.9] Periodo anterior al inicio de control → fuera del alcance.
  if (fechaInicioControl) {
    const ctrl = fechaInicioControl instanceof Date
      ? fechaInicioControl
      : new Date(fechaInicioControl);
    if (!isNaN(ctrl.getTime())) {
      const ctrlYM = ctrl.getFullYear() * 12 + ctrl.getMonth();
      const targetYM = anio * 12 + (mes - 1);
      if (targetYM < ctrlYM) {
        return { importe: 0, diasOcupados: 0, diasMes, esProrrata: false, rentaMensual: rentaPeriodo };
      }
    }
  }

  const inicio = fechaInicio ? new Date(fechaInicio) : null;
  const fin = fechaFin ? new Date(fechaFin) : null;

  // Normalize to date-only comparison (strip time)
  const inicioDate = inicio ? new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()) : null;
  const finDate = fin ? new Date(fin.getFullYear(), fin.getMonth(), fin.getDate()) : null;

  // Contract starts after this month ends → 0
  if (inicioDate && inicioDate > ultimoDia) {
    return { importe: 0, diasOcupados: 0, diasMes, esProrrata: true, rentaMensual: rentaPeriodo };
  }

  // Contract ends before this month starts → 0
  if (finDate && finDate < primerDia) {
    return { importe: 0, diasOcupados: 0, diasMes, esProrrata: true, rentaMensual: rentaPeriodo };
  }

  // Calculate occupied day range
  const diaDesde = (inicioDate && inicioDate > primerDia) ? inicioDate.getDate() : 1;
  const diaHasta = (finDate && finDate < ultimoDia) ? finDate.getDate() : diasMes;

  const diasOcupados = Math.max(0, diaHasta - diaDesde + 1);
  const esProrrata = diasOcupados < diasMes;
  const importe = esProrrata
    ? Math.round((rentaPeriodo * diasOcupados / diasMes) * 100) / 100
    : rentaPeriodo;

  return { importe, diasOcupados, diasMes, esProrrata, rentaMensual: rentaPeriodo };
}

/**
 * Resolve contract/tenant dates for proration.
 * Source of truth: active contract > inquilino legacy fields.
 */
export function resolveFechasContrato(
  propertyId: string | null | undefined,
  inquilinos: Inquilino[],
  contratos: Contrato[],
): { fechaInicio: string | null; fechaFin: string | null } {
  if (!propertyId) return { fechaInicio: null, fechaFin: null };

  const activeContrato = contratos.find(
    c => c.property_id === propertyId && !c.archivado && c.estado !== "finalizado"
  );

  if (activeContrato) {
    return {
      fechaInicio: activeContrato.fecha_inicio || null,
      fechaFin: activeContrato.fecha_fin || null,
    };
  }

  // Fallback to inquilino
  const inq = inquilinos.find(
    i => i.property_id === propertyId && i.rol_inquilino !== "avalista"
  );

  return {
    fechaInicio: inq?.fecha_entrada || null,
    fechaFin: inq?.fecha_salida || null,
  };
}

/**
 * Determine real debt/excess for a payment, using proration-aware expected amount.
 */
export function calcularDeudaReal(
  importeEsperado: number,
  importeCobrado: number,
): { deuda: number; exceso: number; estado: "pagado" | "parcial" | "exceso" } {
  if (importeCobrado >= importeEsperado) {
    const exceso = Math.round((importeCobrado - importeEsperado) * 100) / 100;
    return { deuda: 0, exceso, estado: exceso > 0.01 ? "exceso" : "pagado" };
  }
  return {
    deuda: Math.round((importeEsperado - importeCobrado) * 100) / 100,
    exceso: 0,
    estado: "parcial",
  };
}

// ─── H2.7 — tipo_registro–aware semantics ──────────────────────────
//
// El estado mensual del calendario y del detalle de renta debe
// distinguir entre:
//   - pago_real (cobrado de verdad, afecta finanzas actuales)
//   - historico_reconstruido / regularizado (cobertura histórica,
//     NUNCA cuenta como cobro real ni reduce la deuda real)
//
// Un mes que sólo tiene cobertura histórica suficiente debe verse
// como "Histórico" (ámbar), nunca como "Pagado" verde ni como
// "Parcial"/"Impago".

interface PagoLike {
  tipo_registro?: string | null;
  afecta_finanzas_actuales?: boolean | null;
}

/** Pago real que cuenta en finanzas actuales (mismo filtro que finanzasEngine). */
export function isPagoRealEffective(p: PagoLike): boolean {
  if (p.afecta_finanzas_actuales === false) return false;
  const tipo = p.tipo_registro ?? "pago_real";
  return tipo === "pago_real";
}

/** Pago histórico reconstruido o regularizado (no cuenta como cobro real). */
export function isPagoHistorico(p: PagoLike): boolean {
  const tipo = p.tipo_registro ?? "pago_real";
  return tipo === "historico_reconstruido" || tipo === "regularizado";
}

export type EstadoMesRenta =
  | "pagado"
  | "exceso"
  | "parcial"
  | "historico"
  | "pendiente";

export interface EstadoMesResult {
  estado: EstadoMesRenta;
  /** Deuda calculada SOLO contra cobradoReal. */
  deudaReal: number;
  exceso: number;
  /** true cuando el estado "historico" cubre íntegramente la renta esperada. */
  cubiertoPorHistorico: boolean;
  /** true cuando hay simultáneamente cobro real e histórico para el mismo mes. */
  inconsistente: boolean;
}

export type EstadoMesCalendario = Exclude<EstadoMesRenta, "exceso"> | "notificado" | "impago" | "no_gestionado";

export interface EstadoMesCalendarioResult {
  status: EstadoMesCalendario | undefined;
  deuda: number;
  exceso: number;
  cubiertoPorHistorico: boolean;
  inconsistente: boolean;
  fueraDeControl: boolean;
  mostrarImpago: boolean;
  mostrarPendiente: boolean;
  actionsEnabled: boolean;
}

/**
 * Calcula el estado de un mes a partir de los importes ya separados.
 * NO mezcla histórico con real: la deuda se mide solo contra cobradoReal.
 */
export function calcularEstadoMes(
  rentaEsperada: number | null,
  cobradoReal: number,
  cobradoHistorico: number,
  flags: { hasReal: boolean; hasHistorico: boolean },
  /**
   * Compensación no monetaria del mes (ej. gasto pagado directamente por el
   * inquilino que cubre parte de la renta). NO suma a tesorería/caja, pero sí
   * cubre renta a efectos de deuda. Default: 0.
   */
  compensado: number = 0,
): EstadoMesResult {
  const inconsistente = flags.hasReal && flags.hasHistorico;

  if (rentaEsperada == null || rentaEsperada <= 0) {
    const estado: EstadoMesRenta = flags.hasReal
      ? "pagado"
      : flags.hasHistorico
        ? "historico"
        : "pendiente";
    return {
      estado,
      deudaReal: 0,
      exceso: 0,
      cubiertoPorHistorico: flags.hasHistorico && !flags.hasReal,
      inconsistente,
    };
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Cobertura efectiva = dinero real + compensación.
  // La caja/tesorería sigue siendo `cobradoReal`; la deuda se reduce con la
  // compensación porque la renta queda cubierta a efectos prácticos.
  const compensadoSafe = Math.max(0, compensado || 0);
  const cubiertoEfectivo = cobradoReal + compensadoSafe;
  const deudaReal = Math.max(0, round2(rentaEsperada - cubiertoEfectivo));
  const excesoReal = Math.max(0, round2(cubiertoEfectivo - rentaEsperada));

  if (cubiertoEfectivo >= rentaEsperada - 0.01) {
    return {
      estado: excesoReal > 0.01 ? "exceso" : "pagado",
      deudaReal: 0,
      exceso: excesoReal,
      cubiertoPorHistorico: false,
      inconsistente,
    };
  }

  if (cubiertoEfectivo > 0.01) {
    return {
      estado: "parcial",
      deudaReal,
      exceso: 0,
      cubiertoPorHistorico: false,
      inconsistente,
    };
  }

  // Sin cobro real → puede estar cubierto íntegramente por histórico.
  if (flags.hasHistorico && cobradoHistorico >= rentaEsperada - 0.01) {
    return {
      estado: "historico",
      deudaReal: 0,
      exceso: 0,
      cubiertoPorHistorico: true,
      inconsistente,
    };
  }

  return {
    estado: "pendiente",
    deudaReal,
    exceso: 0,
    cubiertoPorHistorico: false,
    inconsistente,
  };
}

/**
 * Estado visual específico del calendario de rentas.
 *
 * Regla H2.9: si el mes cae antes de `fecha_inicio_control`, el calendario
 * debe tratarlo como "no gestionado": sin rojo, sin deuda, sin pendiente,
 * sin acciones de cobro y sin usar la fecha legal del contrato como fecha
 * económica efectiva.
 */
export function calcularEstadoMesCalendario(params: {
  contrato: Pick<Contrato, "fecha_inicio_control" | "fecha_inicio" | "created_at"> | null | undefined;
  mes: number;
  anio: number;
  rentaEsperada: number | null;
  cobradoReal: number;
  cobradoHistorico: number;
  hasReal: boolean;
  hasHistorico: boolean;
  hasNotificado?: boolean;
  /** Compensación no monetaria del mes (cubre renta sin entrar en caja). */
  compensado?: number;
  today?: Date;
}): EstadoMesCalendarioResult {
  const {
    contrato,
    mes,
    anio,
    rentaEsperada,
    cobradoReal,
    cobradoHistorico,
    hasReal,
    hasHistorico,
    hasNotificado = false,
    compensado = 0,
    today = new Date(),
  } = params;

  if (!isPeriodoBajoControl(contrato, mes, anio)) {
    return {
      status: "no_gestionado",
      deuda: 0,
      exceso: 0,
      cubiertoPorHistorico: false,
      inconsistente: false,
      fueraDeControl: true,
      mostrarImpago: false,
      mostrarPendiente: false,
      actionsEnabled: false,
    };
  }

  const currentYM = today.getFullYear() * 12 + today.getMonth();
  const targetYM = anio * 12 + (mes - 1);

  const hasCompensado = (compensado || 0) > 0.01;

  if (hasReal || hasHistorico || hasCompensado) {
    const calc = calcularEstadoMes(rentaEsperada, cobradoReal, cobradoHistorico, {
      hasReal: hasReal || hasCompensado,
      hasHistorico,
    }, compensado);

    let status: EstadoMesCalendario | undefined;
    switch (calc.estado) {
      case "pagado":
      case "exceso":
        status = "pagado";
        break;
      case "parcial":
        status = "parcial";
        break;
      case "historico":
        status = "historico";
        break;
      case "pendiente":
        status = targetYM < currentYM ? "impago" : targetYM === currentYM ? "pendiente" : undefined;
        break;
    }

    return {
      status,
      deuda: calc.deudaReal,
      exceso: calc.exceso,
      cubiertoPorHistorico: calc.cubiertoPorHistorico,
      inconsistente: calc.inconsistente,
      fueraDeControl: false,
      mostrarImpago: status === "impago",
      mostrarPendiente: status === "pendiente",
      actionsEnabled: status !== undefined,
    };
  }

  if (hasNotificado) {
    return {
      status: "notificado",
      deuda: 0,
      exceso: 0,
      cubiertoPorHistorico: false,
      inconsistente: false,
      fueraDeControl: false,
      mostrarImpago: false,
      mostrarPendiente: false,
      actionsEnabled: true,
    };
  }

  const status: EstadoMesCalendario | undefined =
    targetYM < currentYM ? "impago" : targetYM === currentYM ? "pendiente" : undefined;

  return {
    status,
    deuda: rentaEsperada ?? 0,
    exceso: 0,
    cubiertoPorHistorico: false,
    inconsistente: false,
    fueraDeControl: false,
    mostrarImpago: status === "impago",
    mostrarPendiente: status === "pendiente",
    actionsEnabled: status !== undefined,
  };
}
