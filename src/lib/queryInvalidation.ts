import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidación cruzada de toda la "cadena fiscal".
 *
 * Cuando algo cambia en pagos, gastos, facturas, contratos o
 * `contrato_personas`, todos los derivados fiscales tienen que recalcularse.
 * Centralizamos las query keys aquí para evitar olvidos.
 *
 * Convenciones de query keys:
 *  - `["contrato-personas", ...]`
 *  - `["fiscal-pack", anio]`
 *  - `["fiscal-data", anio]`
 *  - `["pagos_renta", ...]`
 *  - `["gastos", ...]`
 *  - `["facturas", ...]`
 *  - `["contratos", ...]`
 */
export function invalidateFiscalChain(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["contrato-personas"] });
  qc.invalidateQueries({ queryKey: ["fiscal-pack"] });
  qc.invalidateQueries({ queryKey: ["fiscal-data"] });
  qc.invalidateQueries({ queryKey: ["pagos_renta"] });
  qc.invalidateQueries({ queryKey: ["gastos"] });
  qc.invalidateQueries({ queryKey: ["facturas"] });
  qc.invalidateQueries({ queryKey: ["contratos"] });
}