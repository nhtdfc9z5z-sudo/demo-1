import { useInmuebleGeneric } from "./useInmuebleGeneric";

export interface Terreno {
  id: string;
  user_id: string;
  nombre_interno: string;
  tipo_via: string | null;
  direccion_completa: string | null;
  urbanizacion: string | null;
  municipio: string | null;
  provincia: string | null;
  comunidad_autonoma: string | null;
  codigo_postal: string | null;
  referencia_catastral: string | null;
  superficie_m2: number | null;
  calificacion_urbanistica: string | null;
  tiene_acceso_rodado: boolean;
  tiene_agua: boolean;
  tiene_luz: boolean;
  tiene_vallado: boolean;
  valor_compra: number | null;
  ano_compra: number | null;
  gastos_compra: number | null;
  valor_estimado: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export function useTerrenos() {
  return useInmuebleGeneric<Terreno>("terrenos", "Terreno");
}
