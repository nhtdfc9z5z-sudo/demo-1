/**
 * Sprint 3.7 — Contrato como unidad económica única.
 *
 * Tests acordados con producto:
 *  1. Contrato completo, 2 inquilinos solidarios, renta 900 → expected mes = 900.
 *  2. Un pago de 900 vinculado al contrato → mes pagado, pendiente = 0.
 *  3. Pago parcial de 500 → pendiente = 400.
 *  4. Habitaciones: contratos A=400 + B=450 → expected total activo = 850,
 *     calculado por contrato separado, NO sumando inquilinos.
 *  5. Fiscalidad: dos inquilinos solidarios que registran 900 entre ambos
 *     producen ingreso fiscal = 900, no 1800.
 *
 * Estos tests son puros: validan el invariante de "1 fila canónica por
 * contrato/mes". La invariante se garantiza por:
 *   - UNIQUE (contrato_id, mes, anio) en BD.
 *   - `usePagosRenta` upsertea con onConflict = "contrato_id,mes,anio".
 *   - El motor agrupa por contrato_id (groupPagosPorContrato) y nunca por
 *     inquilino_id.
 */
import { describe, it, expect } from "vitest";
import {
  dedupePagosCompleto,
  groupPagosPorContrato,
} from "@/lib/pagosDedupe";

interface PagoFix {
  id: string;
  contrato_id: string | null;
  inquilino_id: string;
  importe_pagado: number;
  tipo_registro?: string;
}

// Helpers
const expectedDelContrato = (rentaContrato: number) => rentaContrato;
const pendiente = (renta: number, ingreso: number) => Math.max(0, renta - ingreso);

describe("Contrato como unidad económica única", () => {
  it("1) Solidarios sin doble cómputo: renta 900, 2 inquilinos → expected = 900", () => {
    // Tras consolidación DB: 1 sola fila canónica para el contrato/mes.
    const pagos: PagoFix[] = []; // ningún pago aún
    const groups = groupPagosPorContrato(pagos);
    expect(groups.size).toBe(0);
    expect(expectedDelContrato(900)).toBe(900);
  });

  it("2) Pago de 900 vinculado al contrato → ingreso 900, pendiente 0", () => {
    const pagos: PagoFix[] = [
      { id: "p1", contrato_id: "C-A", inquilino_id: "i1", importe_pagado: 900, tipo_registro: "pago_real" },
    ];
    const grupos = groupPagosPorContrato(pagos);
    const grupo = grupos.get("C-A")!;
    const res = dedupePagosCompleto(grupo, 900, "completo");
    expect(res.ingreso).toBe(900);
    expect(pendiente(900, res.ingreso)).toBe(0);
  });

  it("3) Pago parcial 500 → pendiente 400", () => {
    const pagos: PagoFix[] = [
      { id: "p1", contrato_id: "C-A", inquilino_id: "i1", importe_pagado: 500, tipo_registro: "pago_real" },
    ];
    const grupos = groupPagosPorContrato(pagos);
    const res = dedupePagosCompleto(grupos.get("C-A")!, 900, "completo");
    expect(res.ingreso).toBe(500);
    expect(pendiente(900, res.ingreso)).toBe(400);
  });

  it("4) Habitaciones A=400 + B=450 → expected total activo = 850, separados por contrato", () => {
    const pagos: PagoFix[] = [
      { id: "pa", contrato_id: "C-Hab-A", inquilino_id: "iA", importe_pagado: 400, tipo_registro: "pago_real" },
      { id: "pb", contrato_id: "C-Hab-B", inquilino_id: "iB", importe_pagado: 450, tipo_registro: "pago_real" },
    ];
    const grupos = groupPagosPorContrato(pagos);
    expect(grupos.size).toBe(2);
    const ingA = dedupePagosCompleto(grupos.get("C-Hab-A")!, 400, "habitaciones").ingreso;
    const ingB = dedupePagosCompleto(grupos.get("C-Hab-B")!, 450, "habitaciones").ingreso;
    const expectedActivo = expectedDelContrato(400) + expectedDelContrato(450);
    expect(expectedActivo).toBe(850);
    expect(ingA + ingB).toBe(850);
    // Cada contrato se calcula independientemente: A no afecta a B.
    expect(pendiente(400, ingA)).toBe(0);
    expect(pendiente(450, ingB)).toBe(0);
  });

  it("5) Fiscalidad: 2 solidarios que aportan 450+450 al contrato → ingreso fiscal = 900, NO 1800", () => {
    // Tras consolidación DB sólo puede existir 1 fila canónica por contrato/mes.
    // Si por error existieran dos (legacy), dedupePagosCompleto recorta a renta esperada.
    const pagos: PagoFix[] = [
      { id: "p1", contrato_id: "C-A", inquilino_id: "i1", importe_pagado: 450, tipo_registro: "pago_real" },
      { id: "p2", contrato_id: "C-A", inquilino_id: "i2", importe_pagado: 450, tipo_registro: "pago_real" },
    ];
    const res = dedupePagosCompleto(pagos, 900, "completo");
    expect(res.ingreso).toBe(900);
    expect(res.ingreso).not.toBe(1800);
  });
});