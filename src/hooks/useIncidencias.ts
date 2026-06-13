import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Incidencia {
  id: string;
  user_id: string;
  property_id: string | null;
  inquilino_id: string | null;
  numero_incidencia: number;
  direccion: string | null;
  fecha_hora_incidencia: string | null;
  concepto: string | null;
  prioridad: number;
  estado: string;
  origen_tipo: string | null;
  tipo_incidencia: string | null;
  causante: string | null;
  responsable_pago: string | null;
  responsable_gestion: string | null;
  responsable_nombre: string | null;
  responsable_telefono: string | null;
  gestion_nombre: string | null;
  gestion_telefono: string | null;
  referencia_interna: string | null;
  inquilino_nombre: string | null;
  inquilino_telefono: string | null;
  inquilino_email: string | null;
  inquilino_contacto_whatsapp: boolean;
  inquilino_contacto_llamada: boolean;
  inquilino_contacto_email: boolean;
  inquilino_observaciones: string | null;
  disponibilidad_parte_dia: string | null;
  disponibilidad_dias: string[] | null;
  disponibilidad_comentarios: string | null;
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
  proveedor_email: string | null;
  proveedor_cif: string | null;
  proveedor_direccion: string | null;
  presupuesto_importe: number | null;
  presupuesto_iva_porcentaje: number | null;
  presupuesto_iva_cuota: number | null;
  presupuesto_total: number | null;
  presupuesto_fecha: string | null;
  presupuesto_descripcion: string | null;
  presupuesto_observaciones: string | null;
  presupuesto_validez: string | null;
  presupuesto_archivo_path: string | null;
  presupuesto_archivo_url: string | null;
  factura_emisor_nombre: string | null;
  factura_emisor_nif: string | null;
  factura_receptor_nombre: string | null;
  factura_receptor_nif: string | null;
  factura_numero: string | null;
  factura_fecha: string | null;
  factura_base_imponible: number | null;
  factura_iva_porcentaje: number | null;
  factura_cuota_iva: number | null;
  factura_total: number | null;
  origen_domicilio: string | null;
  origen_lugar: string | null;
  origen_responsable: string | null;
  origen_nombre_responsable: string | null;
  origen_telefono_responsable: string | null;
  origen_seguro_nombre: string | null;
  origen_seguro_poliza: string | null;
  origen_seguro_ref_siniestro: string | null;
  origen_seguro_telefono: string | null;
  origen_seguro_email: string | null;
  origen_seguro_observaciones: string | null;
  afectado_domicilio: string | null;
  afectado_lugar: string | null;
  afectado_responsable: string | null;
  afectado_nombre: string | null;
  afectado_telefono: string | null;
  afectado_seguro_nombre: string | null;
  afectado_seguro_poliza: string | null;
  afectado_seguro_ref_siniestro: string | null;
  afectado_seguro_telefono: string | null;
  afectado_seguro_email: string | null;
  afectado_seguro_observaciones: string | null;
  proveedor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidenciaMensaje {
  id: string;
  incidencia_id: string;
  user_id: string;
  autor: string;
  mensaje: string;
  created_at: string;
  updated_at: string;
}

export interface IncidenciaEvidencia {
  id: string;
  incidencia_id: string;
  user_id: string;
  nombre_archivo: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export interface IncidenciaCitacion {
  id: string;
  incidencia_id: string;
  user_id: string;
  visitante_nombre: string;
  visitante_telefono: string | null;
  visitante_email: string | null;
  visitante_rol: string;
  visitante_empresa: string | null;
  fecha_hora: string;
  receptor_nombre: string;
  receptor_telefono: string | null;
  receptor_email: string | null;
  receptor_rol: string;
  estado: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export const ESTADOS_INCIDENCIA = [
  "Abierta", "En revisión", "Proveedor asignado", "Pendiente de factura", "Cerrada"
];

export const ORIGENES_INCIDENCIA = [
  "Avería propia de la vivienda",
  "Mal uso del inquilino",
  "Vecino",
  "Elemento común de la comunidad",
  "Suministro (agua, luz, gas)",
  "Fenómeno externo",
];

export const TIPOS_INCIDENCIA = [
  "Fontanería",
  "Electricidad",
  "Electrodomésticos",
  "Humedad",
  "Cerrajería",
  "Cristales",
  "Comunidad",
  "Suministros",
  "Mantenimiento",
  "Otro",
];

export const CAUSANTES = [
  "Inquilino", "Propietario", "Usufructuario", "Comunidad", "Vecino", "Pendiente de determinar", "Otro",
];

// Dynamic responsable options based on causante
export const RESPONSABLES_POR_CAUSANTE: Record<string, string[]> = {
  "Propietario": ["Mismo propietario", "Seguro hogar", "Por definir"],
  "Inquilino": ["Inquilino", "Mismo propietario", "Seguro hogar", "Por definir"],
  "Usufructuario": ["Usufructuario", "Mismo propietario", "Seguro hogar", "Por definir"],
  "Comunidad": ["Comunidad", "Por definir"],
  "Vecino": ["Seguro vecino", "Propio vecino", "Por definir"],
  "Pendiente de determinar": ["Por definir"],
  "Otro": ["Por definir"],
};

export const RESPONSABLES_PAGO = [
  "Mismo propietario", "Usufructuario", "Seguro hogar", "Inquilino",
  "Comunidad", "Seguro vecino", "Propio vecino",
  "Empresa suministros", "Por definir", "Otro",
];

export const RESPONSABLES_GESTION = [
  "Mismo propietario", "Usufructuario", "Inquilino", "Seguro hogar", "Vecino", "Seguro vecino",
  "Comunidad", "Técnico", "Otro",
];

// Map origen → default causante
export const ORIGEN_TO_CAUSANTE: Record<string, string> = {
  "Avería propia de la vivienda": "Propietario",
  "Mal uso del inquilino": "Inquilino",
  "Vecino": "Vecino",
  "Elemento común de la comunidad": "Comunidad",
  "Suministro (agua, luz, gas)": "Pendiente de determinar",
  "Fenómeno externo": "Pendiente de determinar",
};

// Map origen → default responsable de pago
export const ORIGEN_TO_RESPONSABLE: Record<string, string> = {
  "Avería propia de la vivienda": "Mismo propietario",
  "Mal uso del inquilino": "Inquilino",
  "Vecino": "Seguro vecino",
  "Elemento común de la comunidad": "Comunidad",
  "Suministro (agua, luz, gas)": "Empresa suministros",
  "Fenómeno externo": "Seguro hogar",
};

// Map origen → default ¿Quién lo gestiona?
export const ORIGEN_TO_GESTION: Record<string, string> = {
  "Avería propia de la vivienda": "Mismo propietario",
  "Mal uso del inquilino": "Mismo propietario",
  "Vecino": "Seguro vecino",
  "Elemento común de la comunidad": "Comunidad",
  "Suministro (agua, luz, gas)": "Técnico",
  "Fenómeno externo": "Seguro hogar",
};

export const PRIORIDADES = [
  { value: 1, label: "Baja", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: 2, label: "Media", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: 3, label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: 4, label: "Urgente", color: "bg-red-100 text-red-700 border-red-200" },
];

// Time slot options for selectors
export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

export const TIPOS_AFECTADO = [
  "Propietario", "Inquilino", "Vecino", "Comunidad", "Otro",
];

export const ROLES_AFECTADO = [
  "Afectado", "Origen", "Implicado", "Responsable", "Otro",
];

export function useIncidencias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: incidencias = [], isLoading: loading } = useQuery({
    queryKey: ["incidencias", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any).from("incidencias")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Incidencia[];
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["incidencias", user?.id] });

  const createMut = useMutation({
    mutationFn: async (d: Partial<Incidencia>) => {
      if (!user) throw new Error("No user");
      const { data, error } = await (supabase as any).from("incidencias")
        .insert({ ...d, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Incidencia;
    },
    onSuccess: () => { toast({ title: "Incidencia creada" }); invalidate(); },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: Partial<Incidencia> }) => {
      const { error } = await (supabase as any).from("incidencias").update(d).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Incidencia actualizada" }); invalidate(); },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("incidencias")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Movida a la papelera", description: "Puedes restaurarla durante 30 días." }); invalidate(); },
    onError: (e: any) => { toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const createIncidencia = async (d: Partial<Incidencia>): Promise<Incidencia | null> => {
    try { return await createMut.mutateAsync(d); } catch { return null; }
  };
  const updateIncidencia = async (id: string, d: Partial<Incidencia>) => {
    try { await updateMut.mutateAsync({ id, d }); } catch {}
  };
  const deleteIncidencia = async (id: string) => {
    try { await deleteMut.mutateAsync(id); } catch {}
  };

  // Mensajes
  const fetchMensajes = async (incidenciaId: string): Promise<IncidenciaMensaje[]> => {
    const { data } = await (supabase as any).from("incidencia_mensajes")
      .select("*").eq("incidencia_id", incidenciaId).order("created_at", { ascending: true });
    return data || [];
  };
  const createMensaje = async (incidenciaId: string, autor: string, mensaje: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("incidencia_mensajes")
      .insert({ incidencia_id: incidenciaId, user_id: user.id, autor, mensaje });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };
  const updateMensaje = async (id: string, mensaje: string) => {
    const { error } = await (supabase as any).from("incidencia_mensajes").update({ mensaje }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };
  const deleteMensaje = async (id: string) => {
    const { error } = await (supabase as any).from("incidencia_mensajes").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  // Evidencias
  const fetchEvidencias = async (incidenciaId: string): Promise<IncidenciaEvidencia[]> => {
    const { data } = await (supabase as any).from("incidencia_evidencias")
      .select("*").eq("incidencia_id", incidenciaId).order("created_at", { ascending: true });
    return data || [];
  };
  const uploadEvidencia = async (incidenciaId: string, file: File): Promise<IncidenciaEvidencia | null> => {
    if (!user) return null;
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "evidence", toast)) return null;
    const path = `${user.id}/${incidenciaId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("incidencia-archivos").upload(path, file);
    if (upErr) { toast({ title: "Error subiendo archivo", description: upErr.message, variant: "destructive" }); return null; }
    const { data: urlData } = await supabase.storage
      .from("incidencia-archivos")
      .createSignedUrl(path, 3600);
    const { data, error } = await (supabase as any).from("incidencia_evidencias")
      .insert({ incidencia_id: incidenciaId, user_id: user.id, nombre_archivo: file.name, storage_path: path, url: urlData?.signedUrl || "" })
      .select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    return data;
  };
  const deleteEvidencia = async (ev: IncidenciaEvidencia) => {
    await supabase.storage.from("incidencia-archivos").remove([ev.storage_path]);
    await (supabase as any).from("incidencia_evidencias").delete().eq("id", ev.id);
  };

  // Citaciones
  const fetchCitaciones = async (incidenciaId: string): Promise<IncidenciaCitacion[]> => {
    const { data } = await (supabase as any).from("incidencia_citaciones")
      .select("*").eq("incidencia_id", incidenciaId).order("fecha_hora", { ascending: true });
    return data || [];
  };
  const createCitacion = async (incidenciaId: string, d: Partial<IncidenciaCitacion>) => {
    if (!user) return;
    const { error } = await (supabase as any).from("incidencia_citaciones")
      .insert({ ...d, incidencia_id: incidenciaId, user_id: user.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };
  const updateCitacion = async (id: string, d: Partial<IncidenciaCitacion>) => {
    const { error } = await (supabase as any).from("incidencia_citaciones").update(d).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };
  const deleteCitacion = async (id: string) => {
    const { error } = await (supabase as any).from("incidencia_citaciones").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  // Documentos
  const fetchDocumentos = async (incidenciaId: string) => {
    const { data } = await (supabase as any).from("incidencia_documentos")
      .select("*").eq("incidencia_id", incidenciaId).order("created_at", { ascending: true });
    return data || [];
  };
  const uploadDocumento = async (incidenciaId: string, file: File, categoria: string) => {
    if (!user) return null;
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "document", toast)) return null;
    const path = `${user.id}/${incidenciaId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("incidencia-documentos").upload(path, file);
    if (upErr) { toast({ title: "Error subiendo documento", description: upErr.message, variant: "destructive" }); return null; }
    const { data: urlData } = await supabase.storage
      .from("incidencia-documentos")
      .createSignedUrl(path, 3600);
    const { data, error } = await (supabase as any).from("incidencia_documentos")
      .insert({ incidencia_id: incidenciaId, user_id: user.id, nombre_archivo: file.name, storage_path: path, url: urlData?.signedUrl || "", categoria })
      .select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    return data;
  };
  const deleteDocumento = async (doc: { id: string; storage_path: string }) => {
    await supabase.storage.from("incidencia-documentos").remove([doc.storage_path]);
    await (supabase as any).from("incidencia_documentos").delete().eq("id", doc.id);
  };

  return {
    incidencias, loading,
    createIncidencia, updateIncidencia, deleteIncidencia,
    fetchMensajes, createMensaje, updateMensaje, deleteMensaje,
    fetchEvidencias, uploadEvidencia, deleteEvidencia,
    fetchCitaciones, createCitacion, updateCitacion, deleteCitacion,
    fetchDocumentos, uploadDocumento, deleteDocumento,
  };
}
