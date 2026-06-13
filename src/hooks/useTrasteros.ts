import { useInmuebleGeneric } from "./useInmuebleGeneric";

export interface Trastero {
  id: string;
  user_id: string;
  nombre_interno: string;
  tipo_via: string | null;
  direccion_completa: string | null;
  numero_portal: string | null;
  planta: string | null;
  urbanizacion: string | null;
  municipio: string | null;
  provincia: string | null;
  comunidad_autonoma: string | null;
  codigo_postal: string | null;
  referencia_catastral: string | null;
  superficie_m2: number | null;
  planta_sotano: string | null;
  tiene_cerradura: boolean;
  valor_compra: number | null;
  ano_compra: number | null;
  gastos_compra: number | null;
  valor_estimado: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export function useTrasteros() {
  return useInmuebleGeneric<Trastero>("trasteros", "Trastero");
}
