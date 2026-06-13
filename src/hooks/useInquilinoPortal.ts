import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface InquilinoProfile {
  id: string;
  nombre: string;
  apellidos: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  property_id: string | null;
  fecha_entrada: string | null;
  fecha_salida: string | null;
  renta_mensual: number | null;
  fianza: number | null;
  estado: string | null;
  notas: string | null;
  tipo_inquilino: string | null;
}

export interface TenantProperty {
  id: string;
  nombre_interno: string;
  direccion_completa: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  tipo_vivienda: string | null;
  superficie_m2: number | null;
  num_habitaciones: number | null;
  num_banos: number | null;
}

export interface TenantIncidencia {
  id: string;
  numero_incidencia: number;
  concepto: string | null;
  estado: string | null;
  prioridad: number | null;
  fecha_hora_incidencia: string | null;
  created_at: string;
  direccion: string | null;
}

export function useInquilinoPortal() {
  const { user } = useAuth();
  const [inquilino, setInquilino] = useState<InquilinoProfile | null>(null);
  const [property, setProperty] = useState<TenantProperty | null>(null);
  const [incidencias, setIncidencias] = useState<TenantIncidencia[]>([]);
  const [rentaResuelta, setRentaResuelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<boolean | null>(null);

  const linkAndFetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Check if already linked
    const { data: existing } = await supabase
      .from("inquilinos")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existing) {
      setInquilino(existing as unknown as InquilinoProfile);
      setLinked(true);

      // Fetch incidencias for this tenant by inquilino_id (stable FK)
      const { data: inc } = await supabase
        .from("incidencias")
        .select("id, numero_incidencia, concepto, estado, prioridad, fecha_hora_incidencia, created_at, direccion")
        .eq("inquilino_id", existing.id)
        .order("created_at", { ascending: false });
      if (inc) setIncidencias(inc as unknown as TenantIncidencia[]);

      // Resolve renta from active contract (source of truth), fallback to inquilino legacy
      const { data: contrato } = await supabase
        .from("contratos_arrendamiento")
        .select("renta_mensual")
        .eq("inquilino_id", existing.id)
        .eq("archivado", false)
        .neq("estado", "finalizado")
        .not("renta_mensual", "is", null)
        .limit(1)
        .maybeSingle();
      setRentaResuelta(
        contrato?.renta_mensual != null
          ? Number(contrato.renta_mensual)
          : (existing.renta_mensual != null ? Number(existing.renta_mensual) : null)
      );

      if (existing.property_id) {
        const { data: prop } = await supabase
          .from("properties")
          .select("id, nombre_interno, direccion_completa, ciudad, provincia, codigo_postal, tipo_vivienda, superficie_m2, num_habitaciones, num_banos")
          .eq("id", existing.property_id)
          .maybeSingle();
        if (prop) setProperty(prop as unknown as TenantProperty);
      }
    } else {
      // Try to link by email
      const { data: result } = await supabase.rpc("link_tenant_auth", {
        p_email: user.email || "",
      });

      const res = result as unknown as { success: boolean; inquilino_id?: string; error?: string };
      if (res?.success) {
        setLinked(true);
        // Fetch the linked record
        const { data: linked } = await supabase
          .from("inquilinos")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (linked) {
          setInquilino(linked as unknown as InquilinoProfile);
          if (linked.property_id) {
            const { data: prop } = await supabase
              .from("properties")
              .select("id, nombre_interno, direccion_completa, ciudad, provincia, codigo_postal, tipo_vivienda, superficie_m2, num_habitaciones, num_banos")
              .eq("id", linked.property_id)
              .maybeSingle();
            if (prop) setProperty(prop as unknown as TenantProperty);
          }
        }
      } else {
        setLinked(false);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    linkAndFetch();
  }, [linkAndFetch]);

  const updateProfile = async (data: { email?: string; telefono?: string; nombre?: string; apellidos?: string }) => {
    if (!user || !inquilino) return;
    const { error } = await supabase
      .from("inquilinos")
      .update(data as any)
      .eq("auth_user_id", user.id);

    if (error) throw error;

    // If email changed, update auth email too
    if (data.email && data.email !== user.email) {
      await supabase.auth.updateUser({ email: data.email });
    }

    setInquilino(prev => prev ? { ...prev, ...data } : prev);
  };

  const createIncidencia = async (data: {
    concepto: string;
    direccion: string;
    inquilino_observaciones: string;
    prioridad: number;
    disponibilidad_parte_dia: string;
    disponibilidad_comentarios: string;
    fecha_hora_incidencia: string;
  }) => {
    if (!user || !inquilino) throw new Error("No tenant linked");

    const fullName = [inquilino.nombre, inquilino.apellidos].filter(Boolean).join(" ");

    const { error } = await supabase.from("incidencias").insert({
      user_id: user.id, // will be overridden by trigger to property owner
      property_id: inquilino.property_id,
      inquilino_id: inquilino.id,
      concepto: data.concepto,
      direccion: data.direccion,
      inquilino_nombre: fullName, // legacy, kept for display compatibility
      inquilino_telefono: inquilino.telefono,
      inquilino_email: inquilino.email,
      inquilino_observaciones: data.inquilino_observaciones || null,
      prioridad: data.prioridad,
      disponibilidad_parte_dia: data.disponibilidad_parte_dia || null,
      disponibilidad_comentarios: data.disponibilidad_comentarios || null,
      fecha_hora_incidencia: data.fecha_hora_incidencia || new Date().toISOString(),
      estado: "Abierta",
    } as any);

    if (error) throw error;
    await linkAndFetch(); // refresh
  };

  return { inquilino, property, incidencias, loading, linked, rentaResuelta, updateProfile, createIncidencia, refetch: linkAndFetch };
}
