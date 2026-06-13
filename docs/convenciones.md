# Convenciones CapitalRent

Documento vivo. Cualquier cambio debe consensuarse antes de mergear.
Última revisión: Sprint 2.5 (2026-05-26).

## 1. Naming de hooks

- `useXxx` para hooks de UI/composición (`useFiscalData`, `useContratosVigentes`).
- `useXxxQuery` reservado para hooks que devuelven **directamente** un `UseQueryResult` (poco habitual; preferir wrappers).
- `useXxxMutation` igual, solo para wrappers directos sobre `useMutation`.
- Hooks de datos vía React Query: pueden devolver `{ data, isLoading, create, update, delete, ... }` y exponer su propia API. Aceptable y preferido.
- Hooks de fuentes fiscales: prefijo `useFiscal*` (`useFiscalSources`, `useFiscalData`).

## 2. Query keys (React Query)

Forma canónica: array tipado y ordenado de más general a más específico.

| Entidad             | Key                                          |
| ------------------- | -------------------------------------------- |
| Contratos           | `["contratos", userId]`                      |
| Contrato (uno)      | `["contratos", userId, contratoId]`          |
| Personas contrato   | `["contrato-personas", contratoId, userId]`  |
| Personas (todas)    | `["contrato-personas", "all", userId]`       |
| Pagos renta         | `["pagos_renta", userId]`                    |
| Gastos              | `["gastos", userId, propertyId?]`            |
| Facturas            | `["facturas", userId]`                       |
| Inquilinos          | `["inquilinos", userId]`                     |
| Properties          | `["properties", userId]`                     |
| Fiscal sources      | `["fiscal-sources", userId, anio]`           |
| Fiscal data         | `["fiscal-data", userId, anio]`              |
| Fiscal pack         | `["fiscal-pack", userId, anio, ownerKey?]`   |

Reglas:
- Primer elemento siempre el **nombre de entidad en plural y kebab-case** (o snake_case si la tabla lo es).
- `userId` SIEMPRE presente (excepto query keys anónimas, que no existen aquí).
- Filtros adicionales al final.
- Las invalidaciones cruzadas pasan por `invalidateFiscalChain(qc)` en `src/lib/queryInvalidation.ts`. No invalidar a mano más de 2 keys.

## 3. Tipos fiscales

- Source of truth: `src/lib/fiscalPack.ts` (`OwnerFiscalPack`, `MinimalProperty`, `MinimalGasto`, `MinimalFactura`, `MinimalGastoFijoActivo`).
- `useFiscalData` SOLO compone, no calcula totales fiscales.
- `fiscalPack` SOLO consume datos ya normalizados; no hace I/O.
- Imputación al ejercicio: `fecha_devengo` prevalece sobre `fecha`.
- Porcentajes fiscales: `validarPorcentajesFiscales` en `contratoRoles.ts`. Estados: `ok | sin_personas | incompleto | excedido`. Solo advierten, nunca bloquean.

## 4. Entidades del dominio

| Concepto                        | Tabla                          |
| ------------------------------- | ------------------------------ |
| Activo (genérico)               | `properties` (y subtablas)     |
| Contrato vigente                | `contratos_arrendamiento`      |
| Personas del contrato           | `contrato_personas`            |
| Pagos de renta                  | `pagos_renta`                  |
| Gastos del activo               | `property_gastos`              |
| Facturas externas               | `facturas`                     |
| Incidencias                     | `incidencias`                  |
| Inquilinos (entidad persona)    | `inquilinos`                   |
| Auditoría de errores fiscales   | `error_logs`                   |
| Métricas de rendimiento         | `perf_metrics`                 |

Terminología UI: usar **Activo** (no inmueble/propiedad), **Renovación** (no vencimiento).

## 5. Carpetas

```text
src/
  components/        # UI React
    propietarios/    # módulo principal del owner
    ...
  hooks/             # hooks reactivos (React Query, estado local de UI)
  lib/               # lógica pura, sin React
    observability/   # Sentry + error_logs + perf_metrics
    ...
  integrations/      # SDKs externos (Supabase auto-generado)
  pages/             # rutas top-level
docs/                # documentación humana
supabase/            # migrations + edge functions
```

Reglas:
- `lib/` no importa de `hooks/`, `components/`, ni `pages/`.
- `hooks/` puede importar de `lib/` e `integrations/`.
- `components/` puede importar de todo lo anterior.

## 6. Helpers, DTOs y builders

- **Helpers**: funciones puras pequeñas, sufijos `Utils` o nombre directo (`fechaImputable`, `personaKey`). Viven en `src/lib/<tema>.ts`.
- **Builders fiscales**: funciones `buildXxx` (`buildOwnerPack`). Devuelven una estructura serializable. Sin side effects.
- **DTOs / tipos minimales**: prefijo `Minimal*` cuando son el contrato de entrada de un builder (`MinimalProperty`, `MinimalGasto`).
- **Validadores**: prefijo `validar*` (`validarPorcentajesFiscales`).
- **Engines**: clases o módulos que orquestan I/O + cálculo (`finanzasEngine`). Excepción al "lib es puro": engines pueden orquestar pero NO hacer fetch directo; reciben datos.

## 7. Observabilidad

- **Sentry** (`src/lib/observability/sentry.ts`): errores técnicos. Init silencioso si no hay `VITE_SENTRY_DSN`.
- **`error_logs`** (Supabase): auditoría fiscal/negocio. Usar `captureAppError({ audit: true })` solo en eventos relevantes para el propietario (fallo de export fiscal, fallo de build_owner_pack, incoherencias graves).
- **`perf_metrics`** (Supabase): solo eventos del núcleo: `build_owner_pack`, `export_fiscal_pdf`, `export_fiscal_excel`. Usar `measureSync` / `measureAsync`.
- Nunca persistir DNI, emails, IBANs, importes detallados, ni datos personales en `context`. El sanitizer ya filtra claves obvias, pero la responsabilidad es del que llama.
- Nunca romper la app si la captura falla.

## 8. Convenciones de migraciones

- Una migración = un cambio cohesionado.
- Toda tabla nueva en `public` requiere: `CREATE TABLE` + `GRANT` + `ENABLE RLS` + `CREATE POLICY` en el mismo archivo.
- `error_logs` y `perf_metrics` son inmutables desde la app (solo INSERT y SELECT, no UPDATE/DELETE).
- No usar `CHECK` con `now()`; usar triggers de validación.

## 9. Tests

- Tests unitarios: cada módulo en `src/lib/` con lógica no trivial debe tener `__tests__/<modulo>.test.ts`.
- Tests de integración fiscal (próximamente): escenarios completos `contrato + pagos + gastos + exportación` por año fiscal.
- Mantener 97/97 como mínimo absoluto antes de mergear.