/**
 * Normalización de direcciones para Catastro y para los formularios
 * estructurados de dirección.
 *
 * Dos representaciones conviven:
 *  - Lo que ve el usuario: "Calle", "Bajo", "Izquierda"
 *  - Lo que viaja al Catastro: códigos "CL", "BJ", "IZ"
 *
 * Estas utilidades nunca lanzan: si no reconocen el input, devuelven null.
 */

export interface SiglaCatastro {
  /** Código oficial Catastro (sigla de 2 letras). */
  codigo: string;
  /** Etiqueta legible en español. */
  label: string;
  /** Sinónimos que activan esta sigla cuando se normaliza texto libre. */
  sinonimos: string[];
}

/**
 * Catálogo de siglas Catastro habituales. El orden importa: las claves más
 * largas se prueban antes que las cortas para evitar que "calleja" se
 * confunda con "calle".
 */
export const SIGLAS_CATASTRO: SiglaCatastro[] = [
  { codigo: "TR", label: "Travesía",   sinonimos: ["travesia", "travesía", "trv", "trva"] },
  { codigo: "GL", label: "Glorieta",   sinonimos: ["glorieta", "glta"] },
  { codigo: "RD", label: "Ronda",      sinonimos: ["ronda", "rda"] },
  { codigo: "BL", label: "Bulevar",    sinonimos: ["bulevar", "blvr"] },
  { codigo: "CJ", label: "Calleja",    sinonimos: ["calleja", "callejon", "callejón", "cjon"] },
  { codigo: "PS", label: "Paseo",      sinonimos: ["paseo", "pso"] },
  { codigo: "PZ", label: "Plaza",      sinonimos: ["plaza", "pza", "plza", "pl"] },
  { codigo: "AV", label: "Avenida",    sinonimos: ["avenida", "avda", "avd", "ave"] },
  { codigo: "CR", label: "Carretera",  sinonimos: ["carretera", "ctra", "crta"] },
  { codigo: "CM", label: "Camino",     sinonimos: ["camino", "cno"] },
  { codigo: "CL", label: "Calle",      sinonimos: ["calle", "c/", "c."] },
];

const TODOS_CODIGOS = new Set(SIGLAS_CATASTRO.map((s) => s.codigo));

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function clean(s: string): string {
  return stripDiacritics(s.trim().toLowerCase()).replace(/[.,;]+$/g, "");
}

/**
 * Normaliza el tipo de vía a su código Catastro (CL, AV, PZ…).
 * Acepta:
 *  - el propio código ("CL", "av") → devuelve el código en mayúsculas.
 *  - palabras completas ("Calle", "Avenida de", "Pza")
 *  - texto libre que empieza por un sinónimo conocido.
 * Devuelve null si no reconoce nada.
 */
export function normalizarTipoVia(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Caso 1: ya es un código válido.
  const upper = raw.toUpperCase();
  if (TODOS_CODIGOS.has(upper)) return upper;

  // Caso 2: primera palabra coincide con sinónimo.
  const cleaned = clean(raw);
  for (const s of SIGLAS_CATASTRO) {
    for (const syn of s.sinonimos) {
      if (cleaned === syn || cleaned.startsWith(syn + " ") || cleaned.startsWith(syn)) {
        // Evita falsos positivos como "callejon" matcheando "calle" cuando
        // existe un sinónimo más específico — el orden del catálogo ya lo
        // protege porque "calleja" se evalúa antes que "calle".
        return s.codigo;
      }
    }
  }
  return null;
}

/** Devuelve la etiqueta legible para un código. */
export function labelTipoVia(codigo?: string | null): string | null {
  if (!codigo) return null;
  const found = SIGLAS_CATASTRO.find((s) => s.codigo === codigo.toUpperCase());
  return found?.label ?? null;
}

/** Normaliza una planta a código Catastro: "bajo"→"BJ", "1º"→"1", etc. */
export function normalizarPlanta(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const cleaned = clean(raw)
    .replace(/[ºª°]/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  // Códigos directos (BJ, EN, PR, SS, ST).
  const upper = cleaned.toUpperCase();
  if (["SS", "ST", "BJ", "EN", "PR"].includes(upper)) return upper;

  if (/^bajo$|^bj$|^baja$/.test(cleaned)) return "BJ";
  if (/^entresuelo$|^entreplanta$|^entlo$|^en$/.test(cleaned)) return "EN";
  if (/^principal$|^pral$|^pr$/.test(cleaned)) return "PR";
  if (/^sotano$|^sot$|^ss$/.test(cleaned)) return "SS";
  if (/^semisotano$|^subsotano$/.test(cleaned)) return "ST";
  if (/^atico$|^at$/.test(cleaned)) return "10"; // aproximación: ático sin nº

  // Ordinales escritos: "primera", "segunda"…
  const ORD: Record<string, string> = {
    primera: "1", primero: "1",
    segunda: "2", segundo: "2",
    tercera: "3", tercero: "3",
    cuarta: "4", cuarto: "4",
    quinta: "5", quinto: "5",
    sexta: "6", sexto: "6",
    septima: "7", septimo: "7", setima: "7", setimo: "7",
    octava: "8", octavo: "8",
    novena: "9", noveno: "9",
    decima: "10", decimo: "10",
  };
  if (ORD[cleaned]) return ORD[cleaned].padStart(2, "0");

  // Numérica: "1", "1a", "10b" → coger el entero inicial (2 dígitos).
  const m = cleaned.match(/^(\d{1,2})/);
  if (m) return m[1].padStart(2, "0");

  return null;
}

/**
 * Formato legible para usuario, derivado de cualquier entrada libre.
 * "segunda" / "2" / "2º" → "2ª planta"
 * "bajo" → "Bajo"; "principal" → "Principal"; "atico" → "Ático".
 * Si no reconoce, devuelve el input recortado (no pierde información).
 */
export function formatearPlantaDisplay(input?: string | null): string {
  const raw = (input ?? "").toString().trim();
  if (!raw) return "";
  const code = normalizarPlanta(raw);
  if (!code) return raw;
  if (code === "BJ") return "Bajo";
  if (code === "EN") return "Entresuelo";
  if (code === "PR") return "Principal";
  if (code === "SS") return "Sótano";
  if (code === "ST") return "Semisótano";
  // Ático aproximado.
  if (code === "10" && /atico|at/.test(clean(raw).replace(/[ºª°]/g, ""))) {
    return "Ático";
  }
  // Numérico: quitar ceros a la izquierda.
  const n = parseInt(code, 10);
  if (Number.isFinite(n) && n > 0) return `${n}ª planta`;
  return raw;
}

/**
 * Variante corta para inputs de formulario: devuelve sólo el dígito o la
 * etiqueta corta sin sufijo. "segunda" / "2º" / "02" → "2"; "bajo" → "Bajo".
 * Pensado para que el usuario edite cómodamente en un campo de texto.
 */
export function formatearPlantaCorto(input?: string | null): string {
  const raw = (input ?? "").toString().trim();
  if (!raw) return "";
  const code = normalizarPlanta(raw);
  if (!code) return raw;
  if (code === "BJ") return "Bajo";
  if (code === "EN") return "Entresuelo";
  if (code === "PR") return "Principal";
  if (code === "SS") return "Sótano";
  if (code === "ST") return "Semisótano";
  if (code === "10" && /atico|at/.test(clean(raw).replace(/[ºª°]/g, ""))) {
    return "Ático";
  }
  const n = parseInt(code, 10);
  if (Number.isFinite(n) && n > 0) return String(n);
  return raw;
}

/** Normaliza una puerta: "izda"→"IZ", "dcha"→"DR", "centro"→"CT", "A"→"A". */
export function normalizarPuerta(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const cleaned = clean(raw).replace(/[ºª°]/g, "").replace(/\s+/g, "");
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();
  if (["IZ", "DR", "CT"].includes(upper)) return upper;
  if (/^(izquierda|izqda|izda|izq|i)$/.test(cleaned)) return "IZ";
  if (/^(derecha|dcha|dch|der|d)$/.test(cleaned)) return "DR";
  if (/^(centro|ctro|c)$/.test(cleaned)) return "CT";

  // Letras A-Z aisladas o numéricas: devolver tal cual en mayúsculas.
  if (/^[a-z]$/i.test(cleaned)) return cleaned.toUpperCase();
  if (/^\d{1,3}$/.test(cleaned)) return cleaned;

  return null;
}

export interface DireccionLibreParseada {
  /** Código Catastro (CL, AV…) si se ha reconocido un tipo. */
  tipo_via_codigo: string | null;
  /** Etiqueta legible ("Calle", "Avenida"…) lista para el Select del form. */
  tipo_via_label: string | null;
  /** Nombre limpio de la vía, sin tipo ni número. */
  nombre_via: string;
  /** Número de portal si aparecía al final. */
  numero: string | null;
}

/**
 * Parsea una cadena libre tipo "Calle Gran Vía 24" en componentes:
 *   { tipo_via_codigo:"CL", tipo_via_label:"Calle",
 *     nombre_via:"Gran Vía", numero:"24" }
 *
 * Si no detecta un tipo de vía, devuelve `tipo_via_*` a null y conserva el
 * texto completo en `nombre_via` (mejor no perder información que adivinar).
 * Tolera preposiciones tras el tipo: "Avenida de Portugal 30".
 */
export function parseDireccionLibre(input?: string | null): DireccionLibreParseada {
  const safe = (input ?? "").toString().trim();
  if (!safe) {
    return { tipo_via_codigo: null, tipo_via_label: null, nombre_via: "", numero: null };
  }

  // 1. Extraer número final ("… 24", "… 24 bis", "… s/n").
  let resto = safe;
  let numero: string | null = null;
  const mNum = safe.match(/^(.*?)[,\s]+(\d{1,5}\s*(?:bis|duplicado|dup)?)\s*$/i);
  if (mNum) {
    resto = mNum[1].trim();
    numero = mNum[2].replace(/\s+/g, " ").trim();
  } else if (/\s+s\/n\s*$/i.test(safe)) {
    resto = safe.replace(/\s+s\/n\s*$/i, "").trim();
    numero = "s/n";
  }

  // 2. Detectar tipo de vía al inicio.
  const cleanedResto = clean(resto);
  let tipoCodigo: string | null = null;
  let restoSinTipo = resto;

  for (const s of SIGLAS_CATASTRO) {
    for (const syn of s.sinonimos) {
      // Sinónimo seguido de espacio o fin.
      const pattern = new RegExp(`^${syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s+|$)`, "i");
      if (pattern.test(cleanedResto)) {
        tipoCodigo = s.codigo;
        // Recortar del texto original respetando longitud del sinónimo.
        restoSinTipo = resto.slice(syn.length).trim();
        break;
      }
    }
    if (tipoCodigo) break;
  }

  // 3. Si hay tipo, eliminar también preposiciones residuales: "de", "del", "de la", "de los", "de las".
  if (tipoCodigo) {
    restoSinTipo = restoSinTipo
      .replace(/^(de\s+(?:la|los|las|el)\s+|del\s+|de\s+)/i, "")
      .trim();
  }

  return {
    tipo_via_codigo: tipoCodigo,
    tipo_via_label: tipoCodigo ? labelTipoVia(tipoCodigo) : null,
    nombre_via: restoSinTipo,
    numero,
  };
}
/**
 * Normaliza un municipio para Catastro: sin tildes, mayúsculas, sin
 * dobles espacios. "Móstoles" → "MOSTOLES", "Batres" → "BATRES".
 */
export function normalizarMunicipioCatastro(input?: string | null): string {
  if (!input) return "";
  return stripDiacritics(String(input).trim())
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Idem para provincia. */
export function normalizarProvinciaCatastro(input?: string | null): string {
  return normalizarMunicipioCatastro(input);
}

/**
 * Infiere la provincia a partir de los 2 primeros dígitos del código
 * postal español. Devuelve null si el CP no es válido.
 */
const CP_PROVINCIA: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería",
  "05": "Ávila", "06": "Badajoz", "07": "Baleares", "08": "Barcelona",
  "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
  "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Guipúzcoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid",
  "29": "Málaga", "30": "Murcia", "31": "Navarra", "32": "Ourense",
  "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona",
  "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Vizcaya", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta",
  "52": "Melilla",
};

export function provinciaDesdeCP(cp?: string | null): string | null {
  if (!cp) return null;
  const m = String(cp).trim().match(/^(\d{2})\d{3}$/);
  if (!m) return null;
  return CP_PROVINCIA[m[1]] ?? null;
}
