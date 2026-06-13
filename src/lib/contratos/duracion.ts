/**
 * Helpers de duración de contratos.
 * Sustituyen el input directo de `fecha_fin` por número + unidad.
 * Mantienen compatibilidad con contratos antiguos: si solo hay `fecha_fin`,
 * `derivarDuracion` la convierte en {n, unidad} aproximada.
 */

export type UnidadDuracion = "anos" | "meses";

export interface Duracion {
  n: number;
  unidad: UnidadDuracion;
}

function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Calcula fecha_fin = fecha_inicio + duración.
 * Devuelve null si fecha o duración no son válidas.
 */
export function calcularFechaFin(
  fechaInicioISO: string,
  n: number,
  unidad: UnidadDuracion,
): string | null {
  const ini = parseISO(fechaInicioISO);
  if (!ini || !Number.isFinite(n) || n <= 0) return null;
  const fin = new Date(ini);
  if (unidad === "anos") fin.setFullYear(fin.getFullYear() + Math.floor(n));
  else fin.setMonth(fin.getMonth() + Math.floor(n));
  // Restamos un día para que el rango sea inclusivo del último día.
  fin.setDate(fin.getDate() - 1);
  return toISO(fin);
}

/**
 * Deriva una duración aproximada a partir de fecha_inicio y fecha_fin.
 * Si el rango es múltiplo entero de 12 meses → años; si no → meses.
 * Devuelve null si las fechas no son válidas o el rango es <= 0.
 */
export function derivarDuracion(
  fechaInicioISO: string | null | undefined,
  fechaFinISO: string | null | undefined,
): Duracion | null {
  if (!fechaInicioISO || !fechaFinISO) return null;
  const ini = parseISO(fechaInicioISO);
  const fin = parseISO(fechaFinISO);
  if (!ini || !fin) return null;
  const meses =
    (fin.getFullYear() - ini.getFullYear()) * 12 +
    (fin.getMonth() - ini.getMonth()) +
    (fin.getDate() >= ini.getDate() ? 0 : -1) +
    1; // +1 porque restamos 1 día al calcular
  if (meses <= 0) return null;
  if (meses % 12 === 0) return { n: meses / 12, unidad: "anos" };
  return { n: meses, unidad: "meses" };
}

export function labelDuracion(d: Duracion): string {
  if (d.unidad === "anos") return `${d.n} año${d.n !== 1 ? "s" : ""}`;
  return `${d.n} mes${d.n !== 1 ? "es" : ""}`;
}