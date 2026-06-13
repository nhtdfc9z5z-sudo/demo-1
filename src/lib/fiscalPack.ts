/**
 * fiscalPack — capa pura para construir el "Pack para gestor" anual.
 *
 * Reglas fiscales (alineadas con `finanzasEngine`):
 *  - Ingresos se imputan por `fecha_devengo` (YYYY-MM-DD) al año fiscal.
 *    `fecha_registro` / `created_at` NUNCA se usan como criterio fiscal.
 *  - Sólo pagos con `afecta_fiscalidad !== false` y `propietario_confirmado` cuentan.
 *  - `tipo_registro = pago_real` siempre cuenta como ingreso real fiscal cuando aplica.
 *  - `historico_reconstruido` / `regularizado` sólo cuentan si el usuario ha
 *    activado `afecta_fiscalidad = true` para ese registro.
 *  - `pendiente` nunca cuenta como ingreso (no hay cobro real).
 */

import type { PagoRenta } from "@/hooks/usePagosRenta";
import { pagoCuentaEnFiscalidad, getAnioFiscalPago } from "@/lib/finanzasEngine";
import {
  dedupePagosCompleto,
  inferModalidadAlquiler,
  dedupeTelemetry,
  shouldRecordGroup,
  shouldEmitAudit,
} from "@/lib/pagosDedupe";
import { captureAppError } from "@/lib/observability";
import {
  resolverShareFiscal,
  criterioInmuebleCompleto,
  getArrendadoresFiscales,
  personaKey,
  validarPorcentajesFiscales,
  type PersonaContrato,
  type CriterioFiscal,
} from "@/lib/contratoRoles";

export interface MinimalProperty {
  id: string;
  nombre_interno: string;
  referencia_catastral?: string | null;
  direccion_completa?: string | null;
  // Titularidad (opcional — si no viene, se asume propietario único "yo")
  titularidad?: "yo" | "copropietarios" | "tercero" | null;
  copropietarios?: Array<{
    nombre?: string | null;
    dni?: string | null;
    porcentaje?: string | number | null;
  }> | null;
  tercero_nombre?: string | null;
  tercero_dni?: string | null;
}

/** Identidad mínima del usuario propietario actual ("yo"). */
export interface MeProfile {
  nombre?: string | null;
  apellidos?: string | null;
  nif?: string | null;
}

/** Titular de un inmueble (puede ser yo, un copropietario o un tercero). */
export interface Titular {
  /** Clave estable: "me" | dni en mayúsculas | "n:<nombre normalizado>" */
  key: string;
  nombre: string;
  dni: string | null;
  /** Porcentaje 0..100 de titularidad sobre el inmueble. */
  porcentaje: number;
  esYo: boolean;
}

const norm = (s: string | null | undefined) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const normDni = (s: string | null | undefined) =>
  (s || "").trim().toUpperCase().replace(/[\s-]/g, "");

/** Clave estable para un titular dado nombre/dni. */
export function titularKey(input: { dni?: string | null; nombre?: string | null; esYo?: boolean }): string {
  if (input.esYo) return "me";
  const d = normDni(input.dni);
  if (d) return d;
  const n = norm(input.nombre);
  return n ? `n:${n}` : "anon";
}

/** Devuelve la lista de titulares de un inmueble con porcentajes normalizados. */
export function getTitulares(property: MinimalProperty, me?: MeProfile | null): Titular[] {
  const tit = property.titularidad || "yo";
  const meNombre = [me?.nombre, me?.apellidos].filter(Boolean).join(" ").trim() || "Yo";
  const meDni = me?.nif ? normDni(me.nif) : null;

  if (tit === "yo") {
    return [{
      key: "me",
      nombre: meNombre,
      dni: meDni,
      porcentaje: 100,
      esYo: true,
    }];
  }

  if (tit === "tercero") {
    return [{
      key: titularKey({ dni: property.tercero_dni, nombre: property.tercero_nombre }),
      nombre: (property.tercero_nombre || "Tercero").trim(),
      dni: property.tercero_dni ? normDni(property.tercero_dni) : null,
      porcentaje: 100,
      esYo: false,
    }];
  }

  // copropietarios
  const raw = Array.isArray(property.copropietarios) ? property.copropietarios : [];
  if (raw.length === 0) {
    // Sin copropietarios definidos: fallback a "yo" 100%.
    return [{ key: "me", nombre: meNombre, dni: meDni, porcentaje: 100, esYo: true }];
  }

  // Parse porcentajes
  const parsed = raw.map(cp => {
    const dni = cp?.dni ? normDni(String(cp.dni)) : null;
    const nombre = (cp?.nombre || "").trim();
    const esYo = !!(meDni && dni && meDni === dni);
    const pctRaw = cp?.porcentaje;
    const pct = typeof pctRaw === "number"
      ? pctRaw
      : parseFloat(String(pctRaw ?? "").replace(",", "."));
    return {
      key: titularKey({ dni, nombre, esYo }),
      nombre: nombre || (esYo ? meNombre : "Copropietario"),
      dni,
      porcentaje: Number.isFinite(pct) ? pct : NaN,
      esYo,
    };
  });

  const hasAny = parsed.some(p => Number.isFinite(p.porcentaje));
  if (!hasAny) {
    // Ningún porcentaje definido: reparto equitativo.
    const each = 100 / parsed.length;
    return parsed.map(p => ({ ...p, porcentaje: each }));
  }
  // Los que no tengan porcentaje quedan en 0 (decisión explícita del usuario).
  return parsed.map(p => ({ ...p, porcentaje: Number.isFinite(p.porcentaje) ? p.porcentaje : 0 }));
}

/** Devuelve el % (0..100) que corresponde a `ownerKey` en `property`. */
export function shareForOwner(
  property: MinimalProperty,
  ownerKey: string | null | undefined,
  me?: MeProfile | null,
): number {
  if (!ownerKey) return 100; // sin filtro = inmueble completo
  const titulares = getTitulares(property, me);
  const t = titulares.find(x => x.key === ownerKey);
  return t ? t.porcentaje : 0;
}

/** Devuelve la lista de titulares únicos del portfolio para poblar el selector UI. */
export function listOwnersInPortfolio(
  properties: MinimalProperty[],
  me?: MeProfile | null,
): Array<{ key: string; nombre: string; dni: string | null; esYo: boolean; numInmuebles: number }> {
  const map = new Map<string, { key: string; nombre: string; dni: string | null; esYo: boolean; numInmuebles: number }>();
  for (const prop of properties) {
    const titulares = getTitulares(prop, me);
    const seenInProp = new Set<string>();
    for (const t of titulares) {
      if (seenInProp.has(t.key)) continue;
      seenInProp.add(t.key);
      const existing = map.get(t.key);
      if (existing) {
        existing.numInmuebles += 1;
      } else {
        map.set(t.key, { key: t.key, nombre: t.nombre, dni: t.dni, esYo: t.esYo, numInmuebles: 1 });
      }
    }
  }
  // Yo primero, después por nombre
  return Array.from(map.values()).sort((a, b) => {
    if (a.esYo && !b.esYo) return -1;
    if (b.esYo && !a.esYo) return 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export interface MinimalGasto {
  id: string;
  property_id: string | null;
  categoria: string;
  concepto: string | null;
  importe: number;
  fecha: string; // YYYY-MM-DD
  /** Fecha de devengo opcional. Si está informada prevalece sobre `fecha` para imputar al ejercicio fiscal. */
  fecha_devengo?: string | null;
}

export interface MinimalFactura {
  id: string;
  property_id: string | null;
  emisor_nombre: string | null;
  total: number | null;
  fecha: string | null;
  categoria: string | null;
  deducible_irpf?: boolean | null;
  /** Fecha de devengo opcional. Si está informada prevalece sobre `fecha` para imputar al ejercicio fiscal. */
  fecha_devengo?: string | null;
}

export interface MonthFiscalRow {
  mes: number; // 1..12
  ingresoDeclarable: number;
  pagoRealFiscal: number;
  historicoFiscal: number;
  /**
   * Sprint 3: histórico fiscal "ambiguo" — coincide en (contrato, mes) con un
   * pago real del mismo periodo y queda pendiente de reconciliación. NO se
   * suma a `ingresoDeclarable`; se expone aparte para que el usuario decida.
   */
  historicoAmbiguoFiscal: number;
  pendiente: boolean;
  regularizado: boolean;
}

export interface DeducibleItem {
  categoria: string;
  concepto: string;
  importe: number;
  origen: "gasto_manual" | "factura" | "gasto_fijo_activo";
}

/**
 * Gasto fijo extraído de la ficha del Activo (IBI, basuras, comunidad, derrama,
 * seguros). Importe ya anualizado. `pagaInquilino` permite excluirlo de la
 * deducibilidad del propietario sin perder trazabilidad para futuros repartos.
 */
export interface MinimalGastoFijoActivo {
  property_id: string;
  categoria: string;
  concepto: string;
  importeAnual: number;
  pagaInquilino?: boolean;
  /** Cuota del importe que paga el propietario (0..1). Por defecto 1 si no
   * lo paga el inquilino; 0 si lo paga el inquilino. Reservado para futuro
   * reparto parcial. */
  cuotaPropietario?: number;
}

export interface PropertyFiscalBreakdown {
  propertyId: string;
  propertyName: string;
  referenciaCatastral?: string | null;
  direccion?: string | null;

  meses: MonthFiscalRow[];
  ingresosDeclarables: number;
  pagosRealesFiscal: number;
  historicosFiscal: number;
  /** Sprint 3: total anual de históricos en cola de reconciliación. */
  historicosAmbiguosFiscal: number;

  mesesSinIngresos: number[];
  mesesPendientes: number[];
  mesesRegularizados: number[];

  gastosDeducibles: DeducibleItem[];
  gastosTotal: number;

  notasRegularizacion: string[];

  /** Porcentaje aplicado a importes (0..100). 100 = inmueble completo. */
  porcentajeAplicado: number;
  /** Nombre del titular si se filtró por propietario; null si modo total. */
  titularNombre: string | null;
  /** Criterio fiscal aplicado para resolver el reparto. */
  criterioAplicado: CriterioFiscal;
  /** True si conviene revisar con asesor (conflicto titular≠arrendador, sin datos, etc.). */
  requiereRevisionFiscal: boolean;
}

/** Categorías canónicas para agrupar en el pack. */
export const CATEGORIA_DEDUCIBLE_LABEL: Record<string, string> = {
  comunidad: "Comunidad",
  derrama: "Derramas",
  seguro_vivienda: "Seguro de hogar",
  seguro_impago: "Seguro de impago",
  ibi: "IBI",
  basuras: "Basuras y tasas",
  suministros: "Suministros",
  reformas: "Reformas",
  mantenimiento: "Mantenimiento",
  arreglos: "Reparaciones",
  prestamo: "Intereses préstamo",
  honorarios: "Honorarios",
  otro: "Otros gastos",
};

/** Devuelve la etiqueta visible de una categoría. Fallback al propio valor. */
export function labelDeducible(cat: string): string {
  return CATEGORIA_DEDUCIBLE_LABEL[cat] || cat;
}

/**
 * Construye el desglose fiscal anual de UN inmueble.
 * Es pura: no toca el cliente Supabase ni el DOM.
 */
export function computePropertyBreakdown(input: {
  property: MinimalProperty;
  pagos: PagoRenta[];
  gastos: MinimalGasto[];
  facturas: MinimalFactura[];
  gastosFijos?: MinimalGastoFijoActivo[];
}, anio: number, opts?: {
  shareFactor?: number;
  titularNombre?: string | null;
  criterioAplicado?: CriterioFiscal;
  requiereRevisionFiscal?: boolean;
  extraNotas?: string[];
}): PropertyFiscalBreakdown {
  const { property, pagos, gastos, facturas, gastosFijos } = input;
  const shareRaw = opts?.shareFactor;
  const share = typeof shareRaw === "number" && Number.isFinite(shareRaw) ? Math.max(0, shareRaw) : 1;
  const pctAplicado = Math.round(share * 1000) / 10; // 0..100 con 1 decimal

  // ─── Ingresos por devengo ─────────────────────────────
  const meses: MonthFiscalRow[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    ingresoDeclarable: 0,
    pagoRealFiscal: 0,
    historicoFiscal: 0,
    historicoAmbiguoFiscal: 0,
    pendiente: false,
    regularizado: false,
  }));

  const propPagos = pagos.filter(p => p.property_id === property.id);

  // Marcas no-fiscales (pendiente/regularizado) — primer pase ligero
  for (const p of propPagos) {
    const anioFiscal = getAnioFiscalPago(p);
    const mesDevengo = p.fecha_devengo && /^\d{4}-\d{2}/.test(p.fecha_devengo)
      ? parseInt(p.fecha_devengo.slice(5, 7), 10)
      : p.mes;
    if (mesDevengo < 1 || mesDevengo > 12) continue;
    if (anioFiscal === anio) {
      if (p.tipo_registro === "pendiente") meses[mesDevengo - 1].pendiente = true;
      if (p.tipo_registro === "regularizado") meses[mesDevengo - 1].regularizado = true;
    }
  }

  // Fase 4 defensiva: agrupar por (mesDevengo, anioFiscal, tipo_registro)
  // y dedupe contra renta esperada. Evita multiplicar la renta por número
  // de inquilinos solidarios cuando hay un pago por inquilino en BD.
  // Renta esperada: usamos cualquier importe pagado dominante por periodo
  // como heurística pasiva (no consultamos contratos aquí para no acoplar);
  // el llamador pasará el contrato a Sprint 3. Hoy: si todos los importes
  // del periodo coinciden, ese es el "tramo" detectado.
  // Sprint 3 (Fase C): bucket por (mesDevengo, contratoKey, tipo).
  // contratoKey = contrato_id || `__prop__` para legacy sin backfill.
  // Cuando un mismo (contratoKey, mesDevengo) tiene tanto `real` como
  // `historico`, el histórico se marca como AMBIGUO y queda fuera del
  // declarable (cola de reconciliación), pero se expone en el row.
  const modalidad = inferModalidadAlquiler(null);
  const PROP_KEY = "__prop__";
  type Key = string; // `${mesDevengo}|${contratoKey}|${tipo}`
  const buckets = new Map<Key, typeof propPagos>();
  for (const p of propPagos) {
    if (!pagoCuentaEnFiscalidad(p, anio)) continue;
    const mesDevengo = p.fecha_devengo && /^\d{4}-\d{2}/.test(p.fecha_devengo)
      ? parseInt(p.fecha_devengo.slice(5, 7), 10)
      : p.mes;
    if (mesDevengo < 1 || mesDevengo > 12) continue;
    const tipo = p.tipo_registro === "pago_real" || !p.tipo_registro ? "real" : "historico";
    const contratoKey = p.contrato_id || PROP_KEY;
    const k = `${mesDevengo}|${contratoKey}|${tipo}`;
    const arr = buckets.get(k) || [];
    arr.push(p);
    buckets.set(k, arr);
  }

  // Pre-cálculo: qué (mesDevengo, contratoKey) tienen pago real con ingreso > 0
  const realConIngreso = new Set<string>();
  for (const [k, arr] of buckets) {
    const [mesStr, contratoKey, tipo] = k.split("|");
    if (tipo !== "real") continue;
    const hayImporte = arr.some(p => Number(p.importe_pagado || 0) > 0);
    if (hayImporte) realConIngreso.add(`${mesStr}|${contratoKey}`);
  }

  for (const [k, arr] of buckets) {
    const [mesStr, contratoKey, tipo] = k.split("|");
    const mesDevengo = parseInt(mesStr, 10);
    // Inferir renta esperada del propio bucket: importe más frecuente
    // (tramo dominante). Si no hay duplicidad evidente, queda null y el
    // deduper devuelve suma directa.
    const importes = arr.map(p => Number(p.importe_pagado || 0)).filter(v => v > 0);
    const freq = new Map<number, number>();
    for (const v of importes) freq.set(v, (freq.get(v) || 0) + 1);
    let rentaInferida: number | null = null;
    for (const [v, c] of freq) {
      if (c >= 2) { rentaInferida = v; break; }
    }
    const dd = dedupePagosCompleto(arr, rentaInferida, modalidad);
    // Fase F + H1 — telemetría con throttling por firma para evitar spam.
    const bucket = contratoKey === PROP_KEY ? "legacy_fase4" : "por_contrato";
    const sigTel = `fp|${property.id}|${contratoKey}|${anio}|${mesDevengo}|${tipo}|${bucket}`;
    if (shouldRecordGroup(sigTel)) {
      dedupeTelemetry.recordGroup({
        bucket,
        deduped: dd.pagosDescartados.length > 0 || dd.warnings.length > 0,
        warnings: dd.warnings.length,
      });
    }
    const importe = dd.ingreso * share;
    const row = meses[mesDevengo - 1];
    const esHistoricoAmbiguo =
      tipo === "historico" && realConIngreso.has(`${mesStr}|${contratoKey}`);
    if (esHistoricoAmbiguo) {
      // Caso PV6: histórico fiscal coincide con pago real → reconciliación.
      row.historicoAmbiguoFiscal += importe;
      const sigAmb = `fp-amb|${property.id}|${contratoKey}|${anio}|${mesDevengo}`;
      if (shouldEmitAudit(sigAmb)) {
        void captureAppError({
          event: "fiscal_historico_ambiguo",
          message: "histórico fiscal coincide con pago real (pendiente reconciliación)",
          severity: "warning",
          audit: true,
          context: {
            // H1 — sin importes/PII.
            property_id: property.id,
            contrato_id: contratoKey === PROP_KEY ? null : contratoKey,
            mes: mesDevengo,
            anio,
            source: "fiscalPack.computePropertyBreakdown",
          },
        });
      }
    } else {
      row.ingresoDeclarable += importe;
      if (tipo === "real") row.pagoRealFiscal += importe;
      else row.historicoFiscal += importe;
    }

    // H1 — sólo auditar warnings accionables (duplicado_renta_solidaria es esperado).
    const auditable = dd.warnings.filter(w => w !== "duplicado_renta_solidaria");
    if (auditable.length > 0) {
      const sigAud = `fp-aud|${sigTel}|${auditable.join(",")}`;
      if (shouldEmitAudit(sigAud)) {
        void captureAppError({
          event: "pagos_renta_dedupe",
          message: `dedupe fiscal (${auditable.join(",")})`,
          severity: "warning",
          audit: true,
          context: {
            // H1 — sin importes/PII.
            property_id: property.id,
            contrato_id: contratoKey === PROP_KEY ? null : contratoKey,
            mes: mesDevengo,
            anio,
            tipo,
            modalidad,
            n_pagos: arr.length,
            warnings: auditable,
            source: "fiscalPack.computePropertyBreakdown",
          },
        });
      }
    }
  }

  const ingresosDeclarables = meses.reduce((s, m) => s + m.ingresoDeclarable, 0);
  const pagosRealesFiscal = meses.reduce((s, m) => s + m.pagoRealFiscal, 0);
  const historicosFiscal = meses.reduce((s, m) => s + m.historicoFiscal, 0);
  const historicosAmbiguosFiscal = meses.reduce((s, m) => s + m.historicoAmbiguoFiscal, 0);

  const mesesPendientes = meses.filter(m => m.pendiente).map(m => m.mes);
  const mesesRegularizados = meses.filter(m => m.regularizado).map(m => m.mes);
  const mesesSinIngresos = meses
    .filter(m => m.ingresoDeclarable === 0 && !m.pendiente && !m.regularizado)
    .map(m => m.mes);

  // ─── Gastos deducibles del año ────────────────────────
  const fechaImputable = (g: { fecha?: string | null; fecha_devengo?: string | null }) =>
    (g.fecha_devengo && /^\d{4}-/.test(g.fecha_devengo) ? g.fecha_devengo : g.fecha) || "";
  const propGastos = gastos.filter(g =>
    g.property_id === property.id && fechaImputable(g).startsWith(`${anio}`));

  const deducibles: DeducibleItem[] = propGastos.map(g => ({
    categoria: g.categoria,
    concepto: g.concepto || labelDeducible(g.categoria),
    importe: Number(g.importe || 0) * share,
    origen: "gasto_manual" as const,
  }));

  const propFacturas = facturas.filter(f =>
    f.property_id === property.id &&
    fechaImputable(f).startsWith(`${anio}`) &&
    f.deducible_irpf !== false);

  for (const f of propFacturas) {
    deducibles.push({
      categoria: f.categoria || "otro",
      concepto: f.emisor_nombre || labelDeducible(f.categoria || "otro"),
      importe: Number(f.total || 0) * share,
      origen: "factura",
    });
  }

  // Gastos fijos del Activo (IBI, comunidad, basuras, derramas, seguros).
  // Sólo deducibles para el propietario en la parte que NO paga el inquilino.
  if (gastosFijos && gastosFijos.length > 0) {
    for (const gf of gastosFijos) {
      if (gf.property_id !== property.id) continue;
      const cuota = typeof gf.cuotaPropietario === "number"
        ? Math.max(0, Math.min(1, gf.cuotaPropietario))
        : (gf.pagaInquilino ? 0 : 1);
      if (cuota <= 0) continue;
      deducibles.push({
        categoria: gf.categoria,
        concepto: gf.concepto,
        importe: Number(gf.importeAnual || 0) * cuota * share,
        origen: "gasto_fijo_activo",
      });
    }
  }

  const gastosTotal = deducibles.reduce((s, d) => s + d.importe, 0);

  // ─── Notas legibles sobre regularizaciones ────────────
  const notas: string[] = [];
  if (share !== 1) {
    notas.push(
      `Importes calculados al ${pctAplicado}% según porcentaje de titularidad${opts?.titularNombre ? ` de ${opts.titularNombre}` : ""}.`
    );
  }
  if (historicosFiscal > 0) {
    notas.push(
      `Se incluyen ${historicosFiscal.toLocaleString("es-ES")} € procedentes de regularizaciones históricas marcadas como fiscales por el propietario.`
    );
  }
  if (mesesPendientes.length > 0) {
    notas.push(
      `Hay ${mesesPendientes.length} mes(es) registrado(s) como pendientes de cobro en ${anio}. No se han incluido como ingreso.`
    );
  }
  if (mesesRegularizados.length > 0) {
    notas.push(
      `Hay ${mesesRegularizados.length} mes(es) regularizado(s) (no reclamables). No cuentan como ingreso.`
    );
  }
  if (mesesSinIngresos.length > 0 && mesesSinIngresos.length < 12) {
    notas.push(
      `${mesesSinIngresos.length} mes(es) sin ingreso registrado. Revisa si falta algún cobro real.`
    );
  }
  for (const n of opts?.extraNotas ?? []) notas.push(n);

  return {
    propertyId: property.id,
    propertyName: property.nombre_interno,
    referenciaCatastral: property.referencia_catastral ?? null,
    direccion: property.direccion_completa ?? null,
    meses,
    ingresosDeclarables,
    pagosRealesFiscal,
    historicosFiscal,
    historicosAmbiguosFiscal,
    mesesSinIngresos,
    mesesPendientes,
    mesesRegularizados,
    gastosDeducibles: deducibles,
    gastosTotal,
    notasRegularizacion: notas,
    porcentajeAplicado: pctAplicado,
    titularNombre: opts?.titularNombre ?? null,
    criterioAplicado: opts?.criterioAplicado ?? "titularidad",
    requiereRevisionFiscal: !!opts?.requiereRevisionFiscal,
  };
}

/**
 * Construye el pack agregando varios inmuebles.
 * `propertyIds` opcional permite filtrar (ej: un inmueble concreto).
 */
export interface OwnerFiscalPack {
  anio: number;
  propiedades: PropertyFiscalBreakdown[];
  totalIngresosDeclarables: number;
  totalGastosDeducibles: number;
  totalNeto: number;
  totalMesesPendientes: number;
  totalMesesRegularizados: number;
  totalMesesSinIngresos: number;
  /** "total_inmueble" si no hay filtro de propietario; "por_propietario" si lo hay. */
  criterioCalculo: "total_inmueble" | "por_propietario";
  /** Clave del propietario filtrado, si aplica. */
  propietarioKey: string | null;
  /** Nombre legible del propietario filtrado, si aplica. */
  propietarioNombre: string | null;
  /** Inmuebles cuyo criterio fiscal conviene revisar con asesor. */
  inmueblesRequierenRevision: string[];
}

export function buildOwnerPack(input: {
  properties: MinimalProperty[];
  pagos: PagoRenta[];
  gastos: MinimalGasto[];
  facturas: MinimalFactura[];
  gastosFijos?: MinimalGastoFijoActivo[];
}, anio: number, propertyIds?: string[], opts?: {
  ownerKey?: string | null;
  me?: MeProfile | null;
  /** Personas contractuales (de cualquier contrato vigente) por property_id. */
  contratosPorProperty?: Record<string, PersonaContrato[]>;
  /** Inmuebles con >1 contrato vigente solapado en el año fiscal.
   *  Se marcan como `requiereRevisionFiscal` y añaden nota. */
  propiedadesConSolapamiento?: string[];
  /** Inmuebles con personas contractuales en BD pero sin contrato vigente
   *  este año fiscal (fallback a titularidad). Añade nota informativa. */
  propiedadesSinContratoVigente?: string[];
}): OwnerFiscalPack {
  const filtered = propertyIds && propertyIds.length > 0
    ? input.properties.filter(p => propertyIds.includes(p.id))
    : input.properties;

  const ownerKey = opts?.ownerKey ?? null;
  const me = opts?.me ?? null;
  const contratosMap = opts?.contratosPorProperty ?? {};
  const solapados = new Set(opts?.propiedadesConSolapamiento ?? []);
  const sinVigente = new Set(opts?.propiedadesSinContratoVigente ?? []);

  // Resolver nombre del propietario filtrado: primero buscamos en arrendadores
  // fiscales del contrato; si no aparece, caemos a titulares del inmueble.
  let propietarioNombre: string | null = null;
  if (ownerKey) {
    outer: for (const prop of filtered) {
      const personas = contratosMap[prop.id];
      if (personas) {
        for (const a of getArrendadoresFiscales(personas)) {
          if (personaKey(a) === ownerKey) { propietarioNombre = (a.nombre || "").trim() || null; break outer; }
        }
      }
    }
  }
  if (ownerKey && !propietarioNombre) {
    for (const prop of filtered) {
      const t = getTitulares(prop, me).find(x => x.key === ownerKey);
      if (t) { propietarioNombre = t.nombre; break; }
    }
  }

  const propiedades = filtered
    .map(property => {
      const personas = contratosMap[property.id];
      const validacion = validarPorcentajesFiscales(personas);
      const porcentajesInvalidos =
        validacion.status === "incompleto" || validacion.status === "excedido";
      if (ownerKey) {
        const r = resolverShareFiscal(property, personas, ownerKey, me);
        return {
          property,
          share: r.shareFactor,
          criterio: r.criterio,
          revision: r.requiereRevisionFiscal || porcentajesInvalidos,
          notas: [
            ...r.notas,
            ...(validacion.mensaje ? [validacion.mensaje] : []),
          ],
        };
      }
      // Sin filtro de propietario: cálculo a 100% pero anotamos qué criterio HABRÍA aplicado.
      return {
        property,
        share: 1,
        criterio: criterioInmuebleCompleto(personas),
        revision: porcentajesInvalidos,
        notas: validacion.mensaje ? [validacion.mensaje] : [],
      };
    })
    // Si filtramos por propietario, mostramos también los inmuebles donde el
    // titular no figura como arrendador fiscal (share=0) para que el aviso sea visible.
    .filter(({ share, revision }) => !ownerKey || share > 0 || revision)
    .map(({ property, share, criterio, revision, notas }) => computePropertyBreakdown({
      property,
      pagos: input.pagos,
      gastos: input.gastos,
      facturas: input.facturas,
      gastosFijos: input.gastosFijos,
    }, anio, {
      shareFactor: share,
      titularNombre: propietarioNombre,
      criterioAplicado: criterio,
      requiereRevisionFiscal: revision || solapados.has(property.id),
      extraNotas: [
        ...notas,
        ...(solapados.has(property.id) ? [
          `Hay más de un contrato vigente solapado en ${anio} para este inmueble. Revisa el reparto fiscal con tu asesor.`
        ] : []),
        ...(sinVigente.has(property.id) ? [
          `No hay contrato vigente en ${anio}. Se aplica reparto por titularidad como fallback.`
        ] : []),
      ],
    }));

  const totalIngresosDeclarables = propiedades.reduce((s, p) => s + p.ingresosDeclarables, 0);
  const totalGastosDeducibles = propiedades.reduce((s, p) => s + p.gastosTotal, 0);

  return {
    anio,
    propiedades,
    totalIngresosDeclarables,
    totalGastosDeducibles,
    totalNeto: totalIngresosDeclarables - totalGastosDeducibles,
    totalMesesPendientes: propiedades.reduce((s, p) => s + p.mesesPendientes.length, 0),
    totalMesesRegularizados: propiedades.reduce((s, p) => s + p.mesesRegularizados.length, 0),
    totalMesesSinIngresos: propiedades.reduce((s, p) => s + p.mesesSinIngresos.length, 0),
    criterioCalculo: ownerKey ? "por_propietario" : "total_inmueble",
    propietarioKey: ownerKey,
    propietarioNombre,
    inmueblesRequierenRevision: propiedades.filter(p => p.requiereRevisionFiscal).map(p => p.propertyId),
  };
}