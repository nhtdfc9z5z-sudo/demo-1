import { describe, it, expect } from "vitest";
import { computeMonthData } from "@/lib/finanzasEngine";
import { getEstadosMesPorContrato } from "@/lib/estadoMesContrato";
import type { PagoRenta } from "@/hooks/usePagosRenta";

/**
 * Sprint 3.8 — Migración consumidores a "contrato = unidad económica".
 *
 * Verifica que dashboard/tesorería (finanzasEngine) y calendario
 * (getEstadosMesPorContrato) coinciden y que ya NO duplican por
 * inquilino ni por activo.
 */

const prop = { id: "prop-1", nombre_interno: "Piso", cuota_comunidad: null, seguros: [] } as any;
const propRooms = { id: "prop-2", nombre_interno: "Coliving", cuota_comunidad: null, seguros: [] } as any;
const propSinContrato = { id: "prop-3", nombre_interno: "Vacío", cuota_comunidad: null, seguros: [] } as any;

const contratoCompleto: any = {
  id: "ctr-comp",
  property_id: prop.id,
  inquilino_id: null,
  archivado: false,
  estado: "vigente",
  renta_mensual: 900,
  fecha_inicio: "2025-01-01",
  fecha_fin: null,
  fecha_inicio_control: "2025-01-01",
  created_at: "2025-01-01",
};

const contratoHab1: any = {
  id: "ctr-h1",
  property_id: propRooms.id,
  inquilino_id: "inq-a",
  archivado: false,
  estado: "vigente",
  renta_mensual: 400,
  fecha_inicio: "2025-01-01",
  fecha_fin: null,
  fecha_inicio_control: "2025-01-01",
  created_at: "2025-01-01",
};
const contratoHab2: any = {
  id: "ctr-h2",
  property_id: propRooms.id,
  inquilino_id: "inq-b",
  archivado: false,
  estado: "vigente",
  renta_mensual: 450,
  fecha_inicio: "2025-01-01",
  fecha_fin: null,
  fecha_inicio_control: "2025-01-01",
  created_at: "2025-01-01",
};

const contratoNoGestionado: any = {
  id: "ctr-ng",
  property_id: prop.id,
  inquilino_id: "inq-z",
  archivado: false,
  estado: "vigente",
  renta_mensual: 900,
  fecha_inicio: "2018-01-01",
  fecha_fin: null,
  // control empieza después del mes evaluado ⇒ no_gestionado
  fecha_inicio_control: "2026-06-01",
  created_at: "2026-06-01",
};

function pago(over: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: prop.id,
    inquilino_id: "inq-a",
    mes: 6, anio: 2026,
    inquilino_notificado: false,
    inquilino_notificado_at: null,
    propietario_confirmado: true,
    propietario_confirmado_at: "2026-06-05T10:00:00Z",
    importe_pagado: 0,
    tipo_pago: "transferencia",
    notas_acuerdo: null,
    user_id: "u-1",
    created_at: "2026-06-05T10:00:00Z",
    updated_at: "2026-06-05T10:00:00Z",
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: "2026-06-01",
    fecha_pago_real: "2026-06-05",
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    contrato_id: null,
    ...over,
  } as PagoRenta;
}

describe("Sprint 3.8 — consumidores iteran por contrato (no por property_id)", () => {
  it("1) Vivienda con 1 contrato y 2 inquilinos solidarios ⇒ NO duplica renta", () => {
    // Modelo canónico: un solo pago por (contrato,mes). Aunque conceptualmente
    // hay 2 inquilinos, sólo hay un pago real registrado.
    const pagos = [
      pago({ contrato_id: "ctr-comp", inquilino_id: "inq-a", importe_pagado: 900 }),
    ];
    const r = computeMonthData(2026, 5, [prop], [], pagos, undefined, [contratoCompleto]);
    expect(r.ingresos).toBe(900);
  });

  it("2) Vivienda con 2 habitaciones / 2 contratos ⇒ suma ambas rentas", () => {
    const pagos = [
      pago({ contrato_id: "ctr-h1", inquilino_id: "inq-a", property_id: propRooms.id, importe_pagado: 400 }),
      pago({ contrato_id: "ctr-h2", inquilino_id: "inq-b", property_id: propRooms.id, importe_pagado: 450 }),
    ];
    const r = computeMonthData(2026, 5, [propRooms], [], pagos, undefined, [contratoHab1, contratoHab2]);
    expect(r.ingresos).toBe(850);
  });

  it("3) Property sin contrato y sin inquilinos ⇒ no genera deuda ni ingresos", () => {
    const r = computeMonthData(2026, 5, [propSinContrato], [], [], undefined, []);
    expect(r.ingresos).toBe(0);
    expect(r.gastos).toBe(0);
  });

  it("4) Contrato no_gestionado no genera pendiente ni ingresos", () => {
    const pagos: PagoRenta[] = [];
    // Mes 3/2026 es anterior a fecha_inicio_control 2026-06-01 ⇒ no_gestionado.
    const r = computeMonthData(2026, 2, [prop], [], pagos, undefined, [contratoNoGestionado]);
    expect(r.ingresos).toBe(0);
    const estados = getEstadosMesPorContrato({
      contratos: [contratoNoGestionado],
      mes: 3, anio: 2026, pagos,
      today: new Date("2026-07-01T12:00:00Z"),
    });
    expect(estados).toHaveLength(1);
    expect(estados[0].status).toBe("no_gestionado");
    expect(estados[0].mostrarPendiente).toBe(false);
  });

  it("5) Calendario y dashboard coinciden en importes para el mismo mes", () => {
    const pagos = [
      pago({ contrato_id: "ctr-h1", inquilino_id: "inq-a", property_id: propRooms.id, importe_pagado: 400 }),
      pago({ contrato_id: "ctr-h2", inquilino_id: "inq-b", property_id: propRooms.id, importe_pagado: 450 }),
    ];
    const fromEngine = computeMonthData(2026, 5, [propRooms], [], pagos, undefined, [contratoHab1, contratoHab2]).ingresos;
    const fromCalendario = getEstadosMesPorContrato({
      contratos: [contratoHab1, contratoHab2],
      mes: 6, anio: 2026, pagos,
      today: new Date("2026-06-30T12:00:00Z"),
    }).reduce((s, e) => s + e.cobradoReal, 0);
    expect(fromCalendario).toBe(fromEngine);
    expect(fromCalendario).toBe(850);
  });
});
