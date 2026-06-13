import { describe, it, expect, beforeEach, vi } from "vitest";

const inserts: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(_table: string) {
      return {
        async insert(payload: any) {
          inserts.push(payload);
          return { data: null, error: null };
        },
      };
    },
  },
}));

import { logContratoEvento, describeMeses } from "@/lib/contratoHistorialEvents";

describe("contratoHistorialEvents.logContratoEvento", () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it("inserta evento con metadata completa y no recalcula importes", async () => {
    await logContratoEvento({
      contratoId: "c-1",
      propertyId: "p-1",
      userId: "u-1",
      tipo: "historico_economico_reconstruido",
      titulo: "Reconstrucción histórica",
      importeTotal: 12000,
      metadata: {
        origen: "alta_guiada",
        meses_afectados: [
          { mes: 1, anio: 2024 },
          { mes: 2, anio: 2024 },
        ],
        afecta_finanzas_actuales: false,
        afecta_fiscalidad: false,
      },
    });
    expect(inserts).toHaveLength(1);
    const row = inserts[0];
    expect(row.tipo).toBe("historico_economico_reconstruido");
    expect(row.importe_nuevo).toBe(12000);
    expect(row.metadata.numero_meses).toBe(2);
    expect(row.metadata.importe_total).toBe(12000);
    expect(row.metadata.afecta_finanzas_actuales).toBe(false);
    expect(row.metadata.afecta_fiscalidad).toBe(false);
  });

  it("propaga el campo omitidos_pago_real en metadata cuando aplica", async () => {
    await logContratoEvento({
      contratoId: "c-1",
      propertyId: "p-1",
      userId: "u-1",
      tipo: "renta_historica_regularizada",
      titulo: "Regularización",
      metadata: {
        omitidos_pago_real: [{ mes: 3, anio: 2024 }],
        meses_afectados: [{ mes: 4, anio: 2024 }],
      },
    });
    expect(inserts[0].metadata.omitidos_pago_real).toEqual([{ mes: 3, anio: 2024 }]);
    expect(inserts[0].metadata.numero_meses).toBe(1);
  });

  it("default seguro: afecta_finanzas_actuales y afecta_fiscalidad = false si no se especifican", async () => {
    await logContratoEvento({
      contratoId: "c-1",
      propertyId: "p-1",
      userId: "u-1",
      tipo: "pago_pendiente_historico",
      titulo: "Pendiente",
    });
    expect(inserts[0].metadata.afecta_finanzas_actuales).toBe(false);
    expect(inserts[0].metadata.afecta_fiscalidad).toBe(false);
  });

  it("dispara CustomEvent contrato-historial-changed para refrescar UI", async () => {
    const listener = vi.fn();
    window.addEventListener("contrato-historial-changed", listener);
    await logContratoEvento({
      contratoId: "c-9",
      propertyId: "p-9",
      userId: "u-1",
      tipo: "pago_real_registrado",
      titulo: "Cobro real",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ contratoId: "c-9", propertyId: "p-9", tipo: "pago_real_registrado" });
    window.removeEventListener("contrato-historial-changed", listener);
  });

  it("describeMeses formatea rangos legibles", () => {
    expect(describeMeses([{ mes: 1, anio: 2024 }])).toMatch(/Ene 2024/);
    expect(
      describeMeses([
        { mes: 1, anio: 2024 },
        { mes: 3, anio: 2024 },
      ]),
    ).toMatch(/Ene 2024 → Mar 2024 \(2 meses\)/);
  });
});