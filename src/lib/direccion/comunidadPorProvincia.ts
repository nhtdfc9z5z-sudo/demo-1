/**
 * Mapeo provincia → Comunidad Autónoma (España, 50 provincias + 2
 * ciudades autónomas). Fuente única de verdad usada por los formularios
 * de dirección para derivar la CA cuando Nominatim no la devuelve.
 *
 * Reglas:
 *  - Las claves del mapa están normalizadas (lowercase, sin tildes).
 *  - Devuelve `null` si la provincia no se reconoce. Nunca un fallback
 *    arbitrario (evita p.ej. "Albacete → Madrid").
 */

const MAPA: Record<string, string> = {
  // Andalucía
  "almeria": "Andalucía",
  "cadiz": "Andalucía",
  "cordoba": "Andalucía",
  "granada": "Andalucía",
  "huelva": "Andalucía",
  "jaen": "Andalucía",
  "malaga": "Andalucía",
  "sevilla": "Andalucía",
  // Aragón
  "huesca": "Aragón",
  "teruel": "Aragón",
  "zaragoza": "Aragón",
  // Principado de Asturias
  "asturias": "Principado de Asturias",
  // Illes Balears
  "illes balears": "Illes Balears",
  "islas baleares": "Illes Balears",
  "baleares": "Illes Balears",
  // Canarias
  "las palmas": "Canarias",
  "santa cruz de tenerife": "Canarias",
  // Cantabria
  "cantabria": "Cantabria",
  // Castilla-La Mancha
  "albacete": "Castilla-La Mancha",
  "ciudad real": "Castilla-La Mancha",
  "cuenca": "Castilla-La Mancha",
  "guadalajara": "Castilla-La Mancha",
  "toledo": "Castilla-La Mancha",
  // Castilla y León
  "avila": "Castilla y León",
  "burgos": "Castilla y León",
  "leon": "Castilla y León",
  "palencia": "Castilla y León",
  "salamanca": "Castilla y León",
  "segovia": "Castilla y León",
  "soria": "Castilla y León",
  "valladolid": "Castilla y León",
  "zamora": "Castilla y León",
  // Cataluña
  "barcelona": "Cataluña",
  "girona": "Cataluña",
  "gerona": "Cataluña",
  "lleida": "Cataluña",
  "lerida": "Cataluña",
  "tarragona": "Cataluña",
  // Comunidad Valenciana
  "alicante": "Comunidad Valenciana",
  "alacant": "Comunidad Valenciana",
  "castellon": "Comunidad Valenciana",
  "castello": "Comunidad Valenciana",
  "valencia": "Comunidad Valenciana",
  // Extremadura
  "badajoz": "Extremadura",
  "caceres": "Extremadura",
  // Galicia
  "a coruna": "Galicia",
  "la coruna": "Galicia",
  "coruna": "Galicia",
  "lugo": "Galicia",
  "ourense": "Galicia",
  "orense": "Galicia",
  "pontevedra": "Galicia",
  // Comunidad de Madrid
  "madrid": "Comunidad de Madrid",
  // Región de Murcia
  "murcia": "Región de Murcia",
  // Comunidad Foral de Navarra
  "navarra": "Comunidad Foral de Navarra",
  // País Vasco
  "alava": "País Vasco",
  "araba": "País Vasco",
  "guipuzcoa": "País Vasco",
  "gipuzkoa": "País Vasco",
  "vizcaya": "País Vasco",
  "bizkaia": "País Vasco",
  // La Rioja
  "la rioja": "La Rioja",
  "rioja": "La Rioja",
  // Ciudades autónomas
  "ceuta": "Ceuta",
  "melilla": "Melilla",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^provincia de\s+/, "")
    .replace(/\s+/g, " ");
}

export function comunidadDesdeProvincia(
  provincia: string | null | undefined,
): string | null {
  if (!provincia) return null;
  return MAPA[normalize(provincia)] ?? null;
}