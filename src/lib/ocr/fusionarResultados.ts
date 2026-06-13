/**
 * fusionarResultados — función pura para combinar varios análisis OCR
 * (`ContratoAnalysis`) en un único objeto `ContratoAnalysisFusionado`.
 *
 * Reglas (Fase 2+3 alta unificada):
 *   1. Para campos escalares (renta, fianza, fechas, dirección…):
 *      gana el PRIMER archivo que tenga el campo no vacío.
 *      Esto refleja la prioridad del usuario al subir el "PDF principal"
 *      primero y fotos / anexos después.
 *   2. `arrendatarios` se ACUMULA desde todos los archivos.
 *   3. Deduplicación de arrendatarios: por NIF (normalizado a mayúsculas
 *      sin espacios) si existe; en su defecto por nombre normalizado
 *      (lowercase + trim + colapsar espacios).
 *   4. Si un arrendatario duplicado del archivo N aporta datos que el
 *      primero no tenía (email/teléfono), se completan.
 *
 * Esta función NO llama a la red. Es 100% determinista y testable.
 */
import type {
  ContratoAnalysis,
  ContratoArrendatario,
  ContratoAnalysisFusionado,
} from "./types";

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  // En contexto OCR, 0 numérico significa "no detectado" para campos
  // como renta o fianza. Lo tratamos como vacío para que otro archivo
  // pueda aportar el valor real.
  if (typeof v === "number") return Number.isNaN(v) || v === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
};

const keyArrendatario = (a: ContratoArrendatario): string => {
  const nif = (a.nif || "").replace(/\s+/g, "").toUpperCase();
  if (nif) return `nif:${nif}`;
  const nombre = (a.nombre || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `nombre:${nombre}`;
};

const mergeArrendatario = (
  base: ContratoArrendatario,
  next: ContratoArrendatario,
): ContratoArrendatario => ({
  nombre: base.nombre || next.nombre,
  nif: base.nif || next.nif,
  telefono: base.telefono || next.telefono,
  email: base.email || next.email,
});

/**
 * Fusiona varios análisis. El orden importa: el primero gana en campos
 * duplicados. Si no hay análisis válidos, devuelve `null`.
 */
export function fusionarResultados(
  analisis: ContratoAnalysis[],
): ContratoAnalysisFusionado | null {
  const validos = (analisis || []).filter((a) => a && typeof a === "object");
  if (validos.length === 0) return null;

  // 1) Campos escalares: primer no vacío gana.
  const fusion: Record<string, unknown> = {};
  for (const a of validos) {
    for (const [k, v] of Object.entries(a)) {
      if (k === "arrendatarios") continue; // se acumula aparte
      if (isEmpty(v)) continue;
      if (!(k in fusion) || isEmpty(fusion[k])) {
        fusion[k] = v;
      }
    }
  }

  // 2) Arrendatarios: acumular y deduplicar por NIF o nombre.
  const map = new Map<string, ContratoArrendatario>();
  for (const a of validos) {
    const lista: ContratoArrendatario[] = [];
    if (Array.isArray(a.arrendatarios)) lista.push(...a.arrendatarios);
    else if (a.arrendatario_nombre) {
      lista.push({
        nombre: a.arrendatario_nombre,
        nif: a.arrendatario_nif,
        telefono: a.arrendatario_telefono,
        email: a.arrendatario_email,
      });
    }
    for (const arr of lista) {
      if (!arr || !(arr.nombre || arr.nif)) continue;
      const k = keyArrendatario(arr);
      const prev = map.get(k);
      map.set(k, prev ? mergeArrendatario(prev, arr) : { ...arr });
    }
  }
  if (map.size > 0) {
    fusion.arrendatarios = Array.from(map.values());
  }

  return fusion as ContratoAnalysisFusionado;
}