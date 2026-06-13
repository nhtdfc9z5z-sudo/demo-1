/**
 * Raw insert helpers — the SINGLE funnel for writes to the three core tables.
 *
 * Every code path (typed altas functions, hooks, OCR flows, wizards, scripts)
 * MUST go through one of these. Direct `supabase.from("properties"|...).insert(...)`
 * outside `src/lib/altas/` is forbidden and guarded by a test
 * (see `src/lib/altas/__tests__/no-direct-inserts.test.ts`).
 *
 * These helpers are intentionally permissive (`Record<string, unknown>`) so the
 * many legacy columns of `properties` keep working while we migrate the rest of
 * the codebase. The typed `crearActivo` / `crearInquilino` / `crearContrato`
 * sit on top and provide the strict, documented surface for new code.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatDireccion, type DireccionEstructurada } from "@/lib/direccion/formatDireccion";

async function requireUser(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Necesitas iniciar sesión.");
  return user.id;
}

/**
 * Recompute `direccion_completa` from structured fields when any of them are
 * present in the payload. If the caller already provides `direccion_completa`,
 * it is overwritten — we always trust the structured fields as source of truth.
 */
function withDireccionCompleta<T extends Record<string, unknown>>(row: T): T {
  const structuralKeys = [
    "tipo_via", "nombre_via", "numero", "portal", "escalera", "bloque",
    "urbanizacion", "parcela", "planta", "puerta",
    "codigo_postal", "ciudad", "municipio", "provincia", "pais",
  ];
  const hasAny = structuralKeys.some((k) => row[k] != null && row[k] !== "");
  if (!hasAny) return row;
  const d: DireccionEstructurada = {
    tipo_via: row.tipo_via as string | null,
    nombre_via: row.nombre_via as string | null,
    numero: row.numero as string | null,
    portal: row.portal as string | null,
    escalera: row.escalera as string | null,
    bloque: row.bloque as string | null,
    urbanizacion: row.urbanizacion as string | null,
    parcela: row.parcela as string | null,
    planta: row.planta as string | null,
    puerta: row.puerta as string | null,
    codigo_postal: row.codigo_postal as string | null,
    municipio: (row.municipio as string | null) ?? (row.ciudad as string | null),
    ciudad: row.ciudad as string | null,
    provincia: row.provincia as string | null,
    pais: row.pais as string | null,
  };
  const completa = formatDireccion(d);
  if (!completa) return row;
  return { ...row, direccion_completa: completa } as T;
}

// ───────── PROPERTIES ─────────

export async function insertPropertyRow(
  row: Record<string, unknown>,
): Promise<{ id: string } & Record<string, unknown>> {
  const user_id = await requireUser();
  const payload = withDireccionCompleta({ ...row, user_id });
  const { data, error } = await supabase
    .from("properties")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as { id: string } & Record<string, unknown>;
}

// ───────── INQUILINOS ─────────

export async function insertInquilinoRow(
  row: Record<string, unknown>,
): Promise<{ id: string } & Record<string, unknown>> {
  const user_id = await requireUser();
  const payload = { ...row, user_id, nombre: (row.nombre as string) || "Sin nombre" };
  const { data, error } = await supabase
    .from("inquilinos")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as { id: string } & Record<string, unknown>;
}

// ───────── CONTRATOS ─────────

export async function insertContratoRow(
  row: Record<string, unknown>,
  options?: { vincularInquilinos?: string[] },
): Promise<{ id: string } & Record<string, unknown>> {
  const user_id = await requireUser();
  const payload = {
    ...row,
    user_id,
    titulo: (row.titulo as string) || "Contrato de arrendamiento",
  };
  const { data, error } = await supabase
    .from("contratos_arrendamiento")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  const contrato = data as { id: string } & Record<string, unknown>;

  // Optionally link tenants in contrato_personas as arrendataria parte.
  const inquilinoIds = (options?.vincularInquilinos ?? []).filter(Boolean);
  if (inquilinoIds.length > 0) {
    // contrato_personas.nombre es NOT NULL; recuperamos nombre/dni/email/telefono
    // del inquilino vinculado para satisfacer el schema y evitar inserts parciales.
    const { data: inquilinosData, error: iErr } = await supabase
      .from("inquilinos")
      .select("id, nombre, dni, email, telefono")
      .in("id", inquilinoIds);
    if (iErr) {
      await supabase.from("contratos_arrendamiento").delete().eq("id", contrato.id);
      throw iErr;
    }
    const byId = new Map(
      (inquilinosData ?? []).map((i: any) => [i.id as string, i]),
    );
    const propertyId =
      (contrato.property_id as string | undefined) ??
      (row.property_id as string | undefined) ??
      null;
    const personas = inquilinoIds.map((iid, idx) => {
      const inq = byId.get(iid) as
        | { nombre?: string; dni?: string; email?: string; telefono?: string }
        | undefined;
      return {
        user_id,
        property_id: propertyId,
        contrato_id: contrato.id,
        inquilino_id: iid,
        nombre: inq?.nombre?.trim() || "Inquilino",
        dni: inq?.dni ?? null,
        email: inq?.email ?? null,
        telefono: inq?.telefono ?? null,
        parte: "arrendataria",
        rol: idx === 0 ? "titular_principal" : "cotitular",
        porcentaje_participacion: 100 / inquilinoIds.length,
      };
    });
    const { error: pErr } = await supabase
      .from("contrato_personas")
      .insert(personas as never);
    if (pErr) {
      // best-effort rollback
      await supabase.from("contratos_arrendamiento").delete().eq("id", contrato.id);
      throw pErr;
    }
  }

  return contrato;
}

// ───────── SUBACTIVOS (habitaciones, garajes, trasteros, oficinas,
//                       locales_naves, terrenos, edificios) ─────────

/**
 * Tablas patrimoniales que representan subtipos de activo y que, igual que
 * `properties`, sólo pueden recibir inserciones a través del motor de altas.
 */
export const SUBACTIVO_TABLES = [
  "habitaciones",
  "garajes",
  "trasteros",
  "oficinas",
  "locales_naves",
  "terrenos",
  "edificios",
] as const;

export type SubactivoTable = (typeof SUBACTIVO_TABLES)[number];

/**
 * Inserta una fila en una tabla de subactivo patrimonial. Aplica los mismos
 * principios que `insertPropertyRow`: requiere sesión, inyecta `user_id` y
 * recalcula `direccion_completa` desde los campos estructurados.
 */
export async function insertSubactivoRow(
  table: SubactivoTable,
  row: Record<string, unknown>,
): Promise<{ id: string } & Record<string, unknown>> {
  const user_id = await requireUser();
  const payload = withDireccionCompleta({ ...row, user_id });
  const { data, error } = await supabase
    .from(table as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as { id: string } & Record<string, unknown>;
}