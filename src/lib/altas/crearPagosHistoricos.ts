/**
 * Reconstrucción de pagos históricos al dar de alta un contrato.
 *
 * Cuando el propietario indica que el contrato está al día y quiere
 * registrar los cobros anteriores (Opción A o B del wizard de alta),
 * generamos un `pagos_renta` por cada mes vencido entre `fecha_inicio`
 * del contrato y `fecha_fin_control` (típicamente hoy), aplicando el
 * importe del tramo de renta vigente en cada mes.
 *
 * REGLAS:
 *   - Único punto de inserción para pagos de tipo `historico_reconstruido`
 *     desde el motor de altas. UI/componentes nunca insertan directos.
 *   - Idempotente: comprueba pagos ya existentes para el mismo
 *     `contrato_id + mes + anio` y se apoya además en el índice único
 *     `pagos_renta_contrato_periodo_unique`.
 *   - Marca cada pago como `propietario_confirmado=true` para que la
 *     reconstrucción no genere deuda artificial.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TramoRentaHistorico {
  /** Fecha (YYYY-MM-DD) desde la que aplica este importe. */
  fecha_desde: string;
  /** Importe €/mes vigente a partir de `fecha_desde`. */
  importe: number;
}

export interface CrearPagosHistoricosInput {
  property_id: string;
  inquilino_id: string;
  contrato_id: string;
  user_id: string;
  /** Fecha de inicio del contrato (YYYY-MM-DD). */
  fecha_inicio: string;
  /** Fecha hasta la que reconstruimos (YYYY-MM-DD, normalmente hoy). */
  fecha_fin_control: string;
  /** Tramos de renta. Al menos uno; se ordenan por fecha_desde. */
  tramos: TramoRentaHistorico[];
  /**
   * Meses que NO deben generar pago histórico — quedarán como deuda real.
   * Útil cuando el propietario indica que algunos meses anteriores siguen
   * pendientes de cobro. La normalización interna usa la clave YYYY-MM.
   */
  mesesExcluidos?: Array<{ mes: number; anio: number }>;
}

export interface CrearPagosHistoricosResult {
  insertados: number;
  /** Meses que ya tenían pago previo y se han respetado (no duplicados). */
  omitidos: number;
  /** Meses no creados porque el usuario los marcó como impagados. */
  excluidos: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Dado un año y un número de meses N, devuelve los últimos N meses del año
 * incluyendo diciembre. Para N=5 en 2021 devuelve ago..dic; para N=1, [dic].
 * Saturación: cantidad <1 → []; cantidad >12 → año completo.
 */
export function mesesImpagadosPorCantidad(
  anio: number,
  cantidad: number,
): Array<{ mes: number; anio: number }> {
  const n = Math.max(0, Math.min(12, Math.floor(cantidad)));
  if (n === 0) return [];
  const inicio = 13 - n; // N=1 → 12 (dic); N=5 → 8 (ago); N=12 → 1 (ene)
  return Array.from({ length: n }, (_, i) => ({ mes: inicio + i, anio }));
}

/** Itera meses ambos extremos inclusive desde (anio,mes) inicial al final. */
function* iterarMeses(
  desde: string,
  hasta: string,
): Generator<{ anio: number; mes: number; fechaDevengo: string }> {
  const [yd, md] = desde.split("-").map(Number);
  const [yh, mh] = hasta.split("-").map(Number);
  if (!yd || !md || !yh || !mh) return;
  let y = yd;
  let m = md;
  while (y < yh || (y === yh && m <= mh)) {
    yield { anio: y, mes: m, fechaDevengo: `${y}-${pad2(m)}-01` };
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

/**
 * Devuelve el importe del tramo vigente para el primer día del mes (anio, mes).
 * Tramos se ordenan por fecha_desde; el vigente es el último cuya fecha_desde
 * sea anterior o igual al primer día del mes.
 */
export function importeTramoVigente(
  tramos: TramoRentaHistorico[],
  anio: number,
  mes: number,
): number | null {
  const objetivo = `${anio}-${pad2(mes)}-01`;
  const ordenados = [...tramos]
    .filter((t) => t.fecha_desde && t.importe > 0)
    .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
  let vigente: TramoRentaHistorico | null = null;
  for (const t of ordenados) {
    if (t.fecha_desde <= objetivo) vigente = t;
  }
  return vigente ? vigente.importe : null;
}

export async function crearPagosHistoricos(
  input: CrearPagosHistoricosInput,
): Promise<CrearPagosHistoricosResult> {
  const {
    property_id,
    inquilino_id,
    contrato_id,
    user_id,
    fecha_inicio,
    fecha_fin_control,
    tramos,
  } = input;

  if (!property_id || !inquilino_id || !contrato_id || !user_id) {
    throw new Error("crearPagosHistoricos: faltan ids obligatorios.");
  }
  if (!fecha_inicio || !fecha_fin_control) {
    throw new Error("crearPagosHistoricos: fechas obligatorias.");
  }
  if (fecha_inicio > fecha_fin_control) {
    return { insertados: 0, omitidos: 0, excluidos: 0 };
  }
  const tramosValidos = (tramos || []).filter(
    (t) => t && t.fecha_desde && Number(t.importe) > 0,
  );
  if (tramosValidos.length === 0) {
    throw new Error("crearPagosHistoricos: necesitas al menos un tramo de renta válido.");
  }

  // Normalización de meses excluidos (impagados reales) a claves YYYY-MM.
  const excludedKeys = new Set(
    (input.mesesExcluidos || []).map(
      ({ mes, anio }) => `${anio}-${pad2(mes)}`,
    ),
  );

  // 1) Idempotencia: consulta pagos existentes para este contrato.
  const { data: existentes, error: qErr } = await supabase
    .from("pagos_renta")
    .select("mes, anio")
    .eq("contrato_id", contrato_id);
  if (qErr) throw qErr;
  const yaExisten = new Set(
    (existentes || []).map((p: any) => `${p.anio}-${p.mes}`),
  );

  const filas: Array<Record<string, unknown>> = [];
  let omitidos = 0;
  let excluidos = 0;
  const ahora = new Date().toISOString();
  for (const { anio, mes, fechaDevengo } of iterarMeses(fecha_inicio, fecha_fin_control)) {
    if (excludedKeys.has(`${anio}-${pad2(mes)}`)) {
      excluidos += 1;
      continue;
    }
    if (yaExisten.has(`${anio}-${mes}`)) {
      omitidos += 1;
      continue;
    }
    const importe = importeTramoVigente(tramosValidos, anio, mes);
    if (importe == null || importe <= 0) continue;
    filas.push({
      user_id,
      property_id,
      inquilino_id,
      contrato_id,
      mes,
      anio,
      fecha_devengo: fechaDevengo,
      importe_pagado: importe,
      propietario_confirmado: true,
      propietario_confirmado_at: ahora,
      tipo_registro: "historico_reconstruido",
      origen: "alta_guiada_historico",
    });
  }

  if (filas.length === 0) return { insertados: 0, omitidos, excluidos };

  // 2) Insert con ignoreDuplicates como segunda capa de seguridad
  //    contra carreras (el índice único parcial sobre contrato_id+mes+anio
  //    cubre el caso, pero también el legacy (property_id, inquilino_id, mes, anio)).
  const { data, error } = await supabase
    .from("pagos_renta")
    .upsert(filas as never, {
      onConflict: "contrato_id,mes,anio",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;
  return { insertados: data?.length ?? 0, omitidos, excluidos };
}