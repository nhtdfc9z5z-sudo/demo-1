/**
 * Shared logic for incidencia auto-fill, contact lookups, and field cascading.
 * Used by both IncidenciaQuickCreate and ResumenTab to ensure consistent behavior.
 */

import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

// ── Unified Constants ─────────────────────────────────────────────

/** All causante options — single source of truth */
export const CAUSANTES_ALL = [
  "Inquilino", "Propietario", "Usufructuario", "Comunidad", "Vecino",
  "Pendiente de determinar", "Otro",
];

/** Simplified causante labels for quick-create (map to CAUSANTES_ALL internally) */
export const CAUSANTES_QUICK = [
  "Vecino", "Inquilino", "Comunidad", "Propietario", "Usufructuario",
  "Avería de la vivienda", "Suministro", "Fenómeno externo", "Otro",
];

/** Maps simplified causante → canonical origen_tipo */
export const CAUSANTE_TO_ORIGEN: Record<string, string> = {
  "Vecino": "Vecino",
  "Inquilino": "Mal uso del inquilino",
  "Comunidad": "Elemento común de la comunidad",
  "Propietario": "Avería propia de la vivienda",
  "Usufructuario": "Avería propia de la vivienda",
  "Avería de la vivienda": "Avería propia de la vivienda",
  "Suministro": "Suministro (agua, luz, gas)",
  "Fenómeno externo": "Fenómeno externo",
};

/** Maps simplified causante → canonical causante (for DB storage) */
export const CAUSANTE_QUICK_TO_CANONICAL: Record<string, string> = {
  "Avería de la vivienda": "Propietario",
  "Suministro": "Pendiente de determinar",
  "Fenómeno externo": "Pendiente de determinar",
};

/** Gets the canonical causante for DB storage */
export const getCanonicalCausante = (causante: string): string =>
  CAUSANTE_QUICK_TO_CANONICAL[causante] || causante;

// ── Profile type (minimal) ────────────────────────────────────────

interface ProfileLike {
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
}

// ── Seguro helpers ────────────────────────────────────────────────

export const normalizeSeguroTipo = (value?: string | null): string =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

interface SeguroData {
  tipo?: string;
  compania?: string;
  contacto?: string;
  num_poliza?: string;
}

export const getSeguroHogarData = (property: Property | null | undefined): SeguroData | null => {
  if (!property || !Array.isArray(property.seguros)) return null;

  const seguros = (property.seguros as SeguroData[])
    .filter((s) => s && (s.tipo || s.compania || s.contacto || s.num_poliza));

  const seguroHogar = seguros.find((s) => {
    const tipo = normalizeSeguroTipo(s.tipo);
    return tipo.includes("hogar") || tipo.includes("vivienda");
  });

  const seguroAlternativo = seguros.find((s) => {
    const tipo = normalizeSeguroTipo(s.tipo);
    return !tipo.includes("impago") && !tipo.includes("alquiler") && !tipo.includes("renta");
  });

  return seguroHogar || seguroAlternativo || seguros[0] || null;
};

// ── Contact lookup by role ────────────────────────────────────────

export interface ContactInfo {
  nombre: string;
  telefono: string;
}

export const getContactForRole = (
  role: string,
  property: Property | null | undefined,
  inquilino: Inquilino | null | undefined,
  profile: ProfileLike | null | undefined,
): ContactInfo => {
  if (role === "Inquilino" && inquilino) {
    return {
      nombre: `${inquilino.nombre} ${inquilino.apellidos || ""}`.trim(),
      telefono: inquilino.telefono || "",
    };
  }
  if ((role === "Mismo propietario" || role === "Propietario") && profile) {
    return {
      nombre: `${profile.nombre || ""} ${profile.apellidos || ""}`.trim(),
      telefono: profile.telefono || "",
    };
  }
  if (role === "Usufructuario" && property) {
    return {
      nombre: property.usufructuario_nombre || "",
      telefono: property.usufructuario_telefono || "",
    };
  }
  if (role === "Seguro hogar") {
    const seguro = getSeguroHogarData(property);
    if (seguro) return { nombre: seguro.compania || "", telefono: seguro.contacto || "" };
  }
  if (role === "Comunidad" && property) {
    return {
      nombre: property.admin_fincas_nombre || property.nombre_presidente || "",
      telefono: property.admin_fincas_telefono || property.telefono_presidente || "",
    };
  }
  return { nombre: "", telefono: "" };
};

// ── Auto-fill seguro from role ────────────────────────────────────

export const autoFillSeguroFields = (
  role: string,
  property: Property | null | undefined,
  onChange: (field: string, value: any) => void,
) => {
  if (role !== "Seguro hogar") return;
  const seguro = getSeguroHogarData(property);
  if (!seguro) return;
  onChange("origen_seguro_nombre", seguro.compania || "");
  onChange("origen_seguro_telefono", seguro.contacto || "");
  onChange("origen_seguro_poliza", seguro.num_poliza || "");
};

// ── Auto-fill origen from causante ────────────────────────────────

export const autoFillOrigenFromCausante = (
  causante: string,
  property: Property | null | undefined,
  inquilino: Inquilino | null | undefined,
  onChange: (field: string, value: any) => void,
) => {
  if (causante === "Inquilino" && inquilino) {
    onChange("origen_nombre_responsable", `${inquilino.nombre} ${inquilino.apellidos || ""}`.trim());
    onChange("origen_telefono_responsable", inquilino.telefono || "");
    onChange("origen_domicilio", property?.direccion_completa || "");
  } else if ((causante === "Propietario" || causante === "Usufructuario") && property) {
    onChange("origen_domicilio", property.direccion_completa || "");
    if (causante === "Usufructuario") {
      onChange("origen_nombre_responsable", property.usufructuario_nombre || "");
      onChange("origen_telefono_responsable", property.usufructuario_telefono || "");
    }
  } else if (causante === "Comunidad" && property) {
    onChange("origen_nombre_responsable", property.admin_fincas_nombre || property.nombre_presidente || "");
    onChange("origen_telefono_responsable", property.admin_fincas_telefono || property.telefono_presidente || "");
    onChange("origen_domicilio", "");
  } else if (causante === "Vecino") {
    onChange("origen_nombre_responsable", "");
    onChange("origen_telefono_responsable", "");
    onChange("origen_domicilio", "");
  } else {
    onChange("origen_nombre_responsable", "");
    onChange("origen_telefono_responsable", "");
    onChange("origen_domicilio", "");
  }
};

// ── Handle property change (shared) ──────────────────────────────

export const handlePropertyChangeShared = (
  propertyId: string,
  properties: Property[],
  inquilinos: Inquilino[],
  onChange: (field: string, value: any) => void,
  options?: { fillInquilino?: boolean; fillDomicilios?: boolean },
) => {
  onChange("property_id", propertyId);
  const prop = properties.find(p => p.id === propertyId);
  if (prop) {
    onChange("direccion", prop.direccion_completa || "");
    if (options?.fillDomicilios) {
      onChange("origen_domicilio", prop.direccion_completa || "");
      onChange("afectado_domicilio", prop.direccion_completa || "");
    }
  }
  // Always set inquilino_id when property changes
  const inq = inquilinos.find(i => i.property_id === propertyId && i.rol_inquilino !== "avalista");
  if (inq) {
    onChange("inquilino_id", inq.id);
    if (options?.fillInquilino) {
      onChange("inquilino_nombre", `${inq.nombre} ${inq.apellidos || ""}`.trim());
      onChange("inquilino_telefono", inq.telefono || "");
      onChange("inquilino_email", inq.email || "");
    }
  } else {
    onChange("inquilino_id", null);
  }
};

// ── Full causante change cascade ─────────────────────────────────

export const handleCausanteChangeShared = (
  causante: string,
  property: Property | null | undefined,
  inquilino: Inquilino | null | undefined,
  profile: ProfileLike | null | undefined,
  onChange: (field: string, value: any) => void,
  deps: {
    RESPONSABLES_POR_CAUSANTE: Record<string, string[]>;
    ORIGEN_TO_RESPONSABLE: Record<string, string>;
    ORIGEN_TO_GESTION: Record<string, string>;
  },
) => {
  onChange("causante", causante);

  const origenTipo = CAUSANTE_TO_ORIGEN[causante] || "";
  if (origenTipo) onChange("origen_tipo", origenTipo);

  const mappedCausante = getCanonicalCausante(causante);

  // Auto-set responsable de pago
  const options = deps.RESPONSABLES_POR_CAUSANTE[mappedCausante];
  const responsablePago = options && options.length === 1
    ? options[0]
    : (origenTipo ? (deps.ORIGEN_TO_RESPONSABLE[origenTipo] || "") : "");
  onChange("responsable_pago", responsablePago);

  // Auto-set quien gestiona
  const gestion = origenTipo ? (deps.ORIGEN_TO_GESTION[origenTipo] || "") : "";
  if (gestion) onChange("responsable_gestion", gestion);

  // Auto-fill contact for responsable de pago
  if (responsablePago) {
    const pagoContact = getContactForRole(responsablePago, property, inquilino, profile);
    onChange("responsable_nombre", pagoContact.nombre);
    onChange("responsable_telefono", pagoContact.telefono);
  } else {
    onChange("responsable_nombre", "");
    onChange("responsable_telefono", "");
  }

  // Auto-fill contact for gestor
  if (gestion) {
    const gestionContact = getContactForRole(gestion, property, inquilino, profile);
    onChange("gestion_nombre", gestionContact.nombre);
    onChange("gestion_telefono", gestionContact.telefono);
  }

  // Auto-fill seguro
  if (responsablePago) autoFillSeguroFields(responsablePago, property, onChange);
  if (gestion) autoFillSeguroFields(gestion, property, onChange);

  // Auto-fill origen info
  autoFillOrigenFromCausante(mappedCausante, property, inquilino, onChange);
};

// ── Placeholder helper ───────────────────────────────────────────

export const getPlaceholder = (role: string, type: "nombre" | "telefono"): string => {
  if (type === "telefono") {
    if (role === "Comunidad") return "Ej: 910 123 456";
    if (role === "Seguro hogar" || role === "Seguro vecino") return "Ej: 900 123 456";
    return "Ej: 612 345 678";
  }
  switch (role) {
    case "Inquilino": return "Ej: María López";
    case "Mismo propietario": return "Ej: Tu nombre";
    case "Usufructuario": return "Ej: Nombre del usufructuario";
    case "Seguro hogar": return "Ej: Mapfre, AXA, Zurich...";
    case "Seguro vecino": return "Ej: Allianz, Línea Directa...";
    case "Propio vecino": return "Ej: José Ángel 2ºA";
    case "Comunidad": return "Ej: Administraciones García S.L.";
    case "Propietario": return "Ej: Tu nombre";
    case "Vecino": return "Ej: José Ángel 2ºA";
    case "Técnico": return "Ej: Fontanería Pérez";
    default: return "Ej: Nombre";
  }
};
