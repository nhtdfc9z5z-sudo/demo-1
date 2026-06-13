/**
 * Sincroniza la tabla `notifications` a partir de los recordatorios
 * urgentes (prioridad <= 2) ya persistidos en `recordatorios`.
 *
 * Función pura de construcción + un único punto de inserción.
 * Deduplica: no inserta si ya existe una notificación del mismo
 * recordatorio (mismo origen_id, marcado en `enlace`) en las últimas 24h.
 *
 * No envía emails, push, ni WhatsApp. Solo escribe en `notifications`.
 */

import type { Recordatorio } from "@/hooks/useRecordatorios";
import type { Notification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";

const VENTANA_DEDUPE_MS = 24 * 60 * 60 * 1000;
const PRIORIDAD_MAXIMA = 2; // 1 = más urgente, 2 = urgente.

/**
 * Cortafuegos en memoria por sesión: evita que dos llamadas concurrentes
 * (ej. dos useEffect seguidos a 250 ms) inserten la misma notificación
 * antes de que la primera respuesta refresque `notificacionesExistentes`.
 * El índice único en BD (`notifications_user_enlace_recordatorio_uniq`)
 * es la garantía final; esto es solo optimización.
 */
const enlacesEnVuelo = new Set<string>();

export type NotificacionRefTipo =
  | "pago_renta"
  | "contrato_renovacion"
  | "contrato_revision"
  | "documento"
  | "auditoria";

export interface NotificacionCandidata {
  tipo: "pago" | "contrato" | "info";
  titulo: string;
  mensaje: string;
  referencia_id: string | null;
  referencia_tipo: NotificacionRefTipo | null;
  /** Clave de dedupe interna: `recordatorio:<origen_id>` */
  enlace: string;
}

export interface PropertyLite {
  id: string;
  nombre_interno: string | null;
}

/**
 * Devuelve el UUID base de la entidad a partir del `origen_id` del
 * recordatorio. Si el `origen_id` ya es un UUID lo devuelve tal cual;
 * si tiene la forma `<uuid>:...` se queda con la parte anterior al `:`.
 */
function entidadUuid(origenId: string): string | null {
  const base = origenId.includes(":") ? origenId.split(":")[0] : origenId;
  // validación laxa de UUID v4
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) {
    return null;
  }
  return base;
}

function nombreActivo(propertyId: string | null, properties: PropertyLite[]): string {
  if (!propertyId) return "Activo";
  return properties.find((p) => p.id === propertyId)?.nombre_interno || "Activo";
}

/**
 * Construye los candidatos a notificación a partir de los recordatorios
 * urgentes y los deduplica contra las notificaciones existentes recientes.
 * Pura: no toca Supabase. Útil para tests.
 */
export function construirNotificacionesDesdeRecordatorios(
  recordatorios: Recordatorio[],
  notificacionesExistentes: Notification[],
  properties: PropertyLite[],
  now: Date = new Date(),
): NotificacionCandidata[] {
  const enlacesRecientes = new Set(
    notificacionesExistentes
      .filter((n) => {
        if (!n.enlace?.startsWith("recordatorio:")) return false;
        const created = new Date(n.created_at).getTime();
        return now.getTime() - created < VENTANA_DEDUPE_MS;
      })
      .map((n) => n.enlace as string),
  );

  const out: NotificacionCandidata[] = [];

  for (const r of recordatorios) {
    if (r.estado !== "pendiente") continue;
    if ((r.prioridad ?? 99) > PRIORIDAD_MAXIMA) continue;
    if (!r.origen_id) continue;

    const dedupeKey = `recordatorio:${r.origen_id}`;
    if (enlacesRecientes.has(dedupeKey)) continue;

    const entidad = entidadUuid(r.origen_id);

    switch (r.tipo) {
      case "renta_pendiente": {
        const activo = nombreActivo(entidad, properties);
        out.push({
          tipo: "pago",
          titulo: `Renta pendiente · ${activo}`,
          mensaje: r.descripcion || r.titulo,
          referencia_id: entidad,
          referencia_tipo: "pago_renta",
          enlace: dedupeKey,
        });
        break;
      }
      case "contrato_vence": {
        out.push({
          tipo: "contrato",
          titulo: "Contrato próximo a renovarse",
          mensaje: r.descripcion || r.titulo,
          referencia_id: entidad,
          referencia_tipo: "contrato_renovacion",
          enlace: dedupeKey,
        });
        break;
      }
      case "revision_renta_anualidad": {
        out.push({
          tipo: "contrato",
          titulo: "Revisión de renta",
          mensaje: r.descripcion || r.titulo,
          referencia_id: entidad,
          referencia_tipo: "contrato_revision",
          enlace: dedupeKey,
        });
        break;
      }
      case "renovacion_sugerida": {
        out.push({
          tipo: "contrato",
          titulo: "Renovación pendiente",
          mensaje: r.descripcion || r.titulo,
          referencia_id: entidad,
          referencia_tipo: "contrato_renovacion",
          enlace: dedupeKey,
        });
        break;
      }
      case "documento_vencido":
      case "documento_vence_pronto": {
        out.push({
          tipo: "info",
          titulo: r.tipo === "documento_vencido" ? "Documento vencido" : "Documento por vencer",
          mensaje: r.descripcion || r.titulo,
          referencia_id: entidad,
          referencia_tipo: "documento",
          enlace: dedupeKey,
        });
        break;
      }
      default:
        // ocr_fallido, auditoria_hallazgo y otros se omiten de la campanita.
        break;
    }
  }

  return out;
}

/**
 * Ejecuta la sincronización: construye candidatos y los inserta en
 * `notifications`. Devuelve cuántas se insertaron.
 */
export async function sincronizarNotificaciones(params: {
  userId: string;
  recordatorios: Recordatorio[];
  notificacionesExistentes: Notification[];
  properties: PropertyLite[];
}): Promise<number> {
  const { userId, recordatorios, notificacionesExistentes, properties } = params;
  const candidatos = construirNotificacionesDesdeRecordatorios(
    recordatorios,
    notificacionesExistentes,
    properties,
  );
  // Filtra candidatos ya disparados desde otra ejecución concurrente.
  const frescos = candidatos.filter((c) => !enlacesEnVuelo.has(c.enlace));
  if (frescos.length === 0) return 0;
  frescos.forEach((c) => enlacesEnVuelo.add(c.enlace));

  const rows = frescos.map((c) => ({
    user_id: userId,
    tipo: c.tipo,
    titulo: c.titulo,
    mensaje: c.mensaje,
    referencia_id: c.referencia_id,
    referencia_tipo: c.referencia_tipo,
    enlace: c.enlace,
  }));

  // upsert con onConflict sobre el índice único parcial: si otra sesión
  // ya insertó la misma notificación, no falla ni duplica.
  const { data, error } = await (supabase as any)
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,enlace", ignoreDuplicates: true })
    .select("id");
  // Liberamos la marca tras ~24h (ventana de dedupe).
  setTimeout(() => {
    rows.forEach((r) => enlacesEnVuelo.delete(r.enlace));
  }, VENTANA_DEDUPE_MS);
  if (error) {
    console.warn("[notificaciones] sync error", error);
    return 0;
  }
  return (data?.length ?? 0) as number;
}