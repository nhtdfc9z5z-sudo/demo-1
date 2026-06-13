import { describe, it, expect } from "vitest";
import {
  computeMonthData,
  pagoCuentaEnFiscalidad,
  getAnioFiscalPago,
} from "@/lib/finanzasEngine";
import type { PagoRenta } from "@/hooks/usePagosRenta";

// ─── Fixtures mínimos ─────────────────────────────────────────────

const prop: any = {
  id: "prop-1",
  nombre_interno: "Piso A",
  cuota_comunidad: null,
  ibi_importe: null,
  basuras_importe: null,
  tiene_derrama: false,
  seguros: [],
};

const inquilino: any = {
  id: "inq-1",
  property_id: "prop-1",
  rol_inquilino: "titular",
  fecha_entrada: "2024-01-01",
  fecha_salida: null,
  renta_mensual: 1000,
};

function makePago(over: Partial<PagoRenta> = {}): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: "prop-1",
    inquilino_id: "inq-1",
    mes: 3,
    anio: 2025,
    inquilino_notificado: false,
    inquilino_notificado_at: null,
    propietario_confirmado: true,
    propietario_confirmado_at: "2025-03-05T10:00:00Z",
    importe_pagado: 1000,
    tipo_pago: "transferencia",
    notas_acuerdo: null,
    user_id: "u-1",
    created_at: "2025-03-05T10:00:00Z",
    updated_at: "2025-03-05T10:00:00Z",
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: "2025-03-01",
    fecha_pago_real: "2025-03-05",
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    ...over,
  } as PagoRenta;
}

describe("finanzasEngine.computeMonthData — reglas económicas", () => {
  it("suma SOLO pago_real con afecta_finanzas_actuales=true", () => {
    const pagos = [makePago()];
    const r = computeMonthData(2025, 2, [prop], [inquilino], pagos);
    expect(r.ingresos).toBe(1000);
  });

  it("ignora historico_reconstruido aunque esté confirmado", () => {
    const pagos = [
      makePago({
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
      }),
    ];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(0);
  });

  it("ignora regularizado", () => {
    const pagos = [
      makePago({ tipo_registro: "regularizado", afecta_finanzas_actuales: false }),
    ];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(0);
  });

  it("ignora pendiente (importe 0 y tipo pendiente)", () => {
    const pagos = [
      makePago({
        tipo_registro: "pendiente",
        importe_pagado: 0,
        propietario_confirmado: false,
        inquilino_notificado: false,
        afecta_finanzas_actuales: false,
      }),
    ];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(0);
  });

  it("ignora cualquier registro con afecta_finanzas_actuales=false aunque sea pago_real", () => {
    const pagos = [makePago({ afecta_finanzas_actuales: false })];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(0);
  });

  it("suma pago_real notificado por inquilino aunque aún no esté confirmado por propietario", () => {
    const pagos = [
      makePago({
        propietario_confirmado: false,
        inquilino_notificado: true,
      }),
    ];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(1000);
  });

  it("combina múltiples pagos reales en distintos meses sin mezclar", () => {
    const pagos = [
      makePago({ mes: 3, importe_pagado: 1000 }),
      makePago({ mes: 4, importe_pagado: 900 }),
    ];
    expect(computeMonthData(2025, 2, [prop], [inquilino], pagos).ingresos).toBe(1000);
    expect(computeMonthData(2025, 3, [prop], [inquilino], pagos).ingresos).toBe(900);
  });
});

describe("finanzasEngine fiscalidad helpers", () => {
  it("getAnioFiscalPago usa fecha_devengo cuando existe", () => {
    expect(getAnioFiscalPago({ fecha_devengo: "2024-12-01", anio: 2025 })).toBe(2024);
  });

  it("getAnioFiscalPago hace fallback a anio si fecha_devengo es null/invalida", () => {
    expect(getAnioFiscalPago({ fecha_devengo: null, anio: 2025 })).toBe(2025);
    expect(getAnioFiscalPago({ fecha_devengo: "" as any, anio: 2025 })).toBe(2025);
  });

  it("pagoCuentaEnFiscalidad — incluye solo si propietario_confirmado y afecta_fiscalidad!=false", () => {
    expect(pagoCuentaEnFiscalidad(makePago(), 2025)).toBe(true);
    expect(
      pagoCuentaEnFiscalidad(makePago({ propietario_confirmado: false }), 2025),
    ).toBe(false);
    expect(
      pagoCuentaEnFiscalidad(makePago({ afecta_fiscalidad: false }), 2025),
    ).toBe(false);
  });

  it("pagoCuentaEnFiscalidad — imputa al año del devengo, NO al de registro", () => {
    const p = makePago({
      anio: 2024,
      mes: 12,
      fecha_devengo: "2024-12-01",
      // fecha_pago_real en 2025 (cobro tardío) no debe imputar a 2025 fiscalmente
      fecha_pago_real: "2025-01-15",
      created_at: "2025-01-15T10:00:00Z",
    });
    expect(pagoCuentaEnFiscalidad(p, 2024)).toBe(true);
    expect(pagoCuentaEnFiscalidad(p, 2025)).toBe(false);
  });

  it("pagoCuentaEnFiscalidad — sin fecha_devengo cae a anio (fallback seguro)", () => {
    const p = makePago({ fecha_devengo: null, anio: 2023 });
    expect(pagoCuentaEnFiscalidad(p, 2023)).toBe(true);
    expect(pagoCuentaEnFiscalidad(p, 2024)).toBe(false);
  });
});