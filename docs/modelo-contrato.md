# Modelo conceptual de contrato (PENDING / DECISIÓN ABIERTA)

> Estado: **PENDING**. Documento de trabajo. **No** implementar subarrendamiento
> ni nuevas reglas fiscales hasta cerrar este documento.

## Roles a distinguir

| Rol | Definición |
|---|---|
| **Contrato legal** | Documento firmado entre las partes (PDF original = fuente de verdad). |
| **Arrendador contractual** | Quien firma como arrendador en el contrato. |
| **Arrendador fiscal** | Quien declara los rendimientos en IRPF (puede no coincidir con el contractual: usufructo, cotitularidad, gananciales). |
| **Titular registral** | Quien figura en el Registro de la Propiedad / Catastro. |
| **Ocupante / Inquilino** | Quien habita el inmueble (puede no ser firmante: convivientes). |
| **Pagador** | Quien efectivamente paga la renta (puede ser un tercero: empresa, padre, avalista). |
| **Quién cobra** | Cuenta receptora del cobro (puede ser un gestor, copropietario o cuenta común). |
| **Quién declara** | Repartido por `contrato_personas.porcentaje_fiscal` (fallback `porcentaje_participacion`). |

## Casuísticas previstas

1. **Alquiler completo de vivienda** — 1 contrato, 1+ arrendador, 1+ arrendatario.
2. **Alquiler de habitación** — 1 contrato por habitación o 1 contrato con varios arrendatarios solidarios.
3. **Subarrendamiento** — el arrendatario original actúa como subarrendador frente a un tercero.
   - Implica dos contratos encadenados.
   - Implicaciones fiscales propias (rendimientos de capital mobiliario, no inmobiliario, en algunos casos).
   - **No implementar hasta cerrar este documento.**

## Implicaciones para el modelo de datos (no implementar todavía)

- `contrato_personas.parte` ya soporta `arrendadora` / `arrendataria` / `gestion` / `garantia` / `otro`.
- Para subarriendo haría falta diferenciar el **rol respecto al contrato superior** y vincular contratos
  padre/hijo (campo pendiente, p.ej. `contrato_padre_id`).
- `porcentaje_fiscal` seguiría siendo la fuente de reparto fiscal por parte.

## Decisiones pendientes

- ¿Modelamos subarriendo como contrato hijo con FK a contrato padre, o como contrato independiente
  marcado con tipo?
- ¿Cómo se imputa fiscalmente la renta recibida por el subarrendador vs. la pagada al arrendador original?
- ¿Necesitamos distinguir "quién cobra" como entidad separada de "arrendador fiscal"?

> Hasta que estas decisiones se cierren con el usuario, **no** se añade lógica de subarriendo
> al código. Cualquier UI que mencione subarriendo debe quedar como marcador informativo.
