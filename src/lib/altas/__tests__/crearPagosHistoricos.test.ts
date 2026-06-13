import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Estado del mock entre tests. Permite simular pagos preexistentes
 * y capturar las filas insertadas (upsert).
 */
const existingPagos: Array<{ contrato_id: string; mes: number; anio: number }> = [];
const upsertedRows: any[] = [];
let upsertConflict: string | undefined;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "pagos_renta") throw new Error(`unexpected ${table}`);
      return {
        // .select("mes,anio").eq("contrato_id", id)
        select: (_cols: string) => ({
          eq: (col: string, val: string) => {
            const rows = existingPagos.filter((p) => p.contrato_id === val);
            return Promise.resolve({ data: rows, error: null });
          },
        }),
        upsert: (rows: any[], opts: any) => {
          upsertConflict = opts?.onConflict;
          upsertedRows.push(...rows);
          return {
            select: () =>
              Promise.resolve({
                data: rows.map((_r, i) => ({ id: `new-${i}` })),
                error: null,
              }),
          };
        },
      };
    },
  },
}));

import {
  crearPagosHistoricos,
  importeTramoVigente,
  mesesImpagadosPorCantidad,
} from "../crearPagosHistoricos";

beforeEach(() => {
  existingPagos.length = 0;
  upsertedRows.length = 0;
  upsertConflict = undefined;
});

describe("importeTramoVigente", () => {
  it("aplica el último tramo con fecha_desde <= primer día del mes", () => {
    const tramos = [
      { fecha_desde: "2024-01-01", importe: 800 },
      { fecha_desde: "2025-06-01", importe: 900 },
    ];
    expect(importeTramoVigente(tramos, 2024, 5)).toBe(800);
    expect(importeTramoVigente(tramos, 2025, 5)).toBe(800);
    expect(importeTramoVigente(tramos, 2025, 6)).toBe(900);
    expect(importeTramoVigente(tramos, 2026, 1)).toBe(900);
  });
  it("devuelve null si ningún tramo es vigente", () => {
    expect(importeTramoVigente([{ fecha_desde: "2030-01-01", importe: 1 }], 2024, 1)).toBeNull();
  });
});

describe("crearPagosHistoricos", () => {
  const baseInput = {
    property_id: "p1",
    inquilino_id: "i1",
    contrato_id: "c1",
    user_id: "u1",
  };

  it("crea un pago por cada mes entre fecha_inicio y fecha_fin_control", async () => {
    const res = await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2026-01-15",
      fecha_fin_control: "2026-04-10",
      tramos: [{ fecha_desde: "2026-01-01", importe: 800 }],
    });
    expect(res.insertados).toBe(4); // ene, feb, mar, abr
    expect(upsertedRows.map((r) => `${r.anio}-${r.mes}`)).toEqual([
      "2026-1", "2026-2", "2026-3", "2026-4",
    ]);
  });

  it("usa el importe del tramo correcto en cada mes", async () => {
    await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2025-05-01",
      fecha_fin_control: "2025-08-01",
      tramos: [
        { fecha_desde: "2025-05-01", importe: 700 },
        { fecha_desde: "2025-07-01", importe: 800 },
      ],
    });
    const importes = Object.fromEntries(
      upsertedRows.map((r) => [`${r.anio}-${r.mes}`, r.importe_pagado]),
    );
    expect(importes).toEqual({
      "2025-5": 700,
      "2025-6": 700,
      "2025-7": 800,
      "2025-8": 800,
    });
  });

  it("no duplica pagos existentes (idempotencia por contrato+mes+anio)", async () => {
    existingPagos.push(
      { contrato_id: "c1", mes: 1, anio: 2026 },
      { contrato_id: "c1", mes: 2, anio: 2026 },
    );
    const res = await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2026-01-01",
      fecha_fin_control: "2026-03-01",
      tramos: [{ fecha_desde: "2026-01-01", importe: 800 }],
    });
    expect(res.omitidos).toBe(2);
    expect(res.insertados).toBe(1);
    expect(upsertedRows.map((r) => r.mes)).toEqual([3]);
  });

  it("marca propietario_confirmado=true y tipo_registro=historico_reconstruido", async () => {
    await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2026-01-01",
      fecha_fin_control: "2026-01-01",
      tramos: [{ fecha_desde: "2026-01-01", importe: 800 }],
    });
    const row = upsertedRows[0];
    expect(row.propietario_confirmado).toBe(true);
    expect(row.tipo_registro).toBe("historico_reconstruido");
    expect(row.contrato_id).toBe("c1");
    expect(row.fecha_devengo).toBe("2026-01-01");
    expect(upsertConflict).toBe("contrato_id,mes,anio");
  });

  it("lanza si no hay tramos válidos", async () => {
    await expect(
      crearPagosHistoricos({
        ...baseInput,
        fecha_inicio: "2026-01-01",
        fecha_fin_control: "2026-02-01",
        tramos: [{ fecha_desde: "", importe: 0 }],
      }),
    ).rejects.toThrow(/tramo de renta/);
  });

  it("no inserta nada si fecha_inicio > fecha_fin_control (contrato futuro o de hoy)", async () => {
    const res = await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2027-01-01",
      fecha_fin_control: "2026-01-01",
      tramos: [{ fecha_desde: "2027-01-01", importe: 800 }],
    });
    expect(res.insertados).toBe(0);
    expect(upsertedRows).toHaveLength(0);
  });
});

describe("mesesImpagadosPorCantidad", () => {
  it("1 mes → solo diciembre", () => {
    expect(mesesImpagadosPorCantidad(2021, 1)).toEqual([{ mes: 12, anio: 2021 }]);
  });
  it("3 meses → oct, nov, dic", () => {
    expect(mesesImpagadosPorCantidad(2021, 3)).toEqual([
      { mes: 10, anio: 2021 },
      { mes: 11, anio: 2021 },
      { mes: 12, anio: 2021 },
    ]);
  });
  it("5 meses → ago, sep, oct, nov, dic", () => {
    expect(mesesImpagadosPorCantidad(2021, 5)).toEqual([
      { mes: 8, anio: 2021 },
      { mes: 9, anio: 2021 },
      { mes: 10, anio: 2021 },
      { mes: 11, anio: 2021 },
      { mes: 12, anio: 2021 },
    ]);
  });
  it("12 meses → enero a diciembre", () => {
    expect(mesesImpagadosPorCantidad(2021, 12)).toEqual(
      Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, anio: 2021 })),
    );
  });
  it("saturación: <1 → [], >12 → año completo", () => {
    expect(mesesImpagadosPorCantidad(2024, 0)).toEqual([]);
    expect(mesesImpagadosPorCantidad(2024, -3)).toEqual([]);
    expect(mesesImpagadosPorCantidad(2024, 20)).toHaveLength(12);
    expect(mesesImpagadosPorCantidad(2024, 20)[11]).toEqual({ mes: 12, anio: 2024 });
  });
});

describe("crearPagosHistoricos con mesesExcluidos", () => {
  const baseInput = {
    property_id: "p1",
    inquilino_id: "i1",
    contrato_id: "c1",
    user_id: "u1",
  };

  it("excluye meses impagados exactos (no se insertan)", async () => {
    const res = await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2026-01-01",
      fecha_fin_control: "2026-04-01",
      tramos: [{ fecha_desde: "2026-01-01", importe: 800 }],
      mesesExcluidos: [
        { mes: 2, anio: 2026 },
        { mes: 3, anio: 2026 },
      ],
    });
    expect(res.excluidos).toBe(2);
    expect(res.insertados).toBe(2);
    expect(upsertedRows.map((r) => r.mes).sort()).toEqual([1, 4]);
  });

  it("caso combinado: tramos de renta + meses impagados", async () => {
    await crearPagosHistoricos({
      ...baseInput,
      fecha_inicio: "2025-05-01",
      fecha_fin_control: "2025-08-01",
      tramos: [
        { fecha_desde: "2025-05-01", importe: 700 },
        { fecha_desde: "2025-07-01", importe: 800 },
      ],
      mesesExcluidos: [{ mes: 6, anio: 2025 }],
    });
    const importes = Object.fromEntries(
      upsertedRows.map((r) => [`${r.anio}-${r.mes}`, r.importe_pagado]),
    );
    // junio queda fuera (impagado); el resto usa el tramo vigente
    expect(importes).toEqual({
      "2025-5": 700,
      "2025-7": 800,
      "2025-8": 800,
    });
  });
});