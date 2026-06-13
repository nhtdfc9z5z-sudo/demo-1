---
name: Dedupe de pagos por contrato (Fase 4 defensiva)
description: Lectura — evita multiplicar la renta por inquilinos solidarios. No toca BD ni datos.
type: feature
---

`src/lib/pagosDedupe.ts` agrupa pagos del mismo `(property, mes, año)` en
un ingreso económico/fiscal único cuando el contrato es "alquiler completo".

Reglas para modalidad `completo`:
- Ignora importes 0.
- ≥2 pagos exactamente iguales a la renta esperada ⇒ se cuenta una sola vez
  + warning `duplicado_renta_solidaria`.
- Suma ≤ renta esperada ⇒ se acepta (parciales reales).
- Suma > renta esperada sin duplicado claro ⇒ se devuelve la suma + warning
  `excede_renta_esperada` (no inflar dashboard/fiscal en silencio).

Modalidad `habitaciones` ⇒ suma directa sin dedupe (extensible cuando se
añada `contratos_arrendamiento.modalidad_alquiler` en Sprint 3).

Consumidores actualizados: `finanzasEngine.computeMonthData` (dashboard /
tesorería) y `fiscalPack.computePropertyBreakdown` (IRPF / pack gestor).

Trazabilidad: cada activación emite `captureAppError({ event: "pagos_renta_dedupe", audit: true, severity: "warning" })` con `{ property_id, mes, anio, warnings, source }`.

Pendiente Sprint 3: añadir `pagos_renta.contrato_id` + flag
`modalidad_alquiler` para sustituir la heurística por agrupación canónica.