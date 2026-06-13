import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ─── Mock supabase client ─────────────────────────────────────────

type Row = Record<string, any>;

const state = {
  rows: [] as Row[],
  upserts: [] as Row[],
  updates: [] as Array<{ id: string; data: Row }>,
};

function resetState() {
  state.rows = [];
  state.upserts = [];
  state.updates = [];
}

// Minimal fluent mock supporting the calls usePagosRenta does.
function makeClient() {
  return {
    from(_table: string) {
      const ctx: any = { filters: {} as Record<string, any> };
      const api: any = {
        select() { return api; },
        eq(col: string, val: any) { ctx.filters[col] = val; return api; },
        order() { return api; },
        async maybeSingle() {
          const row = state.rows.find(r =>
            Object.entries(ctx.filters).every(([k, v]) => r[k] === v),
          );
          return { data: row || null, error: null };
        },
        async upsert(payload: Row) {
          state.upserts.push(payload);
          // Sprint 3.7: clave canónica = (contrato_id, mes, anio).
          const idx = state.rows.findIndex(
            r =>
              r.contrato_id === payload.contrato_id &&
              r.mes === payload.mes &&
              r.anio === payload.anio,
          );
          if (idx >= 0) state.rows[idx] = { ...state.rows[idx], ...payload };
          else state.rows.push({ id: crypto.randomUUID(), ...payload });
          return { data: null, error: null };
        },
        update(data: Row) {
          return {
            async eq(_col: string, val: string) {
              state.updates.push({ id: val, data });
              const r = state.rows.find(r => r.id === val);
              if (r) Object.assign(r, data);
              return { data: null, error: null };
            },
          };
        },
        delete() {
          return { async eq() { return { data: null, error: null }; } };
        },
      };
      // queryFn awaits the chain as a thenable
      api.then = (resolve: any) => resolve({ data: [], error: null });
      return api;
    },
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return makeClient();
  },
}));

// Sprint 3.7: aislar el resolver de contratos en tests unitarios.
vi.mock("@/lib/altas/resolverContratoParaPago", () => ({
  resolverContratoIdParaPago: vi.fn(async () => "ctr-1"),
}));

import { usePagosRenta } from "@/hooks/usePagosRenta";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PROP = "prop-1";
const INQ = "inq-1";
const OWNER = "owner-1";

describe("usePagosRenta.registrarHistorico", () => {
  beforeEach(() => resetState());

  it("crea histórico con afecta_finanzas_actuales=false y afecta_fiscalidad=false por defecto", async () => {
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let res: any;
    await act(async () => {
      res = await result.current.registrarHistorico(PROP, INQ, 3, 2024, OWNER, {
        importe_pagado: 1000,
      });
    });
    expect(res.status).toBe("creado");
    const last = state.upserts.at(-1)!;
    expect(last.tipo_registro).toBe("historico_reconstruido");
    expect(last.afecta_finanzas_actuales).toBe(false);
    expect(last.afecta_fiscalidad).toBe(false);
    expect(last.fecha_devengo).toBe("2024-03-01");
  });

  it("NO sobrescribe nunca un pago_real existente — devuelve omitido_pago_real", async () => {
    state.rows.push({
      id: "pre-1",
      contrato_id: "ctr-1",
      property_id: PROP,
      inquilino_id: INQ,
      mes: 5,
      anio: 2024,
      tipo_registro: "pago_real",
      importe_pagado: 950,
    });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let res: any;
    await act(async () => {
      res = await result.current.registrarHistorico(PROP, INQ, 5, 2024, OWNER, {
        importe_pagado: 1000,
      });
    });
    expect(res.status).toBe("omitido_pago_real");
    expect(res.existingTipo).toBe("pago_real");
    // No se debe haber escrito nada nuevo:
    expect(state.upserts.length).toBe(0);
    // Y el pago_real preservado intacto:
    const pre = state.rows.find(r => r.id === "pre-1");
    expect(pre?.importe_pagado).toBe(950);
  });

  it("registrarHistoricoBatch agrega resultados { creados, omitidos } correctamente", async () => {
    state.rows.push({
      id: "pre-2",
      contrato_id: "ctr-1",
      property_id: PROP,
      inquilino_id: INQ,
      mes: 6,
      anio: 2024,
      tipo_registro: "pago_real",
    });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let summary: any;
    await act(async () => {
      summary = await result.current.registrarHistoricoBatch(PROP, INQ, OWNER, [
        { mes: 4, anio: 2024, importe_pagado: 1000 },
        { mes: 5, anio: 2024, importe_pagado: 1000 },
        { mes: 6, anio: 2024, importe_pagado: 1000 }, // colisiona con pago_real
      ]);
    });
    expect(summary.creados).toHaveLength(2);
    expect(summary.omitidos).toHaveLength(1);
    expect(summary.errores).toHaveLength(0);
    expect(summary.omitidos[0]).toMatchObject({ mes: 6, anio: 2024, status: "omitido_pago_real" });
  });

  it("pendiente: importe_pagado=0, tipo_pago=pendiente, no marca propietario_confirmado", async () => {
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.registrarHistorico(PROP, INQ, 7, 2024, OWNER, {
        importe_pagado: 1000,
        tipo_registro: "pendiente",
      });
    });
    const last = state.upserts.at(-1)!;
    expect(last.tipo_registro).toBe("pendiente");
    expect(last.importe_pagado).toBe(0);
    expect(last.tipo_pago).toBe("pendiente");
    expect(last.propietario_confirmado).toBe(false);
    expect(last.afecta_finanzas_actuales).toBe(false);
  });
});

describe("usePagosRenta.marcarComoPagoReal (pendiente → pago_real)", () => {
  beforeEach(() => resetState());

  it("exige importe > 0", async () => {
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await expect(
      result.current.marcarComoPagoReal("p-1", {
        importe_pagado: 0,
        tipo_pago: "transferencia",
      }),
    ).rejects.toThrow(/mayor que 0/i);
    expect(state.updates).toHaveLength(0);
  });

  it("setea fecha_pago_real, activa afecta_finanzas_actuales y afecta_fiscalidad por defecto true", async () => {
    state.rows.push({
      id: "pago-pend-1",
      contrato_id: "ctr-1",
      property_id: PROP,
      inquilino_id: INQ,
      mes: 3,
      anio: 2024,
      tipo_registro: "pendiente",
      fecha_devengo: "2024-03-01",
      importe_pagado: 0,
      afecta_finanzas_actuales: false,
      afecta_fiscalidad: false,
    });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.marcarComoPagoReal("pago-pend-1", {
        importe_pagado: 1000,
        tipo_pago: "transferencia",
      });
    });
    const upd = state.updates.at(-1)!;
    expect(upd.id).toBe("pago-pend-1");
    expect(upd.data.tipo_registro).toBe("pago_real");
    expect(upd.data.importe_pagado).toBe(1000);
    expect(upd.data.afecta_finanzas_actuales).toBe(true);
    expect(upd.data.afecta_fiscalidad).toBe(true);
    expect(upd.data.fecha_pago_real).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // fecha_devengo se mantiene en la fila tras el update (el hook no la toca)
    const row = state.rows.find(r => r.id === "pago-pend-1");
    expect(row?.fecha_devengo).toBe("2024-03-01");
  });

  it("respeta toggle afecta_fiscalidad=false", async () => {
    state.rows.push({ id: "pago-pend-2", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 4, anio: 2024, tipo_registro: "pendiente" });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.marcarComoPagoReal("pago-pend-2", {
        importe_pagado: 500,
        tipo_pago: "bizum",
        afecta_fiscalidad: false,
      });
    });
    const upd = state.updates.at(-1)!;
    expect(upd.data.afecta_fiscalidad).toBe(false);
    expect(upd.data.afecta_finanzas_actuales).toBe(true);
  });
});

describe("usePagosRenta.confirmarPago / notificarPago — fecha_devengo", () => {
  beforeEach(() => resetState());

  it("confirmarPago siempre setea fecha_devengo al primer día del mes", async () => {
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.confirmarPago(PROP, INQ, 7, 2025, {
        importe_pagado: 1000,
        tipo_pago: "transferencia",
      }, OWNER);
    });
    const last = state.upserts.at(-1)!;
    expect(last.fecha_devengo).toBe("2025-07-01");
    expect(last.fecha_pago_real).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(last.propietario_confirmado).toBe(true);
  });

  it("notificarPago también setea fecha_devengo", async () => {
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.notificarPago(INQ, PROP, 2, 2025, OWNER);
    });
    const last = state.upserts.at(-1)!;
    expect(last.fecha_devengo).toBe("2025-02-01");
    expect(last.inquilino_notificado).toBe(true);
  });
});

describe("usePagosRenta.detectarConflictosHistorico + estrategias", () => {
  beforeEach(() => resetState());

  it("clasifica meses en buckets según tipo_registro existente", async () => {
    state.rows.push({ id: "a", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "pago_real" });
    state.rows.push({ id: "b", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 2, anio: 2024, tipo_registro: "historico_reconstruido" });
    state.rows.push({ id: "c", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 3, anio: 2024, tipo_registro: "pendiente" });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let buckets: any;
    await act(async () => {
      buckets = await result.current.detectarConflictosHistorico(PROP, INQ, [
        { mes: 1, anio: 2024 }, { mes: 2, anio: 2024 }, { mes: 3, anio: 2024 }, { mes: 4, anio: 2024 },
      ]);
    });
    expect(buckets.pago_real).toHaveLength(1);
    expect(buckets.historico_reconstruido).toHaveLength(1);
    expect(buckets.pendiente).toHaveLength(1);
    expect(buckets.sin_registro).toHaveLength(1);
    expect(buckets.sin_registro[0]).toMatchObject({ mes: 4, anio: 2024 });
  });

  it("estrategia 'solo_nuevos' omite meses existentes (incluso histórico) y crea los nuevos", async () => {
    state.rows.push({ id: "x", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "historico_reconstruido" });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let summary: any;
    await act(async () => {
      summary = await result.current.registrarHistoricoBatch(PROP, INQ, OWNER, [
        { mes: 1, anio: 2024, importe_pagado: 1000 },
        { mes: 2, anio: 2024, importe_pagado: 1000 },
      ], "solo_nuevos");
    });
    expect(summary.creados).toHaveLength(1);
    expect(summary.omitidos_por_decision).toHaveLength(1);
    expect(summary.omitidos_por_decision[0]).toMatchObject({ mes: 1, anio: 2024 });
  });

  it("estrategia 'solo_reemplazar_existentes' actualiza histórico y NO crea nuevos meses", async () => {
    state.rows.push({ id: "x", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "historico_reconstruido" });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    let summary: any;
    await act(async () => {
      summary = await result.current.registrarHistoricoBatch(PROP, INQ, OWNER, [
        { mes: 1, anio: 2024, importe_pagado: 1200 },
        { mes: 2, anio: 2024, importe_pagado: 1200 },
      ], "solo_reemplazar_existentes");
    });
    expect(summary.actualizados).toHaveLength(1);
    expect(summary.omitidos_por_decision).toHaveLength(1);
    expect(summary.omitidos_por_decision[0]).toMatchObject({ mes: 2, anio: 2024 });
  });

  it("pago_real siempre protegido, independientemente de la estrategia", async () => {
    state.rows.push({ id: "r", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "pago_real", importe_pagado: 999 });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    for (const est of ["omitir_pagos_reales", "solo_reemplazar_existentes", "solo_nuevos"] as const) {
      let summary: any;
      await act(async () => {
        summary = await result.current.registrarHistoricoBatch(PROP, INQ, OWNER, [
          { mes: 1, anio: 2024, importe_pagado: 1234 },
        ], est);
      });
      expect(summary.omitidos).toHaveLength(1);
      const row = state.rows.find(r => r.id === "r");
      expect(row?.importe_pagado).toBe(999);
    }
  });
});

describe("usePagosRenta — acciones sobre histórico/pendiente", () => {
  beforeEach(() => resetState());

  it("setAfectaFiscalidad actualiza el flag en históricos", async () => {
    state.rows.push({ id: "h1", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "historico_reconstruido", afecta_fiscalidad: false });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.setAfectaFiscalidad("h1", true);
    });
    expect(state.rows[0].afecta_fiscalidad).toBe(true);
  });

  it("setAfectaFiscalidad rechaza pagos reales", async () => {
    state.rows.push({ id: "r1", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 1, anio: 2024, tipo_registro: "pago_real", afecta_fiscalidad: true });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await expect(result.current.setAfectaFiscalidad("r1", false)).rejects.toThrow();
    });
    // Sin cambios
    expect(state.rows[0].afecta_fiscalidad).toBe(true);
  });

  it("convertirEnPendiente resetea importe, fecha y flags", async () => {
    state.rows.push({
      id: "h2", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 2, anio: 2024,
      tipo_registro: "historico_reconstruido", importe_pagado: 1200,
      fecha_pago_real: "2024-02-15", afecta_finanzas_actuales: false, afecta_fiscalidad: true,
    });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.convertirEnPendiente("h2");
    });
    const row = state.rows[0];
    expect(row.tipo_registro).toBe("pendiente");
    expect(row.importe_pagado).toBe(0);
    expect(row.fecha_pago_real).toBeNull();
    expect(row.afecta_finanzas_actuales).toBe(false);
    expect(row.afecta_fiscalidad).toBe(false);
  });

  it("convertirEnPendiente rechaza pagos reales", async () => {
    state.rows.push({ id: "r2", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 3, anio: 2024, tipo_registro: "pago_real", importe_pagado: 1000 });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await expect(result.current.convertirEnPendiente("r2")).rejects.toThrow();
    });
    expect(state.rows[0].tipo_registro).toBe("pago_real");
    expect(state.rows[0].importe_pagado).toBe(1000);
  });

  it("marcarRegularizado mueve un pendiente a regularizado sin afectar finanzas/fiscalidad", async () => {
    state.rows.push({ id: "p1", contrato_id: "ctr-1", property_id: PROP, inquilino_id: INQ, mes: 4, anio: 2024, tipo_registro: "pendiente", importe_pagado: 0 });
    const { result } = renderHook(() => usePagosRenta(), { wrapper });
    await act(async () => {
      await result.current.marcarRegularizado("p1", "No reclamado");
    });
    const row = state.rows[0];
    expect(row.tipo_registro).toBe("regularizado");
    expect(row.afecta_finanzas_actuales).toBe(false);
    expect(row.afecta_fiscalidad).toBe(false);
    expect(row.notas_acuerdo).toBe("No reclamado");
  });
});