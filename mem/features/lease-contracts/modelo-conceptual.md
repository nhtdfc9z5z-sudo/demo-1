---
name: Modelo conceptual de altas (CERRADO)
description: Modelo cerrado. Activo, Inquilino y Contrato son entidades INDEPENDIENTES. Un Activo puede existir sin Contrato. Un Inquilino puede existir sin Activo. El Contrato es el único vínculo. Un único motor de altas en src/lib/altas/.
type: feature
---
Estado: **CERRADO**. Subarriendo sigue PENDING (ver docs/modelo-contrato.md).

## Reglas firmes
- Activo, Inquilino y Contrato son entidades INDEPENDIENTES y desacopladas.
- Un Activo puede existir vacío, en reforma o como futuro alquiler — sin contrato.
- Un Inquilino puede existir sin vivienda asignada.
- El Contrato es el único vínculo entre Activo e Inquilino.
- El PDF firmado es la fuente de verdad legal del Contrato.
- `contrato_personas.parte` distingue arrendadora/arrendataria/gestion/garantia/otro.
- `porcentaje_fiscal` (fallback `porcentaje_participacion`) reparte la fiscalidad.

## Motor único de altas
Todo código que cree Activo, Inquilino o Contrato DEBE pasar por `src/lib/altas/`:
- `crearActivo(input)` — única vía para insertar en `properties`.
- `crearInquilino(input)` — única vía para insertar en `inquilinos`.
- `crearContrato(input)` — única vía para insertar en `contratos_arrendamiento` + `contrato_personas`.
- `crearAltaCompleta(input)` — orquestador del wizard de alquiler (resuelve activo existente o nuevo, inquilino existente o nuevo, y crea contrato).

Las UIs (PDF, fotos, cámara, manual, OCR) sólo cambian CÓMO se capturan los datos. Todas convergen en este motor. Está prohibido insertar directamente en estas tablas desde componentes o hooks fuera de `src/lib/altas/`.

## Direcciones estructuradas
Campos en `properties`: `tipo_via`, `nombre_via`, `numero`, `portal`, `escalera`, `bloque`, `planta`, `puerta`, `urbanizacion`, `parcela`, `codigo_postal`, `ciudad` (municipio), `provincia`, `pais`, `latitud`, `longitud`, `direccion_completa`.

`direccion_completa` se genera SIEMPRE desde `src/lib/direccion/formatDireccion.ts` — no es editable manualmente.

Validación flexible por tipo de activo: pisos requieren planta/puerta; chalets/terrenos no. Número y parcela son opcionales (s/n permitido).

## NO implementar
- Subarriendo (sigue PENDING en `docs/modelo-contrato.md`).
