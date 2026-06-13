/**
 * Cálculo de aniversarios de renta (revisión IPC) para un contrato.
 * Puro y determinista: mismo input → mismas fechas.
 *
 * Cada anualidad N tiene su fecha de aniversario = fecha_inicio + N años.
 * El aviso se emite `horizonteDias` antes de esa fecha y se considera vigente
 * mientras la fecha de aniversario sea futura (o hace ≤ 30 días, para no
 * desaparecer en cuanto pasa).
 */

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

function daysBetween(a: Date, b: Date): number {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((B - A) / 86_400_000);
}

export interface AnualidadAviso {
  /** Número de anualidad (1, 2, 3, ...). */
  n: number;
  /** Fecha del aniversario (cuando aplica la revisión). */
  fechaAniversario: string;
  /** Fecha en la que el aviso debería estar visible (aniversario - horizonteDias). */
  fechaAviso: string;
}

export interface CalcularAnualidadesParams {
  fechaInicio: string;
  /** Si hay fecha_fin, no se generan anualidades posteriores. */
  fechaFin?: string | null;
  now?: Date;
  /** Horizonte de pre-aviso, por defecto 90 días. */
  horizonteDias?: number;
  /** Máximo de anualidades a generar (defensa anti-loop). */
  maxAnualidades?: number;
}

/**
 * Devuelve las anualidades que ya están dentro de la ventana de aviso
 * (entre `now` y `aniversario + 30d`). Cada una con su origen_id estable.
 */
export function calcularAnualidadesActivas(
  params: CalcularAnualidadesParams,
): AnualidadAviso[] {
  const ini = parseISO(params.fechaInicio);
  if (!ini) return [];
  const now = params.now ?? new Date();
  const horizonte = params.horizonteDias ?? 90;
  const fin = parseISO(params.fechaFin ?? null);
  const max = params.maxAnualidades ?? 30;

  const out: AnualidadAviso[] = [];
  for (let n = 1; n <= max; n++) {
    const ani = new Date(ini);
    ani.setFullYear(ani.getFullYear() + n);
    if (fin && ani > fin) break;
    const diff = daysBetween(now, ani);
    if (diff > horizonte) break; // aún demasiado lejos
    if (diff < -30) continue; // ya pasó hace mucho, no avisamos
    const aviso = new Date(ani);
    aviso.setDate(aviso.getDate() - horizonte);
    out.push({
      n,
      fechaAniversario: toISO(ani),
      fechaAviso: toISO(aviso),
    });
  }
  return out;
}