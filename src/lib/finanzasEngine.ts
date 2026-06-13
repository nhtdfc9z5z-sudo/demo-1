/**
 * Centralized financial calculation engine.
 *
 * Single source of truth for:
 *   - Fixed expenses extracted from property cards
 *   - Recurring expense evaluation
 *   - Monthly income/expense computation
 *   - Month-name parsing for fecha_pago fields
 *
 * Consumers: GraficaAnual, TesoreriaGeneralTab, Tesoreria, exportUtils, useFiscalData
 */

import type { Property, InsuranceEntry } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyGasto } from "@/hooks/usePropertyGastos";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import { resolveRentaEsperada, type RentaTramo } from "@/lib/rentaUtils";
import {
  getEstadoMesContrato,
  isContratoActivoEnMes,
} from "@/lib/estadoMesContrato";
import {
  dedupePagosCompleto,
  inferModalidadAlquiler,
  groupPagosPorContrato,
  LEGACY_GROUP_KEY,
  dedupeTelemetry,
  shouldRecordGroup,
  shouldEmitAudit,
} from "@/lib/pagosDedupe";
import { captureAppError } from "@/lib/observability";

// ─── Types ─────────────────────────────────────────────────────────

export interface GastoFijo {
  id: string;
  propertyId: string;
  propertyName: string;
  categoria: string;
  concepto: string;
  importe: number;
  recurrencia: string;
}

export interface MonthData {
  ingresos: number;
  gastos: number;
}

// ─── Spanish month parsing ─────────────────────────────────────────

const SPANISH_MONTHS_MAP: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const FRECUENCIA_MESES: Record<string, number> = {
  mensual: 1, trimestral: 3, semestral: 6, anual: 12,
};

/**
 * Derive how many months separate two consecutive derrama payments,
 * based on `forma_pago_derrama`. Returns 0 for "unico" (one-off) or unset.
 */
export function getDerramaPeriodMonths(prop: Property): number {
  if (!prop.tiene_derrama) return 0;
  const forma = (prop as any).forma_pago_derrama;
  if (forma === "mensual") return 1;
  if (forma === "trimestral") return 3;
  if (forma === "semestral") return 6;
  if (forma === "anual") return 12;
  if (forma === "junto_comunidad") {
    return FRECUENCIA_MESES[(prop as any).cuota_comunidad_frecuencia || "mensual"] || 1;
  }
  if (forma === "unico") return 0;
  return 1; // legacy fallback: assume monthly
}

/**
 * True if the derrama hits this specific month (year, monthIndex 0-11).
 * Honors `derrama_fecha_inicio` as anchor and `fecha_fin_derrama` as cutoff.
 */
export function isDerramaActiveInMonth(prop: Property, yr: number, mo: number): boolean {
  if (!prop.tiene_derrama || !prop.importe_derrama) return false;
  const start = parseDateSafe((prop as any).derrama_fecha_inicio);
  const end = parseDateSafe(prop.fecha_fin_derrama);
  const monthEnd = new Date(yr, mo, 28);
  const monthStart = new Date(yr, mo, 1);
  if (start && monthEnd < new Date(start.getFullYear(), start.getMonth(), 1)) return false;
  if (end && monthStart > end) return false;

  const forma = (prop as any).forma_pago_derrama;
  if (forma === "unico") {
    if (!start) return false;
    return start.getFullYear() === yr && start.getMonth() === mo;
  }
  const period = getDerramaPeriodMonths(prop);
  if (period <= 0) return false;
  if (period === 1) return true;
  const anchor = start ?? new Date(yr, mo, 1);
  const diff = (yr * 12 + mo) - (anchor.getFullYear() * 12 + anchor.getMonth());
  return diff >= 0 && diff % period === 0;
}

/**
 * True if a community fee (cuota_comunidad) hits this specific month.
 * Pattern: pay at month 0 of the year, then every N months.
 */
export function isCuotaComunidadActiveInMonth(prop: Property, mo: number): boolean {
  if (!prop.cuota_comunidad) return false;
  const freq = (prop as any).cuota_comunidad_frecuencia || "mensual";
  const period = FRECUENCIA_MESES[freq] || 1;
  if (period === 1) return true;
  return mo % period === 0;
}

/**
 * Timezone-safe parser for date-only strings (YYYY-MM-DD).
 * `new Date("2024-03-15")` is parsed as UTC, then `.getMonth()` returns the
 * local-time month — which can shift to the previous month in negative-UTC
 * timezones. This parser builds the Date in local time so the month is stable.
 * Falls back to native Date for full timestamps.
 */
export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse month index (0-11) from various fecha_pago formats:
 *   - "3/15" or "03/2024" → month from first segment
 *   - "2024-03-15" → Date parsing
 *   - "marzo" → Spanish month name
 */
export function parseMonthFromFechaPago(fecha: string): number {
  if (fecha.includes("/")) return parseInt(fecha.split("/")[0], 10) - 1;
  if (fecha.includes("-")) {
    const d = parseDateSafe(fecha);
    if (d) return d.getMonth();
  }
  const lower = fecha.trim().toLowerCase();
  if (SPANISH_MONTHS_MAP[lower] !== undefined) return SPANISH_MONTHS_MAP[lower];
  return 0;
}

// ─── Fixed expenses from property card ─────────────────────────────

/**
 * Extract fixed expenses from a single property's card data.
 * Respects "quién paga" toggles stored on the property.
 */
export function getGastosFijosFromProperty(prop: Property): GastoFijo[] {
  const fijos: GastoFijo[] = [];
  const name = prop.nombre_interno;
  const pid = prop.id;

  if (prop.cuota_comunidad) {
    const freq = (prop as any).cuota_comunidad_frecuencia || "mensual";
    const recurrencia = ["mensual", "trimestral", "semestral", "anual"].includes(freq) ? freq : "mensual";
    fijos.push({ id: `${pid}-comunidad`, propertyId: pid, propertyName: name, categoria: "comunidad", concepto: "Cuota de comunidad", importe: Number(prop.cuota_comunidad), recurrencia });
  }
  if (prop.ibi_importe && !(prop as any).ibi_paga_inquilino) {
    fijos.push({ id: `${pid}-ibi`, propertyId: pid, propertyName: name, categoria: "ibi", concepto: "IBI", importe: Number(prop.ibi_importe), recurrencia: "anual" });
  }
  if (prop.basuras_importe && !(prop as any).basuras_paga_inquilino) {
    fijos.push({ id: `${pid}-basuras`, propertyId: pid, propertyName: name, categoria: "basuras", concepto: "Basuras", importe: Number(prop.basuras_importe), recurrencia: "anual" });
  }
  if (prop.tiene_derrama && prop.importe_derrama) {
    const periodMonths = getDerramaPeriodMonths(prop);
    const recurrencia = periodMonths === 3 ? "trimestral"
      : periodMonths === 6 ? "semestral"
      : periodMonths === 12 ? "anual"
      : "mensual";
    fijos.push({ id: `${pid}-derrama`, propertyId: pid, propertyName: name, categoria: "derrama", concepto: "Derrama", importe: Number(prop.importe_derrama), recurrencia });
  }
  const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
  seguros.forEach((seg, idx) => {
    if (seg.importe) {
      if (seg.tipo === "impago" && (prop as any).seguro_impago_paga_inquilino) return;
      fijos.push({
        id: `${pid}-seguro-${idx}`,
        propertyId: pid,
        propertyName: name,
        categoria: seg.tipo === "impago" ? "seguro_impago" : "seguro_vivienda",
        concepto: seg.compania ? `Seguro · ${seg.compania}` : "Seguro",
        importe: Number(seg.importe),
        recurrencia: "anual",
      });
    }
  });
  return fijos;
}

/**
 * Extract fixed expenses across all properties.
 */
export function getAllGastosFijos(properties: Property[]): GastoFijo[] {
  return properties.flatMap(getGastosFijosFromProperty);
}

/**
 * Convierte los gastos fijos del Activo (cualquier recurrencia) a importes
 * ANUALES y formato consumible por `fiscalPack` (`MinimalGastoFijoActivo`).
 *
 * Mantiene la trazabilidad de "quién paga": las toggles
 *   - ibi_paga_inquilino
 *   - basuras_paga_inquilino
 *   - comunidad_paga_inquilino
 *   - seguro_impago_paga_inquilino
 * etc. se evalúan internamente en `getGastosFijosFromProperty`, que ya
 * excluye los gastos cuando los paga íntegramente el inquilino.
 *
 * Estructura preparada para reparto parcial futuro (`cuotaPropietario`).
 */
export function getGastosFijosFiscalesAnuales(properties: Property[]): Array<{
  property_id: string;
  categoria: string;
  concepto: string;
  importeAnual: number;
  pagaInquilino?: boolean;
  cuotaPropietario?: number;
}> {
  const out: Array<{
    property_id: string;
    categoria: string;
    concepto: string;
    importeAnual: number;
    pagaInquilino?: boolean;
    cuotaPropietario?: number;
  }> = [];
  for (const prop of properties) {
    const fijos = getGastosFijosFromProperty(prop);
    for (const g of fijos) {
      const factor = g.recurrencia === "mensual" ? 12
        : g.recurrencia === "trimestral" ? 4
        : g.recurrencia === "semestral" ? 2
        : 1; // anual o único
      out.push({
        property_id: prop.id,
        categoria: g.categoria,
        concepto: g.concepto,
        importeAnual: g.importe * factor,
        pagaInquilino: false,
        cuotaPropietario: 1,
      });
    }
  }
  return out;
}

/**
 * Sum fixed expenses as a monthly equivalent.
 */
export function totalFijosMensual(gastosFijos: GastoFijo[]): number {
  return gastosFijos.reduce((sum, g) => {
    if (g.recurrencia === "mensual") return sum + g.importe;
    if (g.recurrencia === "trimestral") return sum + g.importe / 3;
    if (g.recurrencia === "semestral") return sum + g.importe / 6;
    if (g.recurrencia === "anual") return sum + g.importe / 12;
    return sum;
  }, 0);
}

// ─── Recurring expense evaluation ──────────────────────────────────

const RECURRENCIA_INTERVALO: Record<string, number> = {
  mensual: 1, trimestral: 3, semestral: 6, anual: 12,
};

/**
 * Determine if a recurring (or one-time) manual expense applies to a given month.
 */
export function isGastoActivoEnMes(gasto: PropertyGasto, yr: number, mo: number): boolean {
  const gDate = parseDateSafe(gasto.fecha);
  if (!gDate) return false;

  if (gasto.recurrente && gasto.recurrencia) {
    const gFin = parseDateSafe(gasto.fecha_fin);
    const currentDate = new Date(yr, mo, 1);
    if (currentDate < gDate) return false;
    if (gFin && currentDate > gFin) return false;
    const intervalo = RECURRENCIA_INTERVALO[gasto.recurrencia] || 1;
    const diffMonths = (yr * 12 + mo) - (gDate.getFullYear() * 12 + gDate.getMonth());
    return diffMonths % intervalo === 0;
  }

  return gDate.getFullYear() === yr && gDate.getMonth() === mo;
}

// ─── Monthly data computation ──────────────────────────────────────

/**
 * Compute income and expenses for a single month across a set of properties.
 * This is the canonical calculation used by charts, exports, and summaries.
 */
export function computeMonthData(
  yr: number,
  mo: number,
  filteredProps: Property[],
  inquilinos: Inquilino[],
  pagos: PagoRenta[],
  gastosManuales?: PropertyGasto[],
  contratos?: Contrato[],
  incidencias?: Incidencia[],
  /**
   * H2.5 — Tramos `renta_actualizaciones` indexados por property_id.
   * Cuando se pasan, la renta esperada se resuelve al tramo vigente en el
   * periodo (mes, año) en vez de usar `contrato.renta_mensual` actual para
   * todos los meses (causa de deuda fantasma).
   */
  actualizacionesByProperty?: Map<string, RentaTramo[]>,
): MonthData {
  let ingresos = 0;
  let gastos = 0;

  // ─── Sprint 3.8 — Ingresos por CONTRATO (unidad económica) ─────
  //
  // Reglas:
  //   • Iteramos contratos vigentes en (mes, año) y delegamos en
  //     `getEstadoMesContrato` para obtener `cobradoReal` por contrato.
  //   • Vivienda completa con varios inquilinos solidarios ⇒ 1 contrato ⇒
  //     1 renta (no se duplica).
  //   • Habitaciones ⇒ varios contratos por inmueble ⇒ varias rentas
  //     independientes (se suman).
  //   • Properties sin contrato caen al camino legacy (inquilinos +
  //     dedupe Fase 4) para no romper escenarios sin backfill.
  const propsConContrato = new Set<string>();
  const filteredIds = new Set(filteredProps.map(p => p.id));
  if (contratos) {
    // Agrupar contratos activos del mes por property_id para detectar
    // ambigüedad (varias habitaciones bajo un mismo inmueble).
    const activosByProp = new Map<string, Contrato[]>();
    for (const c of contratos) {
      if (!filteredIds.has(c.property_id)) continue;
      if (!isContratoActivoEnMes(c, mo + 1, yr)) continue;
      const arr = activosByProp.get(c.property_id) ?? [];
      arr.push(c);
      activosByProp.set(c.property_id, arr);
    }
    for (const [pid, contratosActivos] of activosByProp) {
      propsConContrato.add(pid);
      for (const c of contratosActivos) {
        // Reasignar pagos legacy sin `contrato_id` SOLO cuando hay un
        // único contrato activo en el inmueble (no ambiguo). Evita
        // sumar el mismo pago a varias habitaciones.
        const pagosVirtuales = pagos
          .filter(p => {
            if (p.mes !== mo + 1 || p.anio !== yr) return false;
            if (p.contrato_id === c.id) return true;
            return (
              p.contrato_id == null &&
              p.property_id === pid &&
              contratosActivos.length === 1
            );
          })
          .map(p =>
            p.contrato_id ? p : { ...p, contrato_id: c.id },
          );
        const estado = getEstadoMesContrato({
          contrato: c,
          mes: mo + 1,
          anio: yr,
          pagos: pagosVirtuales,
          actualizaciones:
            actualizacionesByProperty?.get(pid) ?? null,
        });
        ingresos += estado.cobradoReal;
      }
    }
  }

  // ─── Gastos y fallback legacy de ingresos: iteración por activo ──
  for (const prop of filteredProps) {
    const propInquilinos = inquilinos.filter(
      i => i.property_id === prop.id && i.rol_inquilino !== "avalista"
    );

    // Check active tenants for this month
    const activeInqs = propInquilinos.filter(inq => {
      const entrada = parseDateSafe(inq.fecha_entrada);
      if (entrada && (yr * 12 + mo) < (entrada.getFullYear() * 12 + entrada.getMonth())) return false;
      const salida = parseDateSafe(inq.fecha_salida);
      if (salida && (yr * 12 + mo) > (salida.getFullYear() * 12 + salida.getMonth())) return false;
      return true;
    });

    if (!propsConContrato.has(prop.id) && activeInqs.length > 0) {
      // Trust either owner-confirmed OR tenant-notified payments (tenant claims first, owner verifies later).
      // Solo cuentan pagos REALES actuales. Históricos reconstruidos, regularizados y pendientes
      // quedan fuera del dashboard/tesorería actuales (afecta_finanzas_actuales === false).
      // Fase 4 defensiva: agrupamos por (property, mes, año) y dedupe por
      // contrato_completo para evitar multiplicar la renta por número de
      // inquilinos solidarios. Ver `src/lib/pagosDedupe.ts`.
      const relevantPagos = pagos.filter(p => {
        if (p.property_id !== prop.id) return false;
        if (p.mes !== mo + 1 || p.anio !== yr) return false;
        if (p.afecta_finanzas_actuales === false) return false;
        const tipo = p.tipo_registro ?? "pago_real";
        if (tipo !== "pago_real") return false;
        if (!(p.propietario_confirmado || p.inquilino_notificado)) return false;
        // Solo pagos de inquilinos activos en el periodo
        return activeInqs.some(inq => inq.id === p.inquilino_id);
      });

      if (relevantPagos.length > 0) {
        const conImporte = relevantPagos.filter(p => p.importe_pagado != null);
        const sinImporte = relevantPagos.filter(p => p.importe_pagado == null);

        const tramosProp = actualizacionesByProperty?.get(prop.id);
        const rentaEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || [], {
          actualizaciones: tramosProp,
          mes: mo + 1,
          anio: yr,
        });
        const propContratos = (contratos || []).filter(c => c.property_id === prop.id);
        const contratoActivo = propContratos.find(
          c => !c.archivado && c.estado !== "finalizado",
        );
        const modalidadFallback = inferModalidadAlquiler(contratoActivo as any);

        if (conImporte.length > 0) {
          // Sprint 3 (Fase C): agrupar por contrato_id cuando esté disponible.
          // Los pagos sin contrato_id caen al fallback Fase 4 (legacy bucket).
          const grupos = groupPagosPorContrato(conImporte);
          for (const [contratoId, grupo] of grupos) {
            const contratoDelGrupo = contratoId === LEGACY_GROUP_KEY
              ? contratoActivo
              : propContratos.find(c => c.id === contratoId) || contratoActivo;
            const modalidad = inferModalidadAlquiler(contratoDelGrupo as any);
            // H2.5 — rentaGrupo debe ser la renta vigente en el periodo
            // (no la renta actual del contrato). `rentaEsperada` ya está
            // resuelta con tramos al mes/año concretos.
            const rentaGrupo = rentaEsperada;
            const dd = dedupePagosCompleto(grupo, rentaGrupo ?? null, modalidad);
            ingresos += dd.ingreso;
            // Fase F — telemetría: registramos cada grupo procesado por el
            // deduper para medir cuánto sigue activándose el fallback Fase 4.
            // H1 (hardening) — throttling por firma para evitar spam por re-renders.
            const bucket = contratoId === LEGACY_GROUP_KEY ? "legacy_fase4" : "por_contrato";
            const sig = `fin|${prop.id}|${contratoId}|${yr}|${mo + 1}|${bucket}`;
            if (shouldRecordGroup(sig)) {
              dedupeTelemetry.recordGroup({
                bucket,
                deduped: dd.pagosDescartados.length > 0 || dd.warnings.length > 0,
                warnings: dd.warnings.length,
              });
            }
            // H1 — sólo auditamos warnings accionables. `duplicado_renta_solidaria`
            // es comportamiento legítimo de pagos solidarios → no genera audit.
            const auditable = dd.warnings.filter(w => w !== "duplicado_renta_solidaria");
            if (auditable.length > 0 && shouldEmitAudit(`fin-audit|${sig}|${auditable.join(",")}`)) {
              void captureAppError({
                event: "pagos_renta_dedupe",
                message: `dedupe pagos (${auditable.join(",")})`,
                severity: "warning",
                audit: true,
                context: {
                  // H1 — sin importes/PII. Sólo IDs y conteos.
                  property_id: prop.id,
                  contrato_id: contratoId === LEGACY_GROUP_KEY ? null : contratoId,
                  mes: mo + 1,
                  anio: yr,
                  modalidad,
                  n_pagos: grupo.length,
                  warnings: auditable,
                  bucket,
                  source: "finanzasEngine.computeMonthData",
                },
              });
            }
          }
        }

        // Pagos confirmados sin importe → asumimos renta esperada UNA vez
        // (no por inquilino) si no se ha contado ya por dedupe.
        if (conImporte.length === 0 && sinImporte.length > 0 && rentaEsperada) {
          ingresos += rentaEsperada;
        }
      }
    }

    // Fixed expenses from property card
    if (isCuotaComunidadActiveInMonth(prop, mo)) {
      gastos += Number(prop.cuota_comunidad);
    }

    if (isDerramaActiveInMonth(prop, yr, mo)) {
      gastos += Number(prop.importe_derrama);
    }

    if (prop.ibi_importe && prop.ibi_fecha_pago && !(prop as any).ibi_paga_inquilino) {
      if (parseMonthFromFechaPago(prop.ibi_fecha_pago) === mo) {
        gastos += Number(prop.ibi_importe);
      }
    }

    if (prop.basuras_importe && prop.basuras_fecha_pago && !(prop as any).basuras_paga_inquilino) {
      if (parseMonthFromFechaPago(prop.basuras_fecha_pago) === mo) {
        gastos += Number(prop.basuras_importe);
      }
    }

    const seguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
    for (const seg of seguros) {
      if (seg.vencimiento && seg.importe) {
        if (seg.tipo === "impago" && (prop as any).seguro_impago_paga_inquilino) continue;
        const vDate = parseDateSafe(seg.vencimiento);
        if (!vDate) continue;
        if (vDate.getMonth() === mo && vDate.getFullYear() === yr) {
          gastos += Number(seg.importe);
        }
      }
    }
  }

  // Manual gastos
  if (gastosManuales) {
    for (const g of gastosManuales) {
      if (isGastoActivoEnMes(g, yr, mo)) {
        gastos += Number(g.importe);
      }
    }
  }

  // Closed incident invoices (factura_total) — read-only integration
  if (incidencias) {
    for (const inc of incidencias) {
      if (inc.estado !== "Cerrada" && inc.estado !== "cerrada") continue;
      const total = Number(inc.factura_total);
      if (!total || total <= 0) continue;
      // Use factura_fecha if available, otherwise fall back to updated_at
      const dateStr = inc.factura_fecha || inc.updated_at;
      if (!dateStr) continue;
      const d = parseDateSafe(dateStr);
      if (!d) continue;
      if (d.getFullYear() === yr && d.getMonth() === mo) {
        // Only count if this incident belongs to one of the filtered properties
        if (inc.property_id && filteredProps.some(p => p.id === inc.property_id)) {
          gastos += total;
        }
      }
    }
  }

  return { ingresos: Math.round(ingresos), gastos: Math.round(gastos) };
}

// ─── Fixed expense monthly total from property card (for charts) ──

/**
 * Get monthly fixed costs for a property in a specific month.
 * Used by exportUtils for per-month breakdown.
 */
export function getMonthlyFixedCosts(prop: Property, month: number): number {
  let total = 0;
  if (isCuotaComunidadActiveInMonth(prop, month)) {
    total += Number(prop.cuota_comunidad);
  }
  if (isDerramaActiveInMonth(prop, new Date().getFullYear(), month)) {
    total += Number(prop.importe_derrama);
  }
  return total;
}

// ─── Fiscalidad helpers (pure) ─────────────────────────────────────

/**
 * Año fiscal de un pago: usa `fecha_devengo` (YYYY-MM-DD) cuando existe,
 * con fallback seguro al campo `anio`. Nunca usa `fecha_registro`/`created_at`.
 */
export function getAnioFiscalPago(p: Pick<PagoRenta, "fecha_devengo" | "anio">): number {
  if (p.fecha_devengo && /^\d{4}-/.test(p.fecha_devengo)) {
    return parseInt(p.fecha_devengo.slice(0, 4), 10);
  }
  return p.anio;
}

/**
 * Predicado fiscal canónico: un pago cuenta en IRPF del `anio` si
 * está confirmado por el propietario, `afecta_fiscalidad !== false`
 * y su año fiscal (por devengo) coincide.
 */
export function pagoCuentaEnFiscalidad(p: PagoRenta, anio: number): boolean {
  if (!p.propietario_confirmado) return false;
  if (p.afecta_fiscalidad === false) return false;
  return getAnioFiscalPago(p) === anio;
}
