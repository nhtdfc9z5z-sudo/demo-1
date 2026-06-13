---
name: Sprint 3 — modelo económico por contrato
description: Cierre Sprint 3. Pagos agrupados por contrato_id, modalidad_alquiler completo/habitaciones, backfill auditado, vista de reconciliación, bloqueo de pago único en completo, telemetría del deduper Fase 4.
type: feature
---

**Fuente de verdad económica**: `pagos_renta.contrato_id` + `contratos_arrendamiento.modalidad_alquiler`.

## Modelo

- `modalidad_alquiler` ∈ {`completo` (default), `habitaciones`}. Default seguro: cualquier valor desconocido se normaliza a `completo` vía `normalizeModalidad`.
- `pagos_renta.contrato_id` uuid nullable. Backfilleado por `/admin/backfill-contratos` (Fase B): dry-run obligatorio + apply auditado, sólo asigna en match único.
- Tabla `pagos_renta_reconciliacion` registra decisiones de saneamiento (`kept`, `marked_non_fiscal`, `invalidated_duplicate`, `pending`). Nunca borra pagos; marca `afecta_finanzas_actuales/fiscalidad=false` o invalida el real duplicado.

## Motor (Fase C)

- `finanzasEngine.computeMonthData` y `fiscalPack.computePropertyBreakdown` agrupan por `contrato_id` (`groupPagosPorContrato`). Pagos sin `contrato_id` caen al bucket `legacy_fase4` (fallback heurístico).
- Modalidad `completo`: un único ingreso por (contrato, mes, año). `habitaciones`: suma directa.
- Históricos `historico_reconstruido` con `afecta_fiscalidad=true` que coinciden con `pago_real` en el mismo (contrato, mes) → `historicoAmbiguoFiscal` (no declarable hasta decisión).

## UI (Fase D)

- `HeCobradoSheet` integra `detectarConflictoPagoCompleto({ propertyId, inquilinoId, mes, anio, contratos, pagos, personasPorContrato? })`. Status: `permitido | sin_contrato | ambiguo | duplicado_completo`.
- En `duplicado_completo` + modalidad `completo`: bloqueo del botón "Confirmar cobro", banner rojo con importe ya registrado, dos acciones: **Editar pago existente** (callback `onEditarPagoExistente`, aún no cableado — D.2 pendiente) y **Registrar pago complementario** (toggle que desbloquea y prefija notas con `[Pago complementario]`).
- `ambiguo` (>1 contrato cubriendo el mes): aviso amarillo no bloqueante.

## Reconciliación (Fase E)

- `/admin/reconciliacion-pagos` lista 5 categorías. Para `duplicado_real` solidario: "Mantener" está bloqueado; sólo se permite `invalidated_duplicate` por fila (selecciona target, marca `afecta_finanzas_actuales=false, afecta_fiscalidad=false`) o `pending`.
- Toda decisión escribe `pagos_renta_reconciliacion` + `error_logs` (`reconciliacion_decidida`) sin PII.

## Telemetría/deprecación (Fase F)

- `dedupeTelemetry` (in-memory) en `src/lib/pagosDedupe.ts` cuenta grupos `legacy_fase4` vs `por_contrato`, dedupes activados y warnings.
- `PAGOS_DEDUPE_FASE4_DEPRECATION = { status: "monitoring", since: "2026-05-27", replacedBy: "groupPagosPorContrato + detectarConflictoPagoCompleto" }`. Pasar a `removable` cuando `legacy_fase4_dedupes == 0` durante 30 días.
- Panel `/admin/sprint3-telemetria`: snapshot + flush manual a audit (`sprint3_dedupe_telemetry_flush`) + reset.

## Reglas de oro

- No tocar `pagosDedupe.ts` salvo bugfix. Cualquier lógica nueva va al motor por contrato.
- Nunca borrar pagos; marcar flags o invalidar.
- Sin PII en logs (ni nombres, ni DNIs, ni importes detallados fuera de contexto agregado).
- Tests obligatorios viven en `src/lib/__tests__/sprint3-*.test.ts`.

## Archivos clave

- `src/lib/pagosDedupe.ts` (deprecado, fallback)
- `src/lib/sprint3/backfillContratoId.ts`
- `src/lib/sprint3/reconciliacion.ts`
- `src/lib/sprint3/duplicadoPagoCompleto.ts`
- `src/hooks/useBackfillContratoId.ts` / `useReconciliacionPagos.ts`
- `src/pages/{BackfillContratoIdPage, ReconciliacionPagosPage, Sprint3TelemetriaPage}.tsx`
- `src/components/propietarios/HeCobradoSheet.tsx`
- `src/lib/finanzasEngine.ts` (líneas ~325-395), `src/lib/fiscalPack.ts` (líneas ~340-415)
