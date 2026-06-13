import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentos } from "./useDocumentos";
import { useContratos } from "./useContratos";
import { useProperties } from "./useProperties";
import { useInquilinos } from "./useInquilinos";
import { usePagosRenta } from "./usePagosRenta";
import { useAuditoriaHallazgos } from "./useAuditoriaHallazgos";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import {
  generarRecordatorios,
  type RecordatorioCandidato,
  type RecordatorioTipo,
  type RecordatorioOrigenTipo,
} from "@/lib/recordatorios/generador";

export type RecordatorioEstado = "pendiente" | "completado" | "descartado";

export interface Recordatorio {
  id: string;
  user_id: string;
  tipo: RecordatorioTipo;
  origen_tipo: RecordatorioOrigenTipo;
  origen_id: string;
  titulo: string;
  descripcion: string | null;
  fecha_objetivo: string | null;
  prioridad: number;
  estado: RecordatorioEstado;
  completado_at: string | null;
  descartado_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sprint 4.3 — Bandeja de tareas pendientes.
 * Lee datos de varios hooks, llama al generador puro y persiste los
 * candidatos nuevos. La unicidad real la garantiza el índice parcial
 * `recordatorios_unique_pendiente`; aquí evitamos llamadas inútiles.
 * No envía emails, push ni WhatsApp.
 */
export function useRecordatorios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { documentos } = useDocumentos({ limit: 500 });
  const { contratos } = useContratos();
  const { properties } = useProperties();
  const { inquilinos } = useInquilinos();
  const { pagos } = usePagosRenta({ userId: user?.id, asOwner: true });
  const { hallazgos } = useAuditoriaHallazgos();

  // Tramos de renta_actualizaciones por contrato_id, para dedupe de avisos
  // de anualidad ("ya aplicaste IPC este año → no avisar").
  const actualizacionesQ = useQuery({
    queryKey: ["renta_actualizaciones", "by-contrato", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("renta_actualizaciones")
        .select("contrato_id, fecha_efectiva")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as Array<{
        contrato_id: string | null;
        fecha_efectiva: string;
      }>;
    },
  });

  const list = useQuery({
    queryKey: ["recordatorios", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async (): Promise<Recordatorio[]> => {
      const { data, error } = await (supabase as any)
        .from("recordatorios")
        .select("*")
        .eq("user_id", user!.id)
        .order("prioridad", { ascending: true })
        .order("fecha_objetivo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Recordatorio[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recordatorios"] });

  // ---- Generación: candidatos a partir del estado actual.
  const candidatos = useMemo<RecordatorioCandidato[]>(() => {
    if (!user) return [];
    return generarRecordatorios({
      documentos: documentos.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        ocr_status: d.ocr_status,
        fecha_vencimiento: d.fecha_vencimiento,
      })),
      contratos: contratos.map((c: any) => ({
        id: c.id,
        titulo: c.titulo,
        fecha_inicio: c.fecha_inicio,
        fecha_fin: c.fecha_fin,
        estado: c.estado,
        prorroga_anos: c.prorroga_anos,
        renovacion_automatica: c.renovacion_automatica,
        renovacion_confirmada_at: c.renovacion_confirmada_at,
      })),
      properties: properties.map((p) => ({ id: p.id, nombre_interno: p.nombre_interno })),
      inquilinos: inquilinos.map((i) => ({
        id: i.id,
        property_id: i.property_id!,
        rol_inquilino: i.rol_inquilino,
      })),
      pagos: pagos.map((p) => ({
        property_id: p.property_id!,
        mes: p.mes,
        anio: p.anio,
        importe_pagado: p.importe_pagado,
        propietario_confirmado: p.propietario_confirmado,
      })),
      hallazgos: hallazgos.map((h) => ({ id: h.id, tipo: h.tipo, titulo: h.titulo })),
      resolveRentaEsperada: (id) => resolveRentaEsperada(id, inquilinos, contratos as any) || 0,
      rentaActualizaciones: actualizacionesQ.data || [],
    });
  }, [user, documentos, contratos, properties, inquilinos, pagos, hallazgos, actualizacionesQ.data]);

  // ---- Sync: inserta sólo lo que no existe como pendiente en BD.
  const synced = useRef<string>("");
  useEffect(() => {
    if (!user || !list.data) return;
    const key = `${candidatos.length}|${list.data.length}|${candidatos.map((c) => c.origen_id).join(",")}`;
    if (synced.current === key) return;

    const pendientesDB = new Set(
      list.data
        .filter((r) => r.estado === "pendiente")
        .map((r) => `${r.tipo}|${r.origen_tipo}|${r.origen_id}`),
    );
    const nuevos = candidatos.filter(
      (c) => !pendientesDB.has(`${c.tipo}|${c.origen_tipo}|${c.origen_id}`),
    );
    if (nuevos.length === 0) {
      synced.current = key;
      return;
    }
    (supabase as any)
      .from("recordatorios")
      .insert(nuevos.map((c) => ({ ...c, user_id: user.id })))
      .then(({ error }: { error: any }) => {
        // Errores de unicidad (alguien ya lo insertó) se ignoran.
        if (error && !String(error.message).toLowerCase().includes("duplicate")) {
          console.warn("[recordatorios] sync error", error);
        }
        synced.current = key;
        invalidate();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, candidatos, list.data]);

  const completar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("recordatorios")
        .update({ estado: "completado", completado_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Marcado como hecho" });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo completar", description: e?.message, variant: "destructive" }),
  });

  const descartar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("recordatorios")
        .update({ estado: "descartado", descartado_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Descartado" });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo descartar", description: e?.message, variant: "destructive" }),
  });

  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("recordatorios")
        .update({ estado: "pendiente", completado_at: null, descartado_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    recordatorios: list.data || [],
    loading: list.isLoading,
    completar,
    descartar,
    reabrir,
  };
}