import { useInmuebleGeneric } from "./useInmuebleGeneric";

export interface Edificio {
  id: string;
  user_id: string;
  nombre_interno: string;
  tipo_via: string | null;
  direccion_completa: string | null;
  numero_portal: string | null;
  urbanizacion: string | null;
  municipio: string | null;
  provincia: string | null;
  comunidad_autonoma: string | null;
  codigo_postal: string | null;
  referencia_catastral: string | null;
  superficie_m2: number | null;
  num_plantas: number | null;
  num_viviendas: number | null;
  num_locales: number | null;
  num_garajes: number | null;
  ano_construccion: number | null;
  cuota_comunidad: number | null;
  valor_compra: number | null;
  ano_compra: number | null;
  gastos_compra: number | null;
  valor_estimado: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export function useEdificios() {
  return useInmuebleGeneric<Edificio>("edificios", "Edificio");
}
