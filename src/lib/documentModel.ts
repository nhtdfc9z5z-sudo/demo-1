/**
 * documentModel.ts — Modelo unificado de documentos para CapitalRent
 *
 * Centraliza tipos, categorías y normalización de documentos
 * provenientes de múltiples fuentes (property_documentos, facturas,
 * contratos, incidencias, inquilino_documentos, fianzas).
 *
 * NOTAS DE DEUDA TÉCNICA (no implementar aún):
 * - Duplicación de facturas: una factura de incidencia puede existir
 *   como registro en `incidencias.factura_*` Y como `incidencia_documentos`
 *   con categoría "Factura", sin relación cruzada.
 * - Inconsistencia incidencias↔finanzas: `factura_total` en incidencias
 *   no genera registro en `facturas`, por lo que el módulo de Finanzas
 *   lee de `incidencias` directamente (finanzasEngine.computeMonthData).
 * - Categorías en BD usan formatos mixtos: snake_case en property_documentos,
 *   español capitalizado en incidencia_documentos. Se normaliza aquí en frontend.
 * - Bucket semántico incorrecto: property_documentos usa bucket "inquilino-documentos".
 */

// ─── Categoría unificada ───────────────────────────────────────────

export const DOC_CATEGORIAS = {
  contrato: { label: "Contratos", icon: "ScrollText" },
  cee: { label: "Certificado energético", icon: "Leaf" },
  factura: { label: "Facturas", icon: "Receipt" },
  fianza: { label: "Fianzas", icon: "Shield" },
  inventario: { label: "Inventario", icon: "Package" },
  escritura: { label: "Escrituras", icon: "FileText" },
  copia_simple: { label: "Copia/Nota Simple", icon: "FileText" },
  comunidad: { label: "Comunidad", icon: "Home" },
  hacienda: { label: "Hacienda", icon: "Receipt" },
  seguro: { label: "Seguros", icon: "Shield" },
  acuerdo: { label: "Acuerdos", icon: "ScrollText" },
  incidencia: { label: "Incidencias", icon: "FileText" },
  documento: { label: "Documentos inquilino", icon: "FileText" },
  otro: { label: "Otros documentos", icon: "FileText" },
} as const;

export type DocCategoria = keyof typeof DOC_CATEGORIAS;

/** Categorías disponibles para subida manual por el propietario */
export const UPLOAD_CATEGORIES: { value: string; label: string }[] = [
  { value: "contrato", label: "Contrato de arrendamiento" },
  { value: "inventario", label: "Inventario" },
  { value: "fianza", label: "Depósito de fianza" },
  { value: "factura", label: "Factura" },
  { value: "cee", label: "Certificado energético (CEE)" },
  { value: "copia_simple", label: "Copia Simple / Nota Simple" },
  { value: "escritura", label: "Escritura" },
  { value: "comunidad", label: "Documentación de comunidad" },
  { value: "hacienda", label: "Declaración de Hacienda" },
  { value: "seguro", label: "Seguro" },
  { value: "acuerdo", label: "Acuerdo" },
  { value: "_custom", label: "Otro (personalizado)" },
];

// ─── Mapa de normalización de categorías ───────────────────────────

/** Normaliza categorías de distintas fuentes al enum unificado */
const CATEGORY_ALIAS_MAP: Record<string, DocCategoria> = {
  // snake_case existentes
  contrato: "contrato",
  cee: "cee",
  factura: "factura",
  fianza: "fianza",
  inventario: "inventario",
  escritura: "escritura",
  copia_simple: "copia_simple",
  comunidad: "comunidad",
  hacienda: "hacienda",
  seguro: "seguro",
  acuerdo: "acuerdo",
  incidencia: "incidencia",
  documento: "documento",
  otro: "otro",
  // Español capitalizado (incidencia_documentos)
  "Presupuesto": "factura",
  "Factura": "factura",
  "Contrato": "contrato",
  "Informe técnico": "incidencia",
  "Comunicación": "incidencia",
  "Seguro": "seguro",
  "Otro": "otro",
  // Variantes comunes
  "presupuesto": "factura",
  "informe_tecnico": "incidencia",
  "comunicacion": "incidencia",
};

export function normalizeCategoria(raw: string | null | undefined): DocCategoria {
  if (!raw) return "otro";
  return CATEGORY_ALIAS_MAP[raw] ?? CATEGORY_ALIAS_MAP[raw.toLowerCase()] ?? "otro";
}

export function getCategoriaLabel(cat: string): string {
  const normalized = normalizeCategoria(cat);
  return DOC_CATEGORIAS[normalized]?.label ?? cat;
}

// ─── Documento unificado ───────────────────────────────────────────

export type DocSource =
  | "property_doc"
  | "factura"
  | "contrato"
  | "incidencia_doc"
  | "incidencia_evidencia"
  | "inquilino_doc"
  | "fianza";

export interface DocUnificado {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
  categoria: DocCategoria;
  categoria_raw: string; // valor original sin normalizar
  source: DocSource;
  /** Bucket de Storage donde reside el fichero. Necesario para firmar URLs. */
  bucket: string;
  deletable: boolean; // solo property_doc propios son borrables desde la vista unificada
}

// ─── Normalizadores por fuente ─────────────────────────────────────

export function fromPropertyDoc(d: {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
  categoria: string;
}): DocUnificado {
  return {
    id: d.id,
    nombre_archivo: d.nombre_archivo,
    url: d.url,
    storage_path: d.storage_path,
    created_at: d.created_at,
    categoria: normalizeCategoria(d.categoria),
    categoria_raw: d.categoria,
    source: "property_doc",
    bucket: "inquilino-documentos",
    deletable: true,
  };
}

export function fromFactura(f: {
  id: string;
  archivo_nombre: string;
  archivo_url: string;
  storage_path: string;
  created_at: string;
}): DocUnificado {
  return {
    id: f.id,
    nombre_archivo: f.archivo_nombre,
    url: f.archivo_url,
    storage_path: f.storage_path,
    created_at: f.created_at,
    categoria: "factura",
    categoria_raw: "factura",
    source: "factura",
    bucket: "facturas",
    deletable: false,
  };
}

export function fromContrato(c: {
  id: string;
  archivo_nombre: string | null;
  archivo_url: string | null;
  storage_path: string | null;
  created_at: string;
}): DocUnificado | null {
  if (!c.archivo_url || !c.archivo_nombre) return null;
  return {
    id: c.id,
    nombre_archivo: c.archivo_nombre,
    url: c.archivo_url,
    storage_path: c.storage_path || "",
    created_at: c.created_at,
    categoria: "contrato",
    categoria_raw: "contrato",
    source: "contrato",
    bucket: "contratos",
    deletable: false,
  };
}

export function fromIncidenciaDoc(d: {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
  categoria: string;
}): DocUnificado {
  return {
    id: d.id,
    nombre_archivo: d.nombre_archivo,
    url: d.url,
    storage_path: d.storage_path,
    created_at: d.created_at,
    categoria: normalizeCategoria(d.categoria),
    categoria_raw: d.categoria,
    source: "incidencia_doc",
    bucket: "incidencia-documentos",
    deletable: false,
  };
}

export function fromIncidenciaEvidencia(d: {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
}): DocUnificado {
  return {
    id: d.id,
    nombre_archivo: d.nombre_archivo,
    url: d.url,
    storage_path: d.storage_path,
    created_at: d.created_at,
    categoria: "incidencia",
    categoria_raw: "incidencia",
    source: "incidencia_evidencia",
    bucket: "incidencia-archivos",
    deletable: false,
  };
}

export function fromInquilinoDoc(d: {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
  categoria: string;
}): DocUnificado {
  return {
    id: d.id,
    nombre_archivo: d.nombre_archivo,
    url: d.url,
    storage_path: d.storage_path,
    created_at: d.created_at,
    categoria: normalizeCategoria(d.categoria) === "otro" ? "documento" : normalizeCategoria(d.categoria),
    categoria_raw: d.categoria,
    source: "inquilino_doc",
    bucket: "inquilino-documentos",
    deletable: false,
  };
}

export function fromFianza(f: {
  id: string;
  justificante_url: string | null;
  justificante_path: string | null;
  created_at: string;
  numero_expediente: string | null;
}): DocUnificado | null {
  if (!f.justificante_url) return null;
  return {
    id: f.id,
    nombre_archivo: `Justificante fianza${f.numero_expediente ? ` - ${f.numero_expediente}` : ""}`,
    url: f.justificante_url,
    storage_path: f.justificante_path || "",
    created_at: f.created_at,
    categoria: "fianza",
    categoria_raw: "fianza",
    source: "fianza",
    bucket: "contratos",
    deletable: false,
  };
}

// ─── Utilidades ────────────────────────────────────────────────────

/** Ordena documentos por fecha descendente */
export function sortDocsByDate(docs: DocUnificado[]): DocUnificado[] {
  return [...docs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Cuenta documentos por categoría normalizada */
export function countByCategoria(docs: DocUnificado[]): Record<string, number> {
  return docs.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
