/**
 * contratosVigentes — capa pura para decidir qué contratos están vigentes
 * en un año fiscal y filtrar `contrato_personas` en consecuencia.
 *
 * Regla de vigencia (un contrato está vigente en algún momento de `anio`):
 *   fecha_inicio <= 31/12/anio
 *   AND (fecha_fin IS NULL OR fecha_fin >= 01/01/anio)
 *   AND archivado = false
 *
 * `contrato_personas` se filtra por `contrato_id` (NUNCA sólo por
 * `property_id`) para no mezclar personas de contratos archivados o de
 * años distintos.
 */

import type { PersonaContrato } from "@/lib/contratoRoles";

export interface ContratoVigenciaInput {
  id: string;
  property_id: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  archivado?: boolean | null;
}

export interface PersonaConContrato extends PersonaContrato {
  contrato_id?: string | null;
  property_id?: string | null;
}

export interface PersonasParaAnioResult {
  /** Personas vivas en el año fiscal, agrupadas por property_id. */
  porProperty: Record<string, PersonaContrato[]>;
  /** Inmuebles con más de un contrato vigente solapado en el año. */
  propiedadesConSolapamiento: string[];
  /** Inmuebles que tienen personas en BD pero NINGÚN contrato vigente este año. */
  propiedadesSinContratoVigente: string[];
  /** contrato_ids considerados vigentes en el año. */
  contratosVigentesIds: string[];
}

function isYmd(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}/.test(s);
}

/**
 * Devuelve true si un contrato está vigente en algún momento del año fiscal.
 * Si `fecha_inicio` no existe, no podemos afirmar vigencia → false.
 */
export function contratoVigenteEnAnio(
  c: Pick<ContratoVigenciaInput, "fecha_inicio" | "fecha_fin" | "archivado">,
  anio: number,
): boolean {
  if (c.archivado) return false;
  if (!isYmd(c.fecha_inicio)) return false;
  const inicioAnioFiscal = `${anio}-01-01`;
  const finAnioFiscal = `${anio}-12-31`;
  if (c.fecha_inicio > finAnioFiscal) return false;
  if (isYmd(c.fecha_fin) && c.fecha_fin < inicioAnioFiscal) return false;
  return true;
}

/**
 * Detecta solapamiento entre dos contratos vigentes en el mismo año fiscal.
 * Hay solapamiento si los rangos [inicio, fin?] se intersectan dentro de
 * `[anio-01-01, anio-12-31]`. fin=null → vigente indefinidamente.
 */
function rangosSeSolapan(
  a: ContratoVigenciaInput,
  b: ContratoVigenciaInput,
  anio: number,
): boolean {
  const lo = `${anio}-01-01`;
  const hi = `${anio}-12-31`;
  const aIni = (a.fecha_inicio && a.fecha_inicio > lo) ? a.fecha_inicio : lo;
  const aFin = (isYmd(a.fecha_fin) && a.fecha_fin! < hi) ? a.fecha_fin! : hi;
  const bIni = (b.fecha_inicio && b.fecha_inicio > lo) ? b.fecha_inicio : lo;
  const bFin = (isYmd(b.fecha_fin) && b.fecha_fin! < hi) ? b.fecha_fin! : hi;
  return aIni <= bFin && bIni <= aFin;
}

/**
 * Construye el mapa `contratosPorProperty` que entra en `buildOwnerPack`,
 * filtrando personas a las que pertenecen a un contrato vigente en `anio`.
 */
export function filterPersonasParaAnioFiscal(
  personas: PersonaConContrato[],
  contratos: ContratoVigenciaInput[],
  anio: number,
): PersonasParaAnioResult {
  const vigentes = contratos.filter(c => contratoVigenteEnAnio(c, anio));
  const vigentesById = new Map<string, ContratoVigenciaInput>();
  for (const c of vigentes) vigentesById.set(c.id, c);
  const contratosVigentesIds = Array.from(vigentesById.keys());

  // Agrupar personas por contrato_id; sólo conservar las cuyo contrato es vigente.
  const porProperty: Record<string, PersonaContrato[]> = {};
  const propsConPersonasEnBD = new Set<string>();
  for (const p of personas) {
    if (p.property_id) propsConPersonasEnBD.add(p.property_id);
    if (!p.contrato_id) continue; // ignorar filas huérfanas
    if (!vigentesById.has(p.contrato_id)) continue;
    const pid = p.property_id || vigentesById.get(p.contrato_id)!.property_id;
    if (!pid) continue;
    (porProperty[pid] = porProperty[pid] || []).push(p);
  }

  // Solapamiento: >1 contrato vigente por inmueble cuyos rangos se intersectan.
  const porPropiedad = new Map<string, ContratoVigenciaInput[]>();
  for (const c of vigentes) {
    if (!c.property_id) continue;
    const arr = porPropiedad.get(c.property_id) || [];
    arr.push(c);
    porPropiedad.set(c.property_id, arr);
  }
  const propiedadesConSolapamiento: string[] = [];
  for (const [pid, arr] of porPropiedad) {
    if (arr.length < 2) continue;
    let solapa = false;
    outer: for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (rangosSeSolapan(arr[i], arr[j], anio)) { solapa = true; break outer; }
      }
    }
    if (solapa) propiedadesConSolapamiento.push(pid);
  }

  // Inmuebles con personas en BD pero ningún contrato vigente este año.
  const propsConVigente = new Set(porPropiedad.keys());
  const propiedadesSinContratoVigente = Array.from(propsConPersonasEnBD)
    .filter(pid => !propsConVigente.has(pid));

  return {
    porProperty,
    propiedadesConSolapamiento,
    propiedadesSinContratoVigente,
    contratosVigentesIds,
  };
}