/**
 * Tipo de Contrato.
 *
 * Clasificación del vínculo legal/económico entre el activo y el inquilino.
 * Sirve para UX, segmentación y fiscalidad futura. En esta fase NO afecta
 * al motor económico salvo el caso `habitaciones`, que se sincroniza con
 * `contratos_arrendamiento.modalidad_alquiler='habitaciones'` para que el
 * motor de proración/deduplicación (`pagosDedupe`, `auditoria`, etc.) siga
 * funcionando como hoy.
 */

export type TipoContrato =
  | "habitual"
  | "vacacional"
  | "habitaciones"
  | "rent_to_rent"
  | "cesion_empresa";

export const TIPOS_CONTRATO: TipoContrato[] = [
  "habitual",
  "vacacional",
  "habitaciones",
  "rent_to_rent",
  "cesion_empresa",
];

export function labelTipoContrato(t: TipoContrato): string {
  switch (t) {
    case "habitual": return "Arrendamiento habitual";
    case "vacacional": return "Alquiler vacacional";
    case "habitaciones": return "Alquiler por habitaciones";
    case "rent_to_rent": return "Rent to rent";
    case "cesion_empresa": return "Cesión de uso / empresa";
  }
}

export function microcopyTipoContrato(t: TipoContrato): string {
  switch (t) {
    case "habitual": return "Contrato de larga duración.";
    case "vacacional": return "Alquiler por días o semanas.";
    case "habitaciones": return "Cada habitación tiene su propio contrato.";
    case "rent_to_rent": return "Tú alquilas al propietario y subarriendas.";
    case "cesion_empresa": return "El arrendatario es una sociedad.";
  }
}

/**
 * Mapea el enum heredado de la edge `analyze-contrato`
 * (larga_duracion | vacacional | habitacion | explotacion) a `TipoContrato`.
 * Devuelve `null` si no se reconoce.
 */
export function mapOCRTipoToTipoContrato(raw: string | null | undefined): TipoContrato | null {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  if (v === "larga_duracion" || v === "habitual") return "habitual";
  if (v === "vacacional") return "vacacional";
  if (v === "habitacion" || v === "habitaciones") return "habitaciones";
  if (v === "explotacion" || v === "rent_to_rent") return "rent_to_rent";
  if (v === "cesion_empresa") return "cesion_empresa";
  return null;
}

export interface TipoContratoDetalle {
  version: 1;
  tipo: TipoContrato;
  vacacional?: {
    precio_noche?: number | null;
    plataforma?: "airbnb" | "booking" | "directo" | "otro" | null;
    licencia_turistica?: string | null;
  };
  habitaciones?: {
    habitacion_nombre?: string | null;
  };
  rent_to_rent?: {
    renta_pagada_al_propietario?: number | null;
  };
  cesion_empresa?: {
    cif_arrendatario?: string | null;
  };
}
