/**
 * formatDireccion — Single source of truth for composing a human-readable
 * address string from structured fields.
 *
 * Used across the app for display, exports, contracts, OCR matching, etc.
 * The output is what gets stored in `direccion_completa` (non-editable).
 */

export interface DireccionEstructurada {
  tipo_via?: string | null;
  nombre_via?: string | null;
  numero?: string | null;
  portal?: string | null;
  escalera?: string | null;
  bloque?: string | null;
  planta?: string | null;
  puerta?: string | null;
  urbanizacion?: string | null;
  poligono?: string | null;
  parcela?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  ciudad?: string | null; // legacy alias
  provincia?: string | null;
  comunidad_autonoma?: string | null;
  pais?: string | null;
}

const trim = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Compose a legible Spanish-style address from structured fields.
 * Adapts to the asset type:
 *  - Pisos:    "Calle Arces 6, Portal 8, Esc. A, 1ºB, 28922 Alcorcón (Madrid)"
 *  - Chalets:  "Urbanización Cotorredondo, Parcela 127, 28976 Batres (Madrid)"
 *  - Rústica:  "Camino del Valle s/n, Polígono 3, Parcela 14, 28976 Batres (Madrid)"
 *
 * Missing fields are skipped silently — never returns "undefined" or empty
 * separators. País se omite si es España (default).
 */
export function formatDireccion(d: DireccionEstructurada): string {
  if (!d) return "";

  const parts: string[] = [];

  // Bloque 1 — Vía o Urbanización
  const tipoVia = trim(d.tipo_via);
  const nombreVia = trim(d.nombre_via);
  const numero = trim(d.numero);
  const urbanizacion = trim(d.urbanizacion);

  if (tipoVia || nombreVia) {
    let via = [tipoVia, nombreVia].filter(Boolean).join(" ");
    if (numero) via += ` ${numero}`;
    else if (!urbanizacion && !trim(d.parcela)) via += " s/n";
    parts.push(via);
  } else if (urbanizacion) {
    parts.push(`Urbanización ${urbanizacion}`);
  }

  // Bloque 2 — Edificación
  const bloque = trim(d.bloque);
  if (bloque) parts.push(`Bloque ${bloque}`);

  const portal = trim(d.portal);
  if (portal) parts.push(`Portal ${portal}`);

  const escalera = trim(d.escalera);
  if (escalera) parts.push(`Esc. ${escalera}`);

  const planta = trim(d.planta);
  const puerta = trim(d.puerta);
  if (planta || puerta) {
    const pp = [planta && `${planta}º`, puerta].filter(Boolean).join("");
    if (pp) parts.push(pp);
  }

  // Bloque 3 — Parcela (cuando no se ha mencionado ya en vía)
  const parcela = trim(d.parcela);
  if (parcela && !urbanizacion) parts.push(`Parcela ${parcela}`);
  else if (parcela && urbanizacion) parts.push(`Parcela ${parcela}`);

  // Bloque 4 — CP + municipio + (provincia)
  const cp = trim(d.codigo_postal);
  const municipio = trim(d.municipio) || trim(d.ciudad);
  const provincia = trim(d.provincia);

  const loc = [cp, municipio].filter(Boolean).join(" ");
  if (loc && provincia && provincia.toLowerCase() !== municipio.toLowerCase()) {
    parts.push(`${loc} (${provincia})`);
  } else if (loc) {
    parts.push(loc);
  } else if (provincia) {
    parts.push(provincia);
  }

  // País (solo si no es España)
  const pais = trim(d.pais);
  if (pais && pais.toLowerCase() !== "españa" && pais.toLowerCase() !== "spain") {
    parts.push(pais);
  }

  return parts.join(", ");
}

/**
 * True when there's enough address info to display something meaningful.
 */
export function hasDireccionMinima(d: DireccionEstructurada): boolean {
  return Boolean(
    trim(d.nombre_via) ||
      trim(d.urbanizacion) ||
      trim(d.parcela) ||
      trim(d.municipio) ||
      trim(d.ciudad),
  );
}