---
name: Modelo de renta por tramos (Sprint 3)
description: Renta esperada por periodo se calcula contra el tramo vigente en renta_actualizaciones. contrato.renta_mensual es renta cacheada actual, NO se aplica retroactivamente. Auto-creación de tramo desde contrato_modificaciones (ipc/renta_manual + fecha_efectiva + valor_nuevo).
type: feature
---

**Fuente de verdad** del cálculo económico de renta esperada: `renta_actualizaciones` (tabla con `fecha_efectiva` + `importe_nuevo` + `importe_anterior`).

- `contrato.renta_mensual` = renta vigente cacheada. **Nunca** se aplica retroactivamente a todo el contrato.
- `contrato_modificaciones` = histórico legal/comunicaciones. NO motor de cálculo.
- `rentaUtils.getRentaEnPeriodo(actualizaciones, mes, anio, fallback)` resuelve la renta vigente para un periodo:
  1. Tramo más reciente con `fecha_efectiva ≤ día 15 del mes`.
  2. Si periodo previo al primer tramo y el primer tramo trae `importe_anterior` → usa `importe_anterior`.
  3. Fallback a la renta cacheada (asunción de backfill: sin tramos = renta constante desde `fecha_inicio`).
- `calcularImporteEsperado(...)` acepta parámetro opcional `actualizaciones`. Backwards-compatible.
- `useContratoModificaciones.addModificacion` auto-crea entrada en `renta_actualizaciones` cuando `tipo_cambio ∈ {ipc, renta_manual}` + `fecha_efectiva` + `valor_nuevo` numérico. Deduplica por (contrato_id, fecha_efectiva, importe_nuevo).
- **Fiscalidad NO se toca**: imputa por `fecha_devengo` del pago real, no por renta esperada.
- **Caso obligatorio cubierto en tests**: contrato Mayo 2023 @ 750 € + tramo Enero 2026 @ 770 € (con `importe_anterior: 750`) → meses 2023-2025 esperan 750 €, meses 2026+ esperan 770 €. Cero deuda histórica falsa.

Ver `src/lib/rentaUtils.ts`, `src/hooks/useContratoModificaciones.ts`, `src/lib/__tests__/rentaTramos.test.ts`.