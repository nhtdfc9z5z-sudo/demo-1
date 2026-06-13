import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Fianza {
  id: string;
  user_id: string;
  property_id: string;
  inquilino_id: string | null;
  comunidad_autonoma: string;
  organismo: string;
  importe: number;
  importe_inicial: number | null;
  fecha_efecto_actual: string | null;
  fecha_deposito: string | null;
  fecha_devolucion: string | null;
  numero_expediente: string | null;
  estado: string;
  tipo_fianza: string | null;
  meses_fianza: number | null;
  medio_pago: string | null;
  justificante_url: string | null;
  justificante_path: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export const COMUNIDADES_AUTONOMAS = [
  { value: "andalucia", label: "Andalucía", organismo: "Agencia de Vivienda y Rehabilitación de Andalucía (AVRA)", url: "https://www.juntadeandalucia.es" },
  { value: "aragon", label: "Aragón", organismo: "Dirección General de Vivienda", url: "https://www.aragon.es" },
  { value: "asturias", label: "Asturias", organismo: "Servicio de Vivienda del Principado", url: "https://www.asturias.es" },
  { value: "baleares", label: "Islas Baleares", organismo: "Institut Balear de l'Habitatge (IBAVI)", url: "https://www.ibavi.caib.es" },
  { value: "canarias", label: "Canarias", organismo: "Instituto Canario de la Vivienda", url: "https://www.gobiernodecanarias.org" },
  { value: "cantabria", label: "Cantabria", organismo: "Dirección General de Vivienda", url: "https://www.cantabria.es" },
  { value: "castilla_leon", label: "Castilla y León", organismo: "Consejería de Medio Ambiente, Vivienda y Ordenación del Territorio", url: "https://www.jcyl.es" },
  { value: "castilla_mancha", label: "Castilla-La Mancha", organismo: "Consejería de Fomento", url: "https://www.castillalamancha.es" },
  { value: "cataluna", label: "Cataluña", organismo: "Institut Català del Sòl (INCASÒL)", url: "https://incasol.gencat.cat" },
  { value: "ceuta", label: "Ceuta", organismo: "Ciudad Autónoma de Ceuta", url: "https://www.ceuta.es" },
  { value: "extremadura", label: "Extremadura", organismo: "Consejería de Movilidad, Transporte y Vivienda", url: "https://www.juntaex.es" },
  { value: "galicia", label: "Galicia", organismo: "Instituto Galego da Vivenda e Solo (IGVS)", url: "https://igvs.xunta.gal" },
  { value: "la_rioja", label: "La Rioja", organismo: "Dirección General de Vivienda", url: "https://www.larioja.org" },
  { value: "madrid", label: "Comunidad de Madrid", organismo: "IVIMA / Agencia de Vivienda Social", url: "https://gestiona3.madrid.org/gfa_app/menus/visualGeneral.jsf" },
  { value: "melilla", label: "Melilla", organismo: "Ciudad Autónoma de Melilla", url: "https://www.melilla.es" },
  { value: "murcia", label: "Región de Murcia", organismo: "Consejería de Fomento e Infraestructuras", url: "https://www.carm.es" },
  { value: "navarra", label: "Navarra", organismo: "Nasuvinsa – Sociedad Pública de Vivienda", url: "https://www.nasuvinsa.es" },
  { value: "pais_vasco", label: "País Vasco", organismo: "Departamento de Planificación Territorial, Vivienda y Transportes", url: "https://www.euskadi.eus" },
  { value: "valencia", label: "Comunidad Valenciana", organismo: "Conselleria de Vivienda y Arquitectura Bioclimática", url: "https://www.gva.es" },
];

export const ESTADOS_FIANZA = [
  { value: "pendiente", label: "Pendiente de depositar" },
  { value: "depositada", label: "Depositada" },
  { value: "devolucion_solicitada", label: "Devolución solicitada" },
  { value: "devuelta", label: "Devuelta" },
];

export function useFianzas() {
  const { user } = useAuth();
  const [fianzas, setFianzas] = useState<Fianza[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFianzas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fianzas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching fianzas:", error);
    else setFianzas((data as unknown as Fianza[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFianzas(); }, [fetchFianzas]);

  const createFianza = async (data: Partial<Fianza>): Promise<Fianza | null> => {
    if (!user) return null;
    const insertData = { ...data, user_id: user.id };
    const { data: inserted, error } = await supabase
      .from("fianzas")
      .insert(insertData as any)
      .select()
      .single();
    if (error) { toast.error("Error al crear fianza"); console.error(error); return null; }
    const fianza = inserted as unknown as Fianza;
    setFianzas(prev => [fianza, ...prev]);
    toast.success("Fianza registrada");
    return fianza;
  };

  const updateFianza = async (id: string, updates: Partial<Fianza>) => {
    const { error } = await supabase.from("fianzas").update(updates as any).eq("id", id);
    if (error) { toast.error("Error al actualizar"); return; }
    setFianzas(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteFianza = async (id: string) => {
    const { error } = await supabase.from("fianzas").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    setFianzas(prev => prev.filter(f => f.id !== id));
    toast.success("Fianza eliminada");
  };

  return { fianzas, loading, createFianza, updateFianza, deleteFianza };
}
