## Plan: Cierre MVP — 4 mejoras secuenciales

Aplicaré las 4 mejoras en orden estricto, cerrando cada una antes de pasar a la siguiente. Reglas comunes: no tocar `crearActivo`, `crearAltaCompleta`, OCR, flujos de alta, ni `finanzasEngine`. No duplicar lógica fiscal. RGPD: sin logs con PII/fiscal. Tests verdes al final de cada mejora.

---

### MEJORA 1 — Fiscal: amortización 3% y reducción 60%

**Archivos:**
- `src/lib/fiscalPack.ts` (extender `computePropertyBreakdown` / tipos `PropertyBreakdown`)
- `src/components/propietarios/FiscalidadTab.tsx`
- `src/lib/__tests__/fiscalPack.test.ts` / `fiscalPackExport.test.ts` (actualizar fixtures)
- Nuevo: `src/lib/fiscal/__tests__/amortizacionReduccion.test.ts`

**Lógica añadida (helpers nuevos en `fiscalPack.ts`):**
- `calcularAmortizacion(property)`: usa `valor_catastral_construccion` si existe, si no `valor_compra * 0.7`. Resultado × 0.03. Si no hay base → 0 + flag `requiereValorCompra`.
- `aplicaReduccion60(contrato)`: true si `tipo_contrato === "habitual"`. Falso para vacacional/oficina/local/temporada/garaje/trastero/otros.
- `PropertyBreakdown` añade: `amortizacionAnual`, `rendimientoNetoBruto`, `aplicaReduccion`, `rendimientoNetoReducido`, `baseLiquidableEstimada`, `avisoAmortizacion?`.

**FiscalidadTab:** nueva fila por activo con: Rendimiento neto bruto → Reducción 60% (si aplica) → Rendimiento neto reducido → Amortización → Base liquidable. Aviso inline si falta valor de compra.

---

### MEJORA 2 — Exportaciones Contasol / A3 / Sage / Holded

**Archivos:**
- `src/lib/fiscalPackExport.ts` (4 funciones nuevas `generate{Contasol,A3,Sage,Holded}Csv(pack): Blob`)
- `src/components/propietarios/PackFiscalGestor.tsx` (4 botones nuevos junto a PDF/Excel)
- `src/lib/__tests__/fiscalPackExport.test.ts` (tests de cabeceras, separadores, UTF-8 BOM)

**Cuentas PGC:**
- Ingresos: 752 (arrendamientos)
- Gastos por categoría: 622 reparación, 628 suministros, 631 tributos (IBI), 629 comunidad, 626 servicios bancarios, 623 honorarios, 625 seguros, 769 intereses, 681 amortización, 622/629 resto.

**Formatos:**
- **Contasol CSV**: `Fecha;Concepto;Debe;Haber;Cuenta`
- **A3 CSV**: cabecera `# A3 Asesor - Export CapitalRent` + mismas columnas Contasol
- **Sage CSV**: `Fecha;Ref;Concepto;Importe;IVA;Cuenta;Contrapartida`
- **Holded CSV**: `Contact,Date,Description,Amount,Tax,Category`

Todos UTF-8 con BOM. Datos exclusivos del `fiscalPack` (sin recálculo).

---

### MEJORA 3 — Unificar Docs y Archivos

**Archivos:**
- `src/components/propietarios/DocumentacionTab.tsx` (añadir sección "Otros documentos" que monta el contenido de DocumentosTab)
- `src/components/propietarios/PanelHeader.tsx` (eliminar tab "Archivos", renombrar "documentacion" → label "Documentos")
- `src/pages/PropietariosPanel.tsx` (eliminar render del tab `documentos`, ajustar `PanelTab` type)
- Mantener `DocumentosTab.tsx` como subcomponente reutilizado dentro de Documentación.

**Estructura interna en Documentación:** las categorías existentes (Contratos, Facturas, Seguros, CEE, Fianzas, Inventario) + nueva tarjeta "Otros documentos" que abre el repositorio OCR.

Sin pérdida de datos ni de rutas internas.

---

### MEJORA 4 — Finanzas: `nombre_interno` y layout 2 columnas

**Archivos:**
- `src/components/propietarios/TesoreriaGeneralTab.tsx`

**Cambios:**
- Reemplazar `p.nombre` por `p.nombre_interno || p.nombre || "Activo sin nombre"`.
- Layout:
  - Fila 1: KPIs (ingresos / gastos / balance) — sin cambios.
  - Fila 2: grid `lg:grid-cols-2 gap-4` con "Ingresos por activo" (izquierda) y "Gastos registrados" (derecha). Móvil: una columna apilada.

Sin cambios en cálculos ni en `finanzasEngine`.

---

### Detalles técnicos

- Todos los helpers fiscales nuevos viven en `src/lib/fiscalPack.ts` para que `useFiscalData` los exponga sin recalcular.
- `PackFiscalGestor` solo llama a generadores; no calcula nada.
- `DocumentosTab` se importa tal cual dentro de `DocumentacionTab` para la sección "Otros documentos" — sin duplicación.
- Tests: extender los suites existentes en `src/lib/__tests__/` y añadir uno nuevo para amortización/reducción.

### Entrega

Al cerrar cada mejora informaré: archivos tocados, cambios aplicados, tests ejecutados y resultado.
