import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { captureAppError } from "@/lib/observability";
import { resolverContratoIdParaPago } from "@/lib/altas/resolverContratoParaPago";

/**
 * Sprint 3.7 — clave canónica para upserts en pagos_renta.
 * Reemplaza al legacy (property_id, inquilino_id, mes, anio).
 */
const ON_CONFLICT_CONTRATO = "contrato_id,mes,anio" as const;

async function ensureContratoId(
  contratoId: string | null | undefined,
  propertyId: string,
  inquilinoId: string,
  mes: number,
  anio: number,
): Promise<string> {
  if (contratoId) return contratoId;
  const resolved = await resolverContratoIdParaPago({
    propertyId, inquilinoId, mes, anio,
  });
  if (!resolved) {
    throw new Error(
      `No se pudo resolver el contrato vigente para el pago (mes=${mes}, anio=${anio}). ` +
      "Crea el contrato del activo o vincula al inquilino antes de registrar el pago.",
    );
  }
  return resolved;
}

/** Resultado por mes al ejecutar `registrarHistorico`. */
export type RegistrarHistoricoResultStatus =
  | "creado"           // no existía: insertado
  | "actualizado"      // existía como histórico/pendiente: sobreescrito controladamente
  | "omitido_pago_real" // existe un pago_real → NUNCA sobrescribir
  | "omitido_por_decision" // el usuario eligió una estrategia que omite este mes
  | "error";

export interface RegistrarHistoricoResult {
  mes: number;
  anio: number;
  status: RegistrarHistoricoResultStatus;
  existingTipo?: string | null;
  message?: string;
}

export interface RegistrarHistoricoBatchSummary {
  creados: RegistrarHistoricoResult[];
  actualizados: RegistrarHistoricoResult[];
  omitidos: RegistrarHistoricoResult[]; // por colisión con pago_real
  omitidos_por_decision: RegistrarHistoricoResult[]; // skip por estrategia elegida
  errores: RegistrarHistoricoResult[];
}

/**
 * Estrategia anti-duplicidad para la reconstrucción histórica.
 * - `omitir_pagos_reales` (default): crea nuevos y actualiza
 *    históricos/regularizados/pendientes existentes. Nunca toca pago_real.
 * - `solo_reemplazar_existentes`: actualiza únicamente meses que ya tenían
 *    histórico/regularizado/pendiente. No crea meses nuevos. Nunca toca pago_real.
 * - `solo_nuevos`: crea únicamente meses sin registro previo. Omite todo lo
 *    que ya existiera (incluido pago_real, histórico, regularizado y pendiente).
 */
export type EstrategiaReconstruccion =
  | "omitir_pagos_reales"
  | "solo_reemplazar_existentes"
  | "solo_nuevos";

export interface ConflictoHistoricoBuckets {
  sin_registro: Array<{ mes: number; anio: number }>;
  historico_reconstruido: Array<{ mes: number; anio: number; id?: string }>;
  regularizado: Array<{ mes: number; anio: number; id?: string }>;
  pendiente: Array<{ mes: number; anio: number; id?: string }>;
  pago_real: Array<{ mes: number; anio: number; id?: string }>;
}

const monthFirstDay = (mes: number, anio: number) =>
  `${anio}-${String(mes).padStart(2, "0")}-01`;

export interface PagoRenta {
  id: string;
  property_id: string;
  inquilino_id: string;
  mes: number;
  anio: number;
  inquilino_notificado: boolean;
  inquilino_notificado_at: string | null;
  propietario_confirmado: boolean;
  propietario_confirmado_at: string | null;
  importe_pagado: number | null;
  tipo_pago: string | null;
  notas_acuerdo: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  tipo_registro?: "pago_real" | "historico_reconstruido" | "regularizado" | "pendiente" | null;
  origen?: "alta_guiada" | "reconstruccion_historica" | "registro_manual" | "importacion" | "banco" | "otro" | null;
  fecha_devengo?: string | null;
  fecha_pago_real?: string | null;
  afecta_finanzas_actuales?: boolean | null;
  afecta_fiscalidad?: boolean | null;
  /**
   * Sprint 3 (Fase A/C): contrato del que procede el pago.
   * Nullable durante el backfill auditado. Cuando esté presente, el motor
   * financiero y fiscal agrupa por (contrato_id, mes, año) en lugar de
   * caer al fallback heurístico Fase 4 por (property_id, mes, año).
   */
  contrato_id?: string | null;
}

export function usePagosRenta(options?: {
  inquilinoId?: string | null;
  propertyId?: string | null;
  userId?: string | null;
  asOwner?: boolean;
}) {
  const queryClient = useQueryClient();

  const queryKey = ["pagos_renta", options?.inquilinoId, options?.propertyId, options?.userId, options?.asOwner];

  const { data: pagos = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.from("pagos_renta").select("*");
      if (options?.inquilinoId) query = query.eq("inquilino_id", options.inquilinoId);
      if (options?.propertyId) query = query.eq("property_id", options.propertyId);
      if (options?.asOwner && options?.userId) query = query.eq("user_id", options.userId);
      const { data, error } = await query.order("anio", { ascending: false }).order("mes", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PagoRenta[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    invalidateFiscalChain(queryClient);
  };

  const notificarPago = async (
    inquilinoId: string, propertyId: string, mes: number, anio: number, ownerId: string,
    datos?: { importe_pagado?: number; tipo_pago?: string; notas_acuerdo?: string; contrato_id?: string | null }
  ) => {
    const contratoId = await ensureContratoId(datos?.contrato_id, propertyId, inquilinoId, mes, anio);
    const payload = {
      inquilino_notificado: true,
      inquilino_notificado_at: new Date().toISOString(),
      ...(datos?.importe_pagado != null ? { importe_pagado: datos.importe_pagado } : {}),
      ...(datos?.tipo_pago ? { tipo_pago: datos.tipo_pago } : {}),
      ...(datos?.notas_acuerdo ? { notas_acuerdo: datos.notas_acuerdo } : {}),
    };
    const { error } = await supabase.from("pagos_renta").upsert({
      property_id: propertyId, inquilino_id: inquilinoId, mes, anio, user_id: ownerId,
      contrato_id: contratoId,
      // Garantizamos fecha_devengo también en pagos reales para que fiscalidad
      // pueda imputar por devengo de forma consistente.
      fecha_devengo: monthFirstDay(mes, anio),
      ...payload,
    } as any, { onConflict: ON_CONFLICT_CONTRATO });
    if (error) {
      void captureAppError({
        event: "pagos_renta.notificar", message: "Fallo al notificar pago",
        severity: "error", audit: true, error,
        context: { mes, anio },
      });
    }
    invalidate();
  };

  const confirmarPago = async (
    propertyId: string, inquilinoId: string, mes: number, anio: number,
    datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string; contrato_id?: string | null }, ownerId: string
  ) => {
    const contratoId = await ensureContratoId(datos.contrato_id, propertyId, inquilinoId, mes, anio);
    const { error } = await supabase.from("pagos_renta").upsert({
      property_id: propertyId, inquilino_id: inquilinoId, mes, anio,
      contrato_id: contratoId,
      propietario_confirmado: true, propietario_confirmado_at: new Date().toISOString(),
      importe_pagado: datos.importe_pagado, tipo_pago: datos.tipo_pago, notas_acuerdo: datos.notas_acuerdo || null,
      user_id: ownerId,
      // Devengo siempre presente en pagos reales (clave para fiscalidad).
      fecha_devengo: monthFirstDay(mes, anio),
      fecha_pago_real: new Date().toISOString().slice(0, 10),
    } as any, { onConflict: ON_CONFLICT_CONTRATO });
    if (error) {
      void captureAppError({
        event: "pagos_renta.confirmar", message: "Fallo al confirmar pago real",
        severity: "critical", audit: true, error,
        context: { mes, anio },
      });
    }
    invalidate();
  };

  const updatePago = async (pagoId: string, datos: {
    importe_pagado?: number; tipo_pago?: string; notas_acuerdo?: string | null; propietario_confirmado?: boolean;
  }) => {
    const { error } = await supabase.from("pagos_renta").update(datos as any).eq("id", pagoId);
    if (error) {
      void captureAppError({
        event: "pagos_renta.update", message: "Fallo al actualizar pago",
        severity: "error", audit: true, error,
        context: { pago_id: pagoId },
      });
    }
    invalidate();
  };

  const deletePago = async (pagoId: string) => {
    const { error } = await supabase.from("pagos_renta").delete().eq("id", pagoId);
    if (error) {
      void captureAppError({
        event: "pagos_renta.delete", message: "Fallo al borrar pago",
        severity: "error", audit: true, error,
        context: { pago_id: pagoId },
      });
    }
    invalidate();
  };

  const getPagoForMonth = (mes: number, anio: number, inquilinoId?: string): PagoRenta | undefined => {
    return pagos.find(p => p.mes === mes && p.anio === anio && (!inquilinoId || p.inquilino_id === inquilinoId));
  };

  /**
   * Reconstruye un pago histórico: NO cuenta como ingreso actual ni fiscal por defecto.
   * Marca el mes como ya regularizado en el pasado.
   *
   * REGLA DE INTEGRIDAD: si ya existe un `pago_real` para ese mes, NUNCA se sobrescribe.
   * Se devuelve `{ status: "omitido_pago_real" }` y el caller decidirá cómo avisar.
   */
  const registrarHistorico = async (
    propertyId: string, inquilinoId: string, mes: number, anio: number, ownerId: string,
    datos: {
      importe_pagado: number;
      tipo_registro?: "historico_reconstruido" | "regularizado" | "pendiente";
      origen?: "alta_guiada" | "reconstruccion_historica" | "registro_manual" | "importacion";
      afecta_fiscalidad?: boolean;
      fecha_pago_real?: string | null;
      notas_acuerdo?: string;
      /** H2.5 — enlazar pago al contrato concreto (Sprint 3 Fase C). */
      contrato_id?: string | null;
    },
    estrategia: EstrategiaReconstruccion = "omitir_pagos_reales",
  ): Promise<RegistrarHistoricoResult> => {
    const tipo = datos.tipo_registro || "historico_reconstruido";
    const isPendiente = tipo === "pendiente";

    // Sprint 3.7: resolver/validar contrato antes de lectura/escritura.
    let contratoIdResuelto: string;
    try {
      contratoIdResuelto = await ensureContratoId(datos.contrato_id, propertyId, inquilinoId, mes, anio);
    } catch (e: any) {
      return { mes, anio, status: "error", message: e?.message || "Sin contrato vigente" };
    }

    // 1) Lectura previa: protegemos cualquier pago_real existente.
    const { data: existing, error: readErr } = await supabase
      .from("pagos_renta")
      .select("id, tipo_registro")
      .eq("contrato_id", contratoIdResuelto)
      .eq("mes", mes)
      .eq("anio", anio)
      .maybeSingle();

    if (readErr) {
      return { mes, anio, status: "error", message: readErr.message };
    }

    const existingTipo = (existing as any)?.tipo_registro ?? null;
    if (existing && existingTipo === "pago_real") {
      // NUNCA sobrescribir un pago_real con un histórico.
      return { mes, anio, status: "omitido_pago_real", existingTipo };
    }

    // Aplica la estrategia anti-duplicidad elegida por el usuario.
    if (estrategia === "solo_nuevos" && existing) {
      return { mes, anio, status: "omitido_por_decision", existingTipo };
    }
    if (estrategia === "solo_reemplazar_existentes" && !existing) {
      return { mes, anio, status: "omitido_por_decision", existingTipo };
    }

    const { error: writeErr } = await supabase.from("pagos_renta").upsert({
      property_id: propertyId, inquilino_id: inquilinoId, mes, anio, user_id: ownerId,
      importe_pagado: isPendiente ? 0 : datos.importe_pagado,
      tipo_pago: isPendiente ? "pendiente" : "historico",
      // Marcas legacy (para que la UI de "Historial de pagos" muestre el estado correcto)
      propietario_confirmado: !isPendiente,
      propietario_confirmado_at: isPendiente ? null : new Date().toISOString(),
      inquilino_notificado: false,
      // Nuevos metadatos
      tipo_registro: tipo,
      origen: datos.origen || "reconstruccion_historica",
      fecha_devengo: monthFirstDay(mes, anio),
      fecha_pago_real: datos.fecha_pago_real ?? null,
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: datos.afecta_fiscalidad ?? false,
      notas_acuerdo: datos.notas_acuerdo || null,
      contrato_id: contratoIdResuelto,
    } as any, { onConflict: ON_CONFLICT_CONTRATO });

    if (writeErr) return { mes, anio, status: "error", message: writeErr.message };
    invalidate();
    return {
      mes,
      anio,
      status: existing ? "actualizado" : "creado",
      existingTipo,
    };
  };

  /**
   * Versión batch: ejecuta `registrarHistorico` mes a mes y agrupa el resultado.
   * El caller puede mostrar un toast resumen con creados/actualizados/omitidos.
   */
  const registrarHistoricoBatch = async (
    propertyId: string, inquilinoId: string, ownerId: string,
    meses: Array<{
      mes: number; anio: number; importe_pagado: number;
      tipo_registro?: "historico_reconstruido" | "regularizado" | "pendiente";
      origen?: "alta_guiada" | "reconstruccion_historica" | "registro_manual" | "importacion";
      afecta_fiscalidad?: boolean;
      notas_acuerdo?: string;
      contrato_id?: string | null;
    }>,
    estrategia: EstrategiaReconstruccion = "omitir_pagos_reales",
    /** H2.5 — contrato_id por defecto aplicado a todos los meses del batch. */
    defaultContratoId?: string | null,
  ): Promise<RegistrarHistoricoBatchSummary> => {
    const summary: RegistrarHistoricoBatchSummary = {
      creados: [], actualizados: [], omitidos: [], omitidos_por_decision: [], errores: [],
    };
    for (const m of meses) {
      const r = await registrarHistorico(propertyId, inquilinoId, m.mes, m.anio, ownerId, {
        importe_pagado: m.importe_pagado,
        tipo_registro: m.tipo_registro,
        origen: m.origen,
        afecta_fiscalidad: m.afecta_fiscalidad,
        notas_acuerdo: m.notas_acuerdo,
        contrato_id: m.contrato_id ?? defaultContratoId ?? null,
      }, estrategia);
      if (r.status === "creado") summary.creados.push(r);
      else if (r.status === "actualizado") summary.actualizados.push(r);
      else if (r.status === "omitido_pago_real") summary.omitidos.push(r);
      else if (r.status === "omitido_por_decision") summary.omitidos_por_decision.push(r);
      else summary.errores.push(r);
    }
    return summary;
  };

  /**
   * Pre-chequeo: clasifica un set de meses en función de qué exista ya en `pagos_renta`.
   * Permite mostrar al usuario el banner anti-duplicidad ANTES de ejecutar nada.
   */
  const detectarConflictosHistorico = async (
    propertyId: string,
    inquilinoId: string,
    meses: Array<{ mes: number; anio: number }>,
    /** Sprint 3.7: si se pasa, la detección consulta por contrato canónico. */
    contratoId?: string | null,
  ): Promise<ConflictoHistoricoBuckets> => {
    const buckets: ConflictoHistoricoBuckets = {
      sin_registro: [], historico_reconstruido: [], regularizado: [], pendiente: [], pago_real: [],
    };
    for (const m of meses) {
      const cid = contratoId
        ?? (await resolverContratoIdParaPago({ propertyId, inquilinoId, mes: m.mes, anio: m.anio }));
      let q = supabase.from("pagos_renta").select("id, tipo_registro").eq("mes", m.mes).eq("anio", m.anio);
      if (cid) {
        q = q.eq("contrato_id", cid);
      } else {
        // Fallback legacy si no hay contrato resoluble (caso 1 huérfano auditado).
        q = q.eq("property_id", propertyId).eq("inquilino_id", inquilinoId);
      }
      const { data } = await q.maybeSingle();
      const tipo = (data as any)?.tipo_registro;
      if (!data) {
        buckets.sin_registro.push({ mes: m.mes, anio: m.anio });
      } else if (tipo === "pago_real") {
        buckets.pago_real.push({ mes: m.mes, anio: m.anio, id: (data as any).id });
      } else if (tipo === "regularizado") {
        buckets.regularizado.push({ mes: m.mes, anio: m.anio, id: (data as any).id });
      } else if (tipo === "pendiente") {
        buckets.pendiente.push({ mes: m.mes, anio: m.anio, id: (data as any).id });
      } else {
        // historico_reconstruido o legacy sin tipo_registro
        buckets.historico_reconstruido.push({ mes: m.mes, anio: m.anio, id: (data as any).id });
      }
    }
    return buckets;
  };

  /**
   * Convierte un pago histórico (pendiente / reconstruido) en cobro real actual.
   * Activa afecta_finanzas_actuales y, opcionalmente, fiscalidad.
   * Exige `importe_pagado > 0` para evitar registrar ingresos vacíos.
   */
  const marcarComoPagoReal = async (
    pagoId: string,
    datos: { importe_pagado: number; tipo_pago: string; fecha_pago_real?: string; afecta_fiscalidad?: boolean }
  ) => {
    if (!datos.importe_pagado || datos.importe_pagado <= 0) {
      throw new Error("El importe del cobro debe ser mayor que 0.");
    }
    await supabase.from("pagos_renta").update({
      tipo_registro: "pago_real",
      origen: "registro_manual",
      propietario_confirmado: true,
      propietario_confirmado_at: new Date().toISOString(),
      importe_pagado: datos.importe_pagado,
      tipo_pago: datos.tipo_pago,
      fecha_pago_real: datos.fecha_pago_real || new Date().toISOString().slice(0, 10),
      afecta_finanzas_actuales: true,
      afecta_fiscalidad: datos.afecta_fiscalidad ?? true,
    } as any).eq("id", pagoId);
    invalidate();
  };

  /**
   * Activa/desactiva el flag de fiscalidad de un pago histórico/regularizado.
   * No permite tocar pagos reales por esta vía (debe hacerse en flujo dedicado).
   */
  const setAfectaFiscalidad = async (pagoId: string, value: boolean) => {
    const { data: existing, error: readErr } = await supabase
      .from("pagos_renta").select("tipo_registro").eq("id", pagoId).maybeSingle();
    if (readErr) throw readErr;
    if ((existing as any)?.tipo_registro === "pago_real") {
      throw new Error("No se puede modificar la fiscalidad de un pago real desde aquí.");
    }
    await supabase.from("pagos_renta")
      .update({ afecta_fiscalidad: value } as any)
      .eq("id", pagoId);
    invalidate();
  };

  /**
   * Convierte un registro histórico/regularizado en pendiente de cobro.
   * NO afecta pagos reales (protegidos).
   */
  const convertirEnPendiente = async (pagoId: string) => {
    const { data: existing, error: readErr } = await supabase
      .from("pagos_renta").select("tipo_registro").eq("id", pagoId).maybeSingle();
    if (readErr) throw readErr;
    if ((existing as any)?.tipo_registro === "pago_real") {
      throw new Error("No se puede convertir un pago real en pendiente.");
    }
    await supabase.from("pagos_renta").update({
      tipo_registro: "pendiente",
      tipo_pago: "pendiente",
      importe_pagado: 0,
      fecha_pago_real: null,
      propietario_confirmado: false,
      propietario_confirmado_at: null,
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: false,
    } as any).eq("id", pagoId);
    invalidate();
  };

  /**
   * Marca un pendiente como regularizado (no reclamable / cerrado).
   * No afecta finanzas ni fiscalidad.
   */
  const marcarRegularizado = async (pagoId: string, notas?: string) => {
    const { data: existing, error: readErr } = await supabase
      .from("pagos_renta").select("tipo_registro").eq("id", pagoId).maybeSingle();
    if (readErr) throw readErr;
    if ((existing as any)?.tipo_registro === "pago_real") {
      throw new Error("No se puede regularizar un pago real.");
    }
    await supabase.from("pagos_renta").update({
      tipo_registro: "regularizado",
      tipo_pago: "historico",
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: false,
      ...(notas ? { notas_acuerdo: notas } : {}),
    } as any).eq("id", pagoId);
    invalidate();
  };

  // ─── Sprint 3.9 — Saneamiento de datos legacy (manual, confirmado) ───
  /**
   * Asigna un `contrato_id` a un pago legacy que llegó sin él.
   * Sólo lo invoca la UI de auditoría tras confirmación del usuario.
   */
  const asignarContratoAPago = async (pagoId: string, contratoId: string) => {
    const { error } = await supabase
      .from("pagos_renta")
      .update({ contrato_id: contratoId } as any)
      .eq("id", pagoId);
    if (error) {
      void captureAppError({
        event: "pagos_renta.saneamiento.asignar_contrato",
        message: "Fallo al asignar contrato a pago legacy",
        severity: "error", audit: true, error,
        context: { pago_id: pagoId },
      });
      throw error;
    }
    void captureAppError({
      event: "pagos_renta.saneamiento.asignar_contrato",
      message: "Pago legacy asignado a contrato",
      severity: "info", audit: true,
      context: { pago_id: pagoId, contrato_id: contratoId },
    });
    invalidate();
  };

  /**
   * Marca un pago como histórico/no financiero (no afecta tesorería ni fiscalidad).
   * Útil para sanear pagos legacy ambiguos sin perder el rastro.
   */
  const marcarPagoComoHistorico = async (pagoId: string) => {
    const { error } = await supabase
      .from("pagos_renta")
      .update({
        tipo_registro: "historico_reconstruido",
        tipo_pago: "historico",
        afecta_finanzas_actuales: false,
        afecta_fiscalidad: false,
      } as any)
      .eq("id", pagoId);
    if (error) {
      void captureAppError({
        event: "pagos_renta.saneamiento.marcar_historico",
        message: "Fallo al marcar pago como histórico",
        severity: "error", audit: true, error,
        context: { pago_id: pagoId },
      });
      throw error;
    }
    void captureAppError({
      event: "pagos_renta.saneamiento.marcar_historico",
      message: "Pago marcado como histórico/no financiero",
      severity: "info", audit: true,
      context: { pago_id: pagoId },
    });
    invalidate();
  };

  /**
   * Fusiona pagos duplicados: conserva uno y elimina el resto, sumando
   * sus importes confirmados sobre el conservado. La UI debe pedir
   * confirmación explícita antes de invocarla.
   */
  const fusionarPagos = async (
    pagoIdConservar: string,
    pagoIdsAEliminar: string[],
  ) => {
    if (!pagoIdConservar) throw new Error("Indica el pago a conservar.");
    if (!Array.isArray(pagoIdsAEliminar) || pagoIdsAEliminar.length === 0) {
      throw new Error("Indica al menos un pago a eliminar.");
    }
    if (pagoIdsAEliminar.includes(pagoIdConservar)) {
      throw new Error("El pago a conservar no puede estar en la lista de eliminados.");
    }
    const todosIds = [pagoIdConservar, ...pagoIdsAEliminar];
    const { data: filas, error: readErr } = await supabase
      .from("pagos_renta").select("id, importe_pagado").in("id", todosIds);
    if (readErr) throw readErr;
    const total = (filas || []).reduce(
      (s, r: any) => s + Number(r.importe_pagado || 0), 0,
    );
    const { error: updErr } = await supabase
      .from("pagos_renta")
      .update({ importe_pagado: total } as any)
      .eq("id", pagoIdConservar);
    if (updErr) {
      void captureAppError({
        event: "pagos_renta.saneamiento.fusionar",
        message: "Fallo al fusionar (update conservado)",
        severity: "error", audit: true, error: updErr,
        context: { pago_id: pagoIdConservar },
      });
      throw updErr;
    }
    const { error: delErr } = await supabase
      .from("pagos_renta").delete().in("id", pagoIdsAEliminar);
    if (delErr) {
      void captureAppError({
        event: "pagos_renta.saneamiento.fusionar",
        message: "Fallo al fusionar (delete duplicados)",
        severity: "critical", audit: true, error: delErr,
        context: { conservado: pagoIdConservar, eliminados: pagoIdsAEliminar.length },
      });
      throw delErr;
    }
    void captureAppError({
      event: "pagos_renta.saneamiento.fusionar",
      message: "Pagos duplicados fusionados",
      severity: "info", audit: true,
      context: { conservado: pagoIdConservar, eliminados: pagoIdsAEliminar.length },
    });
    invalidate();
  };

  /**
   * Borra un pago legacy. Sólo la UI de auditoría debe llamar a esta función,
   * y siempre tras confirmación del usuario. Audita la acción.
   */
  const eliminarPagoLegacy = async (pagoId: string) => {
    const { error } = await supabase.from("pagos_renta").delete().eq("id", pagoId);
    if (error) {
      void captureAppError({
        event: "pagos_renta.saneamiento.eliminar",
        message: "Fallo al eliminar pago legacy",
        severity: "error", audit: true, error,
        context: { pago_id: pagoId },
      });
      throw error;
    }
    void captureAppError({
      event: "pagos_renta.saneamiento.eliminar",
      message: "Pago legacy eliminado por el usuario",
      severity: "info", audit: true,
      context: { pago_id: pagoId },
    });
    invalidate();
  };

  return {
    pagos, loading, fetchPagos: invalidate,
    notificarPago, confirmarPago, updatePago, deletePago, getPagoForMonth,
    registrarHistorico, registrarHistoricoBatch, marcarComoPagoReal,
    detectarConflictosHistorico,
    setAfectaFiscalidad, convertirEnPendiente, marcarRegularizado,
    asignarContratoAPago, marcarPagoComoHistorico, fusionarPagos, eliminarPagoLegacy,
  };
}
