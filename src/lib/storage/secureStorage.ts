import { supabase } from "@/integrations/supabase/client";

/**
 * Sprint 4.1B — Seguridad documental.
 *
 * Buckets que contienen documentos patrimoniales sensibles. Deben servirse
 * SIEMPRE mediante URLs firmadas (createSignedUrl), nunca con `getPublicUrl`.
 *
 * Si necesitas añadir un bucket sensible nuevo, añádelo aquí y deja el bucket
 * privado en Storage. El guard test (`src/__tests__/security/no-public-sensitive-bucket.test.ts`)
 * fallará si alguien introduce `getPublicUrl("<bucket sensible>")` en el código.
 */
export const SENSITIVE_BUCKETS = [
  "facturas",
  "contratos",
  "incidencia-documentos",
  "incidencia-archivos",
  "inquilino-documentos",
  "documentos",
] as const;

export type SensitiveBucket = typeof SENSITIVE_BUCKETS[number];

export function isSensitiveBucket(bucket: string | null | undefined): boolean {
  if (!bucket) return false;
  return (SENSITIVE_BUCKETS as readonly string[]).includes(bucket);
}

// Cache simple por (bucket|path) durante la vida de la pestaña, con TTL inferior a la duración de la firma.
const SIGNED_TTL_SECONDS = 3600;
const SIGNED_CACHE_MS = (SIGNED_TTL_SECONDS - 60) * 1000;
const cache = new Map<string, { url: string; exp: number }>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}|${path}`;
}

/**
 * Devuelve una URL firmada (1h) para un objeto en un bucket privado.
 * Para buckets públicos no sensibles cae a `getPublicUrl`.
 * Para extraer un path desde una URL legacy, ver `inferStoragePathFromUrl`.
 */
export async function resolveStorageUrl(
  bucket: string,
  path: string,
): Promise<string | null> {
  if (!bucket || !path) return null;
  const key = cacheKey(bucket, path);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;

  if (isSensitiveBucket(bucket)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn("[secureStorage] createSignedUrl failed", bucket, path, error);
      return null;
    }
    cache.set(key, { url: data.signedUrl, exp: Date.now() + SIGNED_CACHE_MS });
    return data.signedUrl;
  }

  // Buckets públicos (ej. property-photos): URL pública directa.
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) return null;
  cache.set(key, { url: data.publicUrl, exp: Date.now() + SIGNED_CACHE_MS });
  return data.publicUrl;
}

/**
 * Intenta extraer `{bucket, path}` desde una URL legacy de Supabase Storage
 * (`/storage/v1/object/public/<bucket>/<path>` o `/sign/<bucket>/<path>`).
 * Devuelve `null` si no es una URL reconocible.
 */
export function inferStoragePathFromUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export interface OpenSecureFileInput {
  bucket?: string | null;
  path?: string | null;
  /** URL legacy almacenada (público o firmada caducada). Se usa como último recurso. */
  fallbackUrl?: string | null;
}

/**
 * Abre en una pestaña nueva un fichero almacenado. Resuelve la URL firmada al
 * vuelo (los URLs guardados en BD pueden estar caducados o ser públicos antes
 * de la privatización de buckets).
 */
export async function openSecureFile(input: OpenSecureFileInput): Promise<void> {
  let bucket = input.bucket || null;
  let path = input.path || null;

  if ((!bucket || !path) && input.fallbackUrl) {
    const inferred = inferStoragePathFromUrl(input.fallbackUrl);
    if (inferred) {
      bucket = bucket || inferred.bucket;
      path = path || inferred.path;
    }
  }

  if (bucket && path) {
    const url = await resolveStorageUrl(bucket, path);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
  }

  if (input.fallbackUrl) {
    window.open(input.fallbackUrl, "_blank", "noopener,noreferrer");
    return;
  }

  console.warn("[secureStorage] openSecureFile sin destino válido", input);
}

/** Atajo: firma o devuelve la URL pública, sin abrirla. */
export async function getStorageUrl(
  bucket: string,
  path: string,
): Promise<string> {
  const url = await resolveStorageUrl(bucket, path);
  return url || "";
}

/** Limpia el cache (útil tras eliminar/renombrar un objeto). */
export function invalidateStorageUrl(bucket: string, path: string) {
  cache.delete(cacheKey(bucket, path));
}
