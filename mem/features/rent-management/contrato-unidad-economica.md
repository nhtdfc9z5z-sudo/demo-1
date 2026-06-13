---
name: Contrato como unidad económica única
description: Sprint 3.7. Clave canónica de pagos_renta = (contrato_id, mes, anio). No duplicar deuda por inquilinos solidarios.
type: feature
---
- `pagos_renta` está claveada por `(contrato_id, mes, anio)` vía `pagos_renta_contrato_periodo_unique`. La legacy `(property,inquilino,mes,anio)` queda como `@deprecated`.
- Trigger `require_contrato_id_on_pagos_renta` bloquea cualquier INSERT/UPDATE sin `contrato_id`.
- 1 pago canónico por contrato/mes. `pagos_renta.inquilino_id` solo identifica al pagador real (trazabilidad), no es clave económica.
- Modalidad `completo`: N inquilinos solidarios = 1 deuda y 1 pago. Modalidad `habitaciones`: 1 deuda y 1 pago por subcontrato.
- Helper único de resolución: `src/lib/altas/resolverContratoParaPago.ts` → `resolverContratoIdParaPago`. Lo usa `usePagosRenta` para inferir `contrato_id` si el caller no lo aporta.
- `usePagosRenta` upsertea siempre con `ON_CONFLICT_CONTRATO = "contrato_id,mes,anio"`.
- Guard: `src/lib/__tests__/pagosRentaOnConflict.guard.test.ts` bloquea cualquier reintroducción del onConflict legacy.
- Tests producto: `src/lib/__tests__/contratoUnidadEconomica.test.ts` (5 escenarios pactados con el usuario).
- Backfill 03/2026: 1 pago legacy de 2500€ sigue sin contrato (auditado en `error_logs` con event `pagos_renta.legacy_sin_contrato`). Requiere asignación manual.
- `pagosDedupe.ts` queda como red defensiva mientras telemetría no llegue a 0 en `legacy_fase4_dedupes` durante 30 días. Marcar `removable` y borrar en sprint siguiente.
