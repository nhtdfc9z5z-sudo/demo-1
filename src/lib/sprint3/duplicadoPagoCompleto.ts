/**
 * Sprint 3 — Fase D: detección de pago único por contrato/mes en
 * modalidad `completo`.
 *
 * Capa PURA. Dada la selección actual del formulario "He cobrado"
 * (property + inquilino + mes/año), resuelve:
 *   1. Qué contrato cubre ese mes para esa pareja property+inquilino.
 *   2. La modalidad del contrato (`completo` por defecto, `habitaciones`
 *      si así está configurado en BD).
 *   3. Si en `pagos_renta` ya existe un `pago_real` para ese
 *      (contrato_id, mes, año) — incluyendo el fallback legacy
 *      (property_id + inquilino_id + mes + año) cuando el pago aún no
 *      tiene `contrato_id` por backfill pendiente.
 *
 * Esta función NO toca la base de datos ni decide qué se muestra: sólo
 * clasifica. La UI decide si bloquear, ofrecer edición del existente o
 * permitir registrar un pago parcial complementario.
 *
 * Reglas:
 *  - `modalidad = "habitaciones"` ⇒ múltiples pagos permitidos: status
 *    `permitido`.
 *  - `modalidad = "completo"` + ya existe `pago_real` ⇒ status
 *    `duplicado_completo`. Devuelve `pagoExistente` para que la UI
 *    pueda enlazar a editar.
 *  - 0 contratos cubriendo el mes ⇒ `sin_contrato` (no bloquea, la UI
 *    decide si avisar; sirve para casos legacy sin contrato).
 *  - >1 contratos cubriendo el mes ⇒ `ambiguo` (no bloquea: dejamos
 *    pasar para no obstruir, pero la UI puede avisar).
 */

export type ModalidadAlquiler = "completo" | "habitaciones";

export interface DuplicadoContratoLike {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  archivado?: boolean | null;
  modalidad_alquiler?: string | null;
}

export interface DuplicadoPagoLike {
  id: string;
  property_id: string | null;
  inquilino_id: string | null;
  mes: number;
  anio: number;
  contrato_id?: string | null;
  importe_pagado?: number | null;
  tipo_registro?: string | null;
  afecta_finanzas_actuales?: boolean | null;
}

export type DuplicadoStatus =
  | "permitido"
  | "sin_contrato"
  | "ambiguo"
  | "duplicado_completo";

export interface DuplicadoResult {
  status: DuplicadoStatus;
  modalidad: ModalidadAlquiler | null;
  contrato: DuplicadoContratoLike | null;
  pagoExistente: DuplicadoPagoLike | null;
  motivo?: string;
}

function firstDay(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}
function lastDay(anio: number, mes: number): string {
  const d = new Date(Date.UTC(anio, mes, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function cubreMes(c: DuplicadoContratoLike, anio: number, mes: number): boolean {
  if (c.archivado) return false;
  if (!c.fecha_inicio) return false;
  const lo = firstDay(anio, mes);
  const hi = lastDay(anio, mes);
  if (c.fecha_inicio > hi) return false;
  if (c.fecha_fin && c.fecha_fin < lo) return false;
  return true;
}

export function normalizeModalidad(raw?: string | null): ModalidadAlquiler {
  if (raw === "habitaciones") return "habitaciones";
  return "completo";
}

export interface DetectarParams {
  propertyId: string;
  inquilinoId: string;
  mes: number;
  anio: number;
  contratos: DuplicadoContratoLike[];
  pagos: DuplicadoPagoLike[];
  /**
   * Personas extra por contrato (inquilinos solidarios). Mismo formato
   * que `PersonasPorContrato` del backfill. Opcional: si no se pasa,
   * sólo se considera titular `contrato.inquilino_id`.
   */
  personasPorContrato?: Record<string, string[]>;
}

/**
 * Considera "pago real" cualquier registro con `tipo_registro = 'pago_real'`
 * o, para compatibilidad legacy (registros previos a Sprint 2 sin tipo
 * explícito), con `afecta_finanzas_actuales = true` e importe > 0.
 * Históricos/regularizados/pendientes NO bloquean (no son ingresos reales).
 */
function esPagoReal(p: DuplicadoPagoLike): boolean {
  if (p.tipo_registro === "pago_real") return true;
  if (!p.tipo_registro && (p.afecta_finanzas_actuales ?? false) && Number(p.importe_pagado ?? 0) > 0) {
    return true;
  }
  return false;
}

export function detectarConflictoPagoCompleto(params: DetectarParams): DuplicadoResult {
  const { propertyId, inquilinoId, mes, anio, contratos, pagos } = params;
  const personas = params.personasPorContrato || {};

  const candidatos = contratos.filter((c) => {
    if (c.property_id !== propertyId) return false;
    if (!cubreMes(c, anio, mes)) return false;
    if (c.inquilino_id === inquilinoId) return true;
    const extras = personas[c.id] || [];
    return extras.includes(inquilinoId);
  });

  if (candidatos.length === 0) {
    return {
      status: "sin_contrato",
      modalidad: null,
      contrato: null,
      pagoExistente: null,
      motivo: "no hay contrato vigente que cubra este mes para esta pareja",
    };
  }

  if (candidatos.length > 1) {
    return {
      status: "ambiguo",
      modalidad: null,
      contrato: null,
      pagoExistente: null,
      motivo: `${candidatos.length} contratos cubren ${mes}/${anio}`,
    };
  }

  const contrato = candidatos[0];
  const modalidad = normalizeModalidad(contrato.modalidad_alquiler);

  if (modalidad === "habitaciones") {
    return { status: "permitido", modalidad, contrato, pagoExistente: null };
  }

  // modalidad completo → buscar pago_real existente.
  // Prioridad 1: match por contrato_id.
  // Prioridad 2 (legacy/backfill pendiente): match por property+inquilino+mes+año
  //   sólo cuando `contrato_id` sea null (no podemos atribuirlo a otro contrato).
  const matchPorContrato = pagos.find(
    (p) =>
      p.contrato_id === contrato.id &&
      p.mes === mes &&
      p.anio === anio &&
      esPagoReal(p),
  );
  if (matchPorContrato) {
    return { status: "duplicado_completo", modalidad, contrato, pagoExistente: matchPorContrato };
  }

  // Match legacy: pagos del mismo propietario+inquilino+periodo aún sin
  // contrato_id. También bloquea para evitar duplicar mientras se hace
  // el backfill.
  const matchLegacy = pagos.find(
    (p) =>
      (p.contrato_id == null) &&
      p.property_id === propertyId &&
      p.inquilino_id === inquilinoId &&
      p.mes === mes &&
      p.anio === anio &&
      esPagoReal(p),
  );
  if (matchLegacy) {
    return { status: "duplicado_completo", modalidad, contrato, pagoExistente: matchLegacy };
  }

  return { status: "permitido", modalidad, contrato, pagoExistente: null };
}