/**
 * Cálculo de completitud de la ficha del activo.
 *
 * 4 grupos del 0–100%, cada uno pesa 25%. Dentro de cada grupo se cuenta
 * el porcentaje de campos relevantes presentes. El % global es la suma
 * ponderada de los grupos.
 *
 * No bloquea nada: es puramente informativo y guía al usuario.
 */
import type { Property } from "@/hooks/useProperties";
import type { CaracteristicasDetalle } from "./types";

export type GrupoId = "basico" | "caracteristicas" | "fiscal" | "completo";

export interface ResultadoCompletitud {
  porcentaje: number; // 0-100
  grupos: Record<GrupoId, number>; // 0-100 cada uno
  mensaje: string;
  siguienteCampo: string | null;
}

const hasValue = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true; // un booleano elegido cuenta
  return true;
};

const ratio = (presentes: number, total: number) =>
  total === 0 ? 0 : Math.round((presentes / total) * 100);

function getDetalle(p: Property): CaracteristicasDetalle {
  // `caracteristicas_detalle` es jsonb. Tipado defensivo.
  return ((p as unknown as Record<string, unknown>).caracteristicas_detalle ??
    {}) as CaracteristicasDetalle;
}

export function calcularCompletitud(p: Property): ResultadoCompletitud {
  // ── 1. Básico (nombre, tipo, dirección mínima)
  const basicoCampos = [
    p.nombre_interno,
    p.tipo_inmueble,
    // Dirección: aceptamos cualquiera de las dos formas (estructurada o legacy).
    p.nombre_via || p.direccion_completa,
    p.codigo_postal,
    p.ciudad || p.municipio,
  ];
  const basico = ratio(basicoCampos.filter(hasValue).length, basicoCampos.length);

  // ── 2. Características físicas
  const det = getDetalle(p);
  const caracCampos = [
    p.superficie_m2,
    p.num_habitaciones,
    p.num_banos,
    p.ano_construccion,
    det.orientacion,
    det.estado_conservacion,
    det.amueblado ?? p.amueblada,
  ];
  const caracteristicas = ratio(caracCampos.filter(hasValue).length, caracCampos.length);

  // ── 3. Fiscal / registral
  const fiscalCampos = [
    p.referencia_catastral,
    (p as any).num_finca_registral,
    (p as any).valor_catastral,
    p.valor_compra,
    p.ano_compra,
    p.ibi_importe,
    p.cuota_comunidad,
  ];
  const fiscal = ratio(fiscalCampos.filter(hasValue).length, fiscalCampos.length);

  // ── 4. Completo: CEE + docs/fotos
  const completoCampos = [
    p.calificacion_energetica,
    (p as any).cee_fecha_emision,
    (p as any).cee_numero_registro,
  ];
  const completo = ratio(completoCampos.filter(hasValue).length, completoCampos.length);

  const grupos: Record<GrupoId, number> = { basico, caracteristicas, fiscal, completo };
  const porcentaje = Math.round(
    (basico + caracteristicas + fiscal + completo) / 4,
  );

  const mensaje = mensajePorTramo(porcentaje);
  const siguienteCampo = sugerirSiguiente(p, det);

  return { porcentaje, grupos, mensaje, siguienteCampo };
}

export function mensajePorTramo(pct: number): string {
  if (pct >= 100) return "Ficha completa. Tu expediente está listo";
  if (pct >= 75) return "Último tramo. El CEE y las fotos completan la ficha";
  if (pct >= 50) return "Casi. Los datos fiscales te ayudarán en la declaración";
  if (pct >= 25) return "Bien. Añade superficie y habitaciones";
  return "Empieza añadiendo las características básicas";
}

function sugerirSiguiente(p: Property, det: CaracteristicasDetalle): string | null {
  if (!hasValue(p.nombre_interno)) return "Pon un nombre interno al activo";
  if (!hasValue(p.tipo_inmueble)) return "Indica el tipo de activo";
  if (!hasValue(p.nombre_via) && !hasValue(p.direccion_completa))
    return "Añade la dirección";
  if (!hasValue(p.superficie_m2)) return "Añade la superficie construida";
  if (!hasValue(p.num_habitaciones)) return "Indica las habitaciones";
  if (!hasValue(p.num_banos)) return "Indica los baños";
  if (!hasValue(p.referencia_catastral)) return "Añade la referencia catastral";
  if (!hasValue((p as any).valor_catastral)) return "Añade el valor catastral";
  if (!hasValue(p.ibi_importe)) return "Añade el IBI anual";
  if (!hasValue(p.calificacion_energetica)) return "Sube el certificado energético";
  if (!hasValue((p as any).cee_fecha_emision)) return "Indica la fecha de emisión del CEE";
  return null;
}

/** Fecha de caducidad del CEE = emisión + 10 años. */
export function calcularCaducidadCEE(fechaEmision?: string | null): string | null {
  if (!fechaEmision) return null;
  const d = new Date(fechaEmision);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().slice(0, 10);
}