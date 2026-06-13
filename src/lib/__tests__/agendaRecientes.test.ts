import { describe, it, expect } from "vitest";
import { buildPagoAgendaItems } from "@/lib/agendaRecientes";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const today = new Date();
const todayIso = today.toISOString();

function mkPago(over: Partial<PagoRenta>): PagoRenta {
  return {
    id: over.id ?? crypto.randomUUID(),
    property_id: "prop-1",
    inquilino_id: "inq-1",
    mes: 1,
    anio: 2024,
    inquilino_notificado: false,
    inquilino_notificado_at: null,
    propietario_confirmado: true,
    propietario_confirmado_at: todayIso,
    importe_pagado: 570,
    tipo_pago: "transferencia",
    notas_acuerdo: null,
    user_id: "u1",
    created_at: todayIso,
    updated_at: todayIso,
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: null,
    fecha_pago_real: todayIso.slice(0, 10),
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    contrato_id: "contrato-1",
    ...over,
  } as PagoRenta;
}

describe("buildPagoAgendaItems (H2.6)", () => {
  it("un histórico individual NO se etiqueta como pago_real", () => {
    const items = buildPagoAgendaItems([
      mkPago({
        id: "h1",
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
        importe_pagado: 570,
        mes: 1,
        anio: 2024,
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("historico_individual");
  });

  it("agrupa varios históricos del mismo contrato registrados el mismo día", () => {
    const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const pagos = meses.map((m) =>
      mkPago({
        id: `h-${m}`,
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
        importe_pagado: 570,
        mes: m,
        anio: 2024,
      }),
    );
    const items = buildPagoAgendaItems(pagos);
    expect(items).toHaveLength(1);
    const it = items[0];
    expect(it.kind).toBe("historico_grupo");
    if (it.kind === "historico_grupo") {
      expect(it.pagos).toHaveLength(10);
      expect(it.totalImporte).toBe(5700);
      expect(it.mesMin).toEqual({ mes: 1, anio: 2024 });
      expect(it.mesMax).toEqual({ mes: 10, anio: 2024 });
      expect(it.contratoId).toBe("contrato-1");
    }
  });

  it("NO agrupa históricos de contratos distintos aunque sean del mismo día", () => {
    const items = buildPagoAgendaItems([
      mkPago({
        id: "a",
        contrato_id: "c-A",
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
        mes: 1,
      }),
      mkPago({
        id: "b",
        contrato_id: "c-B",
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
        mes: 2,
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === "historico_individual")).toBe(true);
  });

  it("un pago_real confirmado se mantiene como pago_real", () => {
    const items = buildPagoAgendaItems([
      mkPago({
        id: "r1",
        tipo_registro: "pago_real",
        afecta_finanzas_actuales: true,
        importe_pagado: 770,
        mes: 5,
        anio: 2026,
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("pago_real");
  });

  it("mezcla: pago_real + grupo histórico coexisten", () => {
    const items = buildPagoAgendaItems([
      mkPago({ id: "r", tipo_registro: "pago_real", afecta_finanzas_actuales: true, mes: 5, anio: 2026, importe_pagado: 770 }),
      mkPago({ id: "h1", tipo_registro: "historico_reconstruido", afecta_finanzas_actuales: false, mes: 1, anio: 2024 }),
      mkPago({ id: "h2", tipo_registro: "historico_reconstruido", afecta_finanzas_actuales: false, mes: 2, anio: 2024 }),
    ]);
    expect(items).toHaveLength(2);
    const kinds = items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["historico_grupo", "pago_real"]);
  });

  it("ignora pagos no confirmados", () => {
    const items = buildPagoAgendaItems([
      mkPago({ propietario_confirmado: false, propietario_confirmado_at: null }),
    ]);
    expect(items).toHaveLength(0);
  });
});