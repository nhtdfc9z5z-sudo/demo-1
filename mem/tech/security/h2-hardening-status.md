---
name: H2 Hardening Status
description: Estado del hardening backend tras Sprint 3. Qué está cerrado, qué queda pendiente y por qué.
type: feature
---

## Cerrado en H2.4

- `REVOKE EXECUTE` público en triggers y helpers DB-only: `notify_nueva_incidencia`, `notify_vencimiento_contrato`, `notify_pago_notificado`, `set_incidencia_owner_from_property`, `handle_new_user`, `update_updated_at_column`, `set_numero_incidencia`, `validate_proveedor_valoracion`.
- `link_tenant_auth(text)`: revocada a `anon`, mantenida en `authenticated` (RPC portal inquilino).
- `has_role(uuid, app_role)`: **mantener accesible**, la usan políticas RLS.
- Leaked Password Protection (HIBP) activado en H1.

## Pendiente (NO tocar sin sprint propio)

H2.2 — Privatización de buckets: bloqueada porque la app usa `getPublicUrl` en ~15 puntos sensibles (inquilino-documentos, facturas, contratos, incidencia-documentos, incidencia-archivos). Privatizar ahora rompe descargas en propietario y portal inquilino.

Requisitos previos antes de privatizar:
1. Helper único `getPrivateDocUrl(bucket, path)` con `createSignedUrl(path, 3600)`.
2. Refactor de los 15 callsites (`useInquilinos`, `useFacturas`, `useContratos` ×2, `useIncidencias` ×2, `PropertyDocumentacionView`, `CEESection`, `GeneradorContrato`, `InventarioSection` fallback, `DocumentosSection` portal inquilino, `inventarioUtils`, `contractDocumentUtils`).
3. QA propietario + portal inquilino antes de `UPDATE storage.buckets SET public = false`.
4. `property-photos` se queda público (se renderiza en `<img>` directos en tarjetas).

## Warnings linter restantes (8)

- 5 × Public Bucket Allows Listing → pendiente H2.2.
- 2 × `has_role` accesible → intencional (RLS).
- 1 × `link_tenant_auth` accesible para authenticated → intencional (RPC).
