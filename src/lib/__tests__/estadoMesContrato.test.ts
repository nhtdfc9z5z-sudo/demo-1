import { describe, it, expect } from "vitest";
import { getEstadoMesContrato } from "../estadoMesContrato";

const baseContrato = {
  id: "ctr-1",
  renta_mensual: 900,
  fecha_inicio: "2024-01-01",
  fecha_fin: null,
  fecha_inicio_control: "2026-06-01",
  created_at: "2026-06-01",
} as any;

function pago(over: any) {
  return {
    contrato_id: "ctr-1",
    mes: 6,
    anio: 2026,
    importe_pagado: 0,
    tipo_registro: "pago_real",
    afecta_finanzas_actuales: true,
    propietario_confirmado: true,
    inquilino_notificado: false,
    ...over,
  };
}

describe("Sprint 3.8 — getEstadoMesContrato (única fuente de verdad)", () => {
  it("1) Contrato al día (fecha_inicio_control=hoy) ⇒ meses previos no_gestionado, sin deuda", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 1,
      anio: 2025,
      pagos: [],
      today: new Date("2026-06-15T12:00:00Z"),
    });
    expect(res.status).toBe("no_gestionado");
    expect(res.deuda).toBe(0);
    expect(res.fueraDeControl).toBe(true);
    expect(res.rentaEsperada).toBe(0);
  });

  it("2) Contrato con 2 inquilinos solidarios: una sola fila por (contrato,mes) ⇒ no duplica renta", () => {
    // Modelo canónico: un solo pago por contrato/mes (UNIQUE(contrato_id,mes,anio)).
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [pago({ importe_pagado: 900 })],
      today: new Date("2026-06-30T12:00:00Z"),
    });
    expect(res.status).toBe("pagado");
    expect(res.cobradoReal).toBe(900);
    expect(res.deuda).toBe(0);
  });

  it("3) Pago histórico cubre visualmente el mes pero NO suma a finanzas actuales", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 7,
      anio: 2026,
      pagos: [
        pago({
          mes: 7,
          importe_pagado: 900,
          tipo_registro: "historico_reconstruido",
          afecta_finanzas_actuales: false,
        }),
      ],
      today: new Date("2026-08-10T12:00:00Z"),
    });
    expect(res.status).toBe("historico");
    expect(res.cobradoReal).toBe(0); // no entra en tesorería
    expect(res.cobradoHistorico).toBe(900);
    expect(res.cubiertoPorHistorico).toBe(true);
    expect(res.deuda).toBe(0);
  });

  it("4) Pago parcial real deja deuda pendiente correcta", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [pago({ importe_pagado: 500 })],
      today: new Date("2026-06-30T12:00:00Z"),
    });
    expect(res.status).toBe("parcial");
    expect(res.deuda).toBe(400);
  });

  it("5) Mes fuera de control no aparece como pendiente aunque sea pasado", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 3,
      anio: 2026, // anterior a fecha_inicio_control 2026-06-01
      pagos: [],
      today: new Date("2026-07-01T12:00:00Z"),
    });
    expect(res.status).toBe("no_gestionado");
    expect(res.mostrarPendiente).toBe(false);
    expect(res.mostrarImpago).toBe(false);
  });

  it("6) Fiscalidad: pago_real con afecta_finanzas_actuales=false NO cuenta como real", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [
        pago({ importe_pagado: 900, afecta_finanzas_actuales: false }),
      ],
      today: new Date("2026-06-30T12:00:00Z"),
    });
    expect(res.hasReal).toBe(false);
    expect(res.cobradoReal).toBe(0);
    expect(res.status).toBe("pendiente");
  });

  it("7) Calendario y dashboard devuelven el mismo estado para el mismo contrato/mes", () => {
    const inputs = {
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [pago({ importe_pagado: 900 })],
      today: new Date("2026-06-30T12:00:00Z"),
    };
    const a = getEstadoMesContrato(inputs);
    const b = getEstadoMesContrato(inputs);
    expect(a.status).toBe(b.status);
    expect(a.deuda).toBe(b.deuda);
    expect(a.cobradoReal).toBe(b.cobradoReal);
  });

  it("Ignora pagos sin contrato_id o de otros contratos", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [
        pago({ contrato_id: "otro", importe_pagado: 9999 }),
        pago({ contrato_id: null, importe_pagado: 9999 } as any),
      ],
      today: new Date("2026-06-30T12:00:00Z"),
    });
    expect(res.cobradoReal).toBe(0);
    expect(res.status).toBe("pendiente");
  });

  it("Inconsistente: convive pago_real e histórico ⇒ flag activo, sin inventar deuda", () => {
    const res = getEstadoMesContrato({
      contrato: baseContrato,
      mes: 6,
      anio: 2026,
      pagos: [
        pago({ importe_pagado: 900 }),
        pago({
          importe_pagado: 900,
          tipo_registro: "historico_reconstruido",
          afecta_finanzas_actuales: false,
        }),
      ],
      today: new Date("2026-06-30T12:00:00Z"),
    });
    expect(res.inconsistente).toBe(true);
    expect(res.status).toBe("pagado");
    expect(res.deuda).toBe(0);
  });
});
