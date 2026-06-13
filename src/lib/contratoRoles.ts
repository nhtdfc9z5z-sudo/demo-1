/**
 * contratoRoles — capa pura para razonar sobre las personas vinculadas a un
 * contrato y derivar el reparto fiscal real (que no siempre coincide con la
 * titularidad del inmueble).
 *
 * Regla básica:
 *  - La titularidad del inmueble dice quién es DUEÑO.
 *  - Los roles del contrato dicen quién ARRIENDA, PAGA, GESTIONA, DECLARA.
 *  - Para fiscalidad mandan los roles del contrato si los hay; si no, se
 *    cae a la titularidad como fallback (comportamiento legado).
 */

import { titularKey, type MinimalProperty, type MeProfile, getTitulares } from "@/lib/fiscalPack";

/** Roles canónicos soportados en la UI. Texto libre en BD para flexibilidad. */
export type RolContractual =
  | "arrendador"
  | "coarrendador"
  | "arrendatario"
  | "coarrendatario"
  | "subarrendador"
  | "subarrendatario"
  | "gestor"
  | "administrador"
  | "avalista"
  | "contacto_autorizado"
  // Legados ya en BD:
  | "titular_principal"
  | "cotitular"
  | "ocupante";

export type ParteContrato = "arrendadora" | "arrendataria" | "gestion" | "garantia" | "otro";

export interface PersonaContrato {
  id?: string;
  contrato_id?: string;
  rol: string;                              // RolContractual o legacy
  parte?: ParteContrato | string | null;
  nombre: string | null;
  dni?: string | null;
  porcentaje_participacion?: number | null;
  porcentaje_fiscal?: number | null;
  afecta_fiscalidad?: boolean | null;
  es_yo?: boolean | null;
}

/** Deriva `parte` desde el rol cuando no viene persistida. */
export function parteFromRol(rol: string): ParteContrato {
  switch (rol) {
    case "arrendador":
    case "coarrendador":
    case "subarrendador":
      return "arrendadora";
    case "arrendatario":
    case "coarrendatario":
    case "subarrendatario":
      return "arrendataria";
    case "gestor":
    case "administrador":
      return "gestion";
    case "avalista":
      return "garantia";
    case "contacto_autorizado":
      return "otro";
    // Legados: los tratamos como parte arrendadora por compatibilidad
    // (eran "titulares" del contrato desde la óptica del propietario).
    case "titular_principal":
    case "cotitular":
      return "arrendadora";
    case "ocupante":
      return "arrendataria";
    default:
      return "otro";
  }
}

/** ¿Esta persona declara fiscalmente para el contrato? */
export function declaraFiscalmente(p: PersonaContrato): boolean {
  if (p.afecta_fiscalidad == null) {
    // Fallback inferido: arrendadores declaran por defecto.
    return parteFromRol(p.rol) === "arrendadora";
  }
  return !!p.afecta_fiscalidad;
}

/** Clave estable para una persona del contrato (alineada con titularKey). */
export function personaKey(p: PersonaContrato): string {
  return titularKey({ dni: p.dni ?? null, nombre: p.nombre ?? null, esYo: !!p.es_yo });
}

/** Devuelve los arrendadores con impacto fiscal real. */
export function getArrendadoresFiscales(personas: PersonaContrato[]): PersonaContrato[] {
  return personas.filter(p => {
    const parte = (p.parte as ParteContrato) || parteFromRol(p.rol);
    return parte === "arrendadora" && declaraFiscalmente(p);
  });
}

export interface RepartoFiscalItem {
  key: string;
  nombre: string;
  dni: string | null;
  porcentaje: number; // 0..100 normalizado
  esYo: boolean;
  rol: string;
}

/**
 * Devuelve el reparto fiscal del contrato entre arrendadores fiscales,
 * normalizado a 100. Si no se pueden inferir porcentajes, reparto equitativo.
 * Si no hay arrendadores fiscales declarados, devuelve [].
 */
export function repartoFiscalContrato(personas: PersonaContrato[]): RepartoFiscalItem[] {
  const arr = getArrendadoresFiscales(personas);
  if (arr.length === 0) return [];

  const parsed = arr.map(p => {
    const pctRaw = p.porcentaje_fiscal ?? p.porcentaje_participacion;
    const pct = typeof pctRaw === "number" ? pctRaw : NaN;
    return {
      key: personaKey(p),
      nombre: (p.nombre || "Arrendador").trim(),
      dni: p.dni || null,
      porcentaje: Number.isFinite(pct) ? Math.max(0, pct) : NaN,
      esYo: !!p.es_yo,
      rol: p.rol,
    };
  });

  const hasAny = parsed.some(p => Number.isFinite(p.porcentaje));
  if (!hasAny) {
    const each = 100 / parsed.length;
    return parsed.map(p => ({ ...p, porcentaje: each }));
  }

  // Los que no tengan % quedan a 0 (decisión explícita: solo declara quien tiene %).
  const out = parsed.map(p => ({ ...p, porcentaje: Number.isFinite(p.porcentaje) ? p.porcentaje : 0 }));

  // Normalizamos a 100 SOLO si la suma > 100 (overflow) o si suma ≈ 0.
  const total = out.reduce((s, p) => s + p.porcentaje, 0);
  if (total <= 0) {
    const each = 100 / out.length;
    return out.map(p => ({ ...p, porcentaje: each }));
  }
  if (total > 100.01) {
    const factor = 100 / total;
    return out.map(p => ({ ...p, porcentaje: p.porcentaje * factor }));
  }
  return out;
}

export type CriterioFiscal = "rol_contractual" | "titularidad" | "sin_datos";

export interface ResolucionFiscal {
  /** Factor 0..1 a aplicar a los importes para `ownerKey`. */
  shareFactor: number;
  /** Porcentaje 0..100 equivalente (para mostrar en UI). */
  porcentaje: number;
  criterio: CriterioFiscal;
  /** True cuando hay señal de conflicto que conviene revisar con asesor. */
  requiereRevisionFiscal: boolean;
  /** Notas legibles para mostrar al usuario / asesor. */
  notas: string[];
}

/**
 * Resuelve cuánto del contrato/inmueble corresponde fiscalmente al `ownerKey`.
 * Prioridad: roles contractuales > titularidad > sin datos.
 */
export function resolverShareFiscal(
  property: MinimalProperty,
  personas: PersonaContrato[] | undefined,
  ownerKey: string,
  me?: MeProfile | null,
): ResolucionFiscal {
  const notas: string[] = [];

  // 1) Roles contractuales
  const arr = personas ? getArrendadoresFiscales(personas) : [];
  if (arr.length > 0) {
    const reparto = repartoFiscalContrato(personas!);
    const match = reparto.find(r => r.key === ownerKey);

    if (match) {
      const pct = match.porcentaje;
      return {
        shareFactor: pct / 100,
        porcentaje: Math.round(pct * 10) / 10,
        criterio: "rol_contractual",
        requiereRevisionFiscal: false,
        notas,
      };
    }

    // ownerKey NO figura como arrendador fiscal. ¿Es titular?
    const titular = getTitulares(property, me).find(t => t.key === ownerKey);
    if (titular) {
      notas.push(
        "Esta persona es titular del inmueble pero no figura como arrendador fiscal del contrato. Revisa con tu asesor fiscal."
      );
      return {
        shareFactor: 0,
        porcentaje: 0,
        criterio: "rol_contractual",
        requiereRevisionFiscal: true,
        notas,
      };
    }
    return { shareFactor: 0, porcentaje: 0, criterio: "rol_contractual", requiereRevisionFiscal: false, notas };
  }

  // 2) Titularidad (fallback legado)
  const titular = getTitulares(property, me).find(t => t.key === ownerKey);
  if (titular) {
    return {
      shareFactor: titular.porcentaje / 100,
      porcentaje: Math.round(titular.porcentaje * 10) / 10,
      criterio: "titularidad",
      requiereRevisionFiscal: false,
      notas,
    };
  }

  // 3) Sin participación: la persona no es titular ni arrendador del inmueble.
  //    No es un conflicto fiscal, simplemente no participa → no marcamos revisión.
  return { shareFactor: 0, porcentaje: 0, criterio: "titularidad", requiereRevisionFiscal: false, notas };
}

/** Para el caso "sin filtro de propietario" (cálculo a 100% del contrato). */
export function criterioInmuebleCompleto(personas: PersonaContrato[] | undefined): CriterioFiscal {
  if (personas && getArrendadoresFiscales(personas).length > 0) return "rol_contractual";
  return "titularidad";
}

/**
 * Validación del reparto fiscal de la parte arrendadora del contrato.
 *
 * Reglas:
 *  - `sin_arrendadores`: no hay arrendadores fiscales declarados → fallback a
 *    titularidad (no es un error por sí mismo, no genera warning).
 *  - `sin_datos`: hay arrendadores fiscales pero ninguno tiene
 *    `porcentaje_fiscal` ni `porcentaje_participacion` → se aplica reparto
 *    equitativo como fallback; conviene avisar.
 *  - `ok`: suma de porcentajes ∈ [99,5; 100,5].
 *  - `incompleto`: suma > 0 y < 99,5.
 *  - `excedido`: suma > 100,5.
 *
 * Devuelve un mensaje legible listo para mostrar al usuario / incluir en
 * PDF/Excel. La función es pura.
 */
export type ValidacionPorcentajesStatus =
  | "ok"
  | "sin_arrendadores"
  | "sin_datos"
  | "incompleto"
  | "excedido";

export interface ValidacionPorcentajesFiscales {
  status: ValidacionPorcentajesStatus;
  /** Suma detectada (0..N). 0 si no hay datos o sin arrendadores. */
  suma: number;
  /** Mensaje legible. `null` cuando status === "ok" o "sin_arrendadores". */
  mensaje: string | null;
}

export function validarPorcentajesFiscales(
  personas: PersonaContrato[] | undefined,
): ValidacionPorcentajesFiscales {
  const arr = personas ? getArrendadoresFiscales(personas) : [];
  if (arr.length === 0) {
    return { status: "sin_arrendadores", suma: 0, mensaje: null };
  }

  const valores = arr.map(p => {
    const raw = p.porcentaje_fiscal ?? p.porcentaje_participacion;
    const n = typeof raw === "number" ? raw : NaN;
    return Number.isFinite(n) ? Math.max(0, n) : NaN;
  });

  const conValor = valores.filter(v => Number.isFinite(v)) as number[];
  if (conValor.length === 0) {
    return {
      status: "sin_datos",
      suma: 0,
      mensaje:
        "No hay porcentaje fiscal definido para los arrendadores. Se aplica fallback por titularidad o reparto equitativo.",
    };
  }

  const suma = Math.round(conValor.reduce((s, v) => s + v, 0) * 10) / 10;
  if (suma < 99.5) {
    return {
      status: "incompleto",
      suma,
      mensaje: `Los porcentajes fiscales de los arrendadores suman ${suma}%. Revisa el reparto fiscal.`,
    };
  }
  if (suma > 100.5) {
    return {
      status: "excedido",
      suma,
      mensaje: `Los porcentajes fiscales de los arrendadores suman ${suma}%. Revisa el reparto fiscal.`,
    };
  }
  return { status: "ok", suma, mensaje: null };
}