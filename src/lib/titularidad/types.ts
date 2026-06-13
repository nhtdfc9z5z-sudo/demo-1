/**
 * Modelo de Titularidad del Activo.
 *
 * Cubre 4 relaciones posibles entre el usuario y el inmueble:
 *   - propietario_unico  → el usuario es el único dueño
 *   - copropietarios     → varios dueños (incluido el usuario o no)
 *   - usufructuario      → el usuario tiene el usufructo
 *   - gestor             → administra el inmueble para un tercero
 *   - subarrendador      → alquila al propietario y subarrienda
 *
 * REGLA: la titularidad sirve para gestión interna y fiscalidad futura,
 * pero NUNCA bloquea el alta. Los datos que falten se acumulan en
 * `pendientes[]` y se muestran en ResumenAltaFinal / Centro de salud.
 */

export type RelacionTitularidad =
  | "propietario_unico"
  | "copropietarios"
  | "usufructuario"
  | "gestor"
  | "subarrendador";

export interface CopropietarioInput {
  nombre: string;
  dni: string;
  porcentaje: string; // mantenido como string para tolerar input vacío
}

export interface TitularidadDetalle {
  version: 1;
  relacion: RelacionTitularidad;
  pendientes: string[];
  nudo_propietario?: { nombre?: string; nif?: string };
  gestion?: { comision_pct?: number | null };
  subarriendo?: { renta_pagada_mensual?: number | null };
}

/**
 * Mapea la `relacion` lógica al valor histórico de la columna
 * `properties.titularidad` (text), para mantener compat hacia atrás
 * con propiedades creadas antes de este rediseño.
 */
export function relacionToLegacyTitularidad(r: RelacionTitularidad): "yo" | "copropietarios" | "tercero" {
  switch (r) {
    case "propietario_unico":
      return "yo";
    case "copropietarios":
      return "copropietarios";
    case "usufructuario":
    case "gestor":
    case "subarrendador":
      return "tercero";
  }
}
