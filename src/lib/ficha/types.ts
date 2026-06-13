/**
 * Ficha del inmueble — bolsa JSON `caracteristicas_detalle`.
 *
 * Convención: aquí solo viven campos descriptivos. Los campos consultables,
 * filtrables o fiscalmente relevantes (valor catastral, IBI, CEE, etc.) van
 * a columnas directas de `properties`.
 */

export type Orientacion =
  | "N" | "S" | "E" | "O"
  | "NE" | "NO" | "SE" | "SO"
  | "mixta";

export type EstadoConservacion = "excelente" | "bueno" | "regular" | "malo";

export type GarajeFicha = "incluido" | "separado" | "no";

export type AmuebladoFicha = "si" | "no" | "parcial";

/** Códigos normalizados que exige la API del Catastro. */
export type CatastroPlantaCodigo =
  | "SS" | "ST"        // sótano / sótano técnico
  | "BJ"               // bajo
  | "EN"               // entreplanta
  | "PR"               // principal
  | string;            // resto: "1", "2", "3", ...

export type CatastroPuertaCodigo =
  | "A" | "B" | "C" | "D"
  | "IZ" | "DR" | "CT"
  | string;            // resto numérico

export interface CaracteristicasDetalle {
  superficie_util_m2?: number | null;
  num_aseos?: number | null;
  orientacion?: Orientacion | null;
  /**
   * Calidad física del activo (excelente/bueno/regular/malo).
   * Convive con `estado_general` (operativo: activo/inactivo/en reforma).
   */
  estado_conservacion?: EstadoConservacion | null;
  num_terrazas?: number | null;
  garaje?: GarajeFicha | null;
  trastero_incluido?: boolean | null;
  piscina_comunitaria?: boolean | null;
  /** Amplía el booleano legacy `amueblada` con la opción "parcial". */
  amueblado?: AmuebladoFicha | null;

  /** Códigos normalizados Catastro (consulta automática futura). */
  catastro_planta_normalizada?: CatastroPlantaCodigo | null;
  catastro_puerta_normalizada?: CatastroPuertaCodigo | null;
}

export const ORIENTACION_OPTIONS: { value: Orientacion; label: string }[] = [
  { value: "N", label: "Norte" },
  { value: "S", label: "Sur" },
  { value: "E", label: "Este" },
  { value: "O", label: "Oeste" },
  { value: "NE", label: "Noreste" },
  { value: "NO", label: "Noroeste" },
  { value: "SE", label: "Sureste" },
  { value: "SO", label: "Suroeste" },
  { value: "mixta", label: "Mixta" },
];

export const ESTADO_CONSERVACION_OPTIONS: { value: EstadoConservacion; label: string }[] = [
  { value: "excelente", label: "Excelente" },
  { value: "bueno", label: "Bueno" },
  { value: "regular", label: "Regular" },
  { value: "malo", label: "Malo" },
];

export const GARAJE_OPTIONS: { value: GarajeFicha; label: string }[] = [
  { value: "incluido", label: "Incluido en la finca" },
  { value: "separado", label: "Plaza separada" },
  { value: "no", label: "Sin garaje" },
];

export const AMUEBLADO_OPTIONS: { value: AmuebladoFicha; label: string }[] = [
  { value: "si", label: "Sí, totalmente" },
  { value: "parcial", label: "Parcialmente" },
  { value: "no", label: "No" },
];

/**
 * Plantas + código Catastro. El usuario ve "Bajo", el sistema guarda "BJ".
 */
export const CATASTRO_PLANTAS: { codigo: CatastroPlantaCodigo; label: string }[] = [
  { codigo: "SS", label: "Sótano" },
  { codigo: "BJ", label: "Bajo" },
  { codigo: "EN", label: "Entreplanta" },
  { codigo: "PR", label: "Principal" },
  { codigo: "1", label: "1ª planta" },
  { codigo: "2", label: "2ª planta" },
  { codigo: "3", label: "3ª planta" },
  { codigo: "4", label: "4ª planta" },
  { codigo: "5", label: "5ª planta" },
  { codigo: "6", label: "6ª planta" },
  { codigo: "7", label: "7ª planta" },
  { codigo: "8", label: "8ª planta" },
  { codigo: "9", label: "9ª planta" },
  { codigo: "10", label: "10ª planta" },
];

export const CATASTRO_PUERTAS: { codigo: CatastroPuertaCodigo; label: string }[] = [
  { codigo: "A", label: "A" },
  { codigo: "B", label: "B" },
  { codigo: "C", label: "C" },
  { codigo: "D", label: "D" },
  { codigo: "IZ", label: "Izquierda" },
  { codigo: "DR", label: "Derecha" },
  { codigo: "CT", label: "Centro" },
];