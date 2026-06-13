import { describe, it, expect } from "vitest";
import { calcularEstadoMes, calcularEstadoMesCalendario, isPagoRealEffective, isPagoHistorico } from "../rentaUtils";

describe("H2.7 — calcularEstadoMes", () => {
  it("cobro real completo → pagado, sin deuda", () => {
    const r = calcularEstadoMes(570, 570, 0, { hasReal: true, hasHistorico: false });
    expect(r.estado).toBe("pagado");
    expect(r.deudaReal).toBe(0);
    expect(r.inconsistente).toBe(false);
  });

  it("cobro real parcial → parcial, deuda contra real solamente", () => {
    const r = calcularEstadoMes(770, 500, 0, { hasReal: true, hasHistorico: false });
    expect(r.estado).toBe("parcial");
    expect(r.deudaReal).toBe(270);
  });

  it("sólo histórico que cubre la renta → historico, deuda 0", () => {
    const r = calcularEstadoMes(570, 0, 570, { hasReal: false, hasHistorico: true });
    expect(r.estado).toBe("historico");
    expect(r.deudaReal).toBe(0);
    expect(r.cubiertoPorHistorico).toBe(true);
  });

  it("sólo histórico insuficiente → pendiente (no parcial)", () => {
    const r = calcularEstadoMes(770, 0, 300, { hasReal: false, hasHistorico: true });
    expect(r.estado).toBe("pendiente");
    expect(r.deudaReal).toBe(770);
  });

  it("cobro real + histórico simultáneos → marca inconsistente", () => {
    const r = calcularEstadoMes(570, 570, 570, { hasReal: true, hasHistorico: true });
    expect(r.estado).toBe("pagado");
    expect(r.inconsistente).toBe(true);
  });

  it("pago_real con afecta_finanzas_actuales=false NO cuenta como real", () => {
    expect(isPagoRealEffective({ tipo_registro: "pago_real", afecta_finanzas_actuales: false })).toBe(false);
    expect(isPagoRealEffective({ tipo_registro: "pago_real" })).toBe(true);
    expect(isPagoRealEffective({})).toBe(true); // legacy default
  });

  it("isPagoHistorico detecta historico_reconstruido y regularizado", () => {
    expect(isPagoHistorico({ tipo_registro: "historico_reconstruido" })).toBe(true);
    expect(isPagoHistorico({ tipo_registro: "regularizado" })).toBe(true);
    expect(isPagoHistorico({ tipo_registro: "pago_real" })).toBe(false);
  });

  it("pago real de 0€ (dato sucio legacy) NO produce parcial fantasma", () => {
    // cobradoReal=0, sin histórico, renta 570 → pendiente, no parcial
    const r = calcularEstadoMes(570, 0, 0, { hasReal: true, hasHistorico: false });
    // Con cobradoReal ≈ 0 caemos en rama "sin cobro real". Sin histórico → pendiente.
    expect(r.estado).toBe("pendiente");
    expect(r.deudaReal).toBe(570);
  });

  it("calendario: meses anteriores a fecha_inicio_control quedan no gestionados", () => {
    const contrato = {
      fecha_inicio: "2018-04-02",
      created_at: "2026-06-02",
      fecha_inicio_control: "2026-06-02",
    };

    const mayo2026 = calcularEstadoMesCalendario({
      contrato,
      mes: 5,
      anio: 2026,
      rentaEsperada: 570,
      cobradoReal: 0,
      cobradoHistorico: 0,
      hasReal: false,
      hasHistorico: false,
      hasNotificado: false,
      today: new Date("2026-06-20T12:00:00Z"),
    });

    expect(mayo2026.status).toBe("no_gestionado");
    expect(mayo2026.deuda).toBe(0);
    expect(mayo2026.mostrarImpago).toBe(false);
    expect(mayo2026.mostrarPendiente).toBe(false);
    expect(mayo2026.actionsEnabled).toBe(false);
  });

  it("calendario: desde fecha_inicio_control sí evalúa impago real", () => {
    const contrato = {
      fecha_inicio: "2018-04-02",
      created_at: "2026-06-02",
      fecha_inicio_control: "2026-06-02",
    };

    const junio2026 = calcularEstadoMesCalendario({
      contrato,
      mes: 6,
      anio: 2026,
      rentaEsperada: 570,
      cobradoReal: 0,
      cobradoHistorico: 0,
      hasReal: false,
      hasHistorico: false,
      hasNotificado: false,
      today: new Date("2026-07-10T12:00:00Z"),
    });

    expect(junio2026.status).toBe("impago");
    expect(junio2026.deuda).toBe(570);
    expect(junio2026.mostrarImpago).toBe(true);
    expect(junio2026.actionsEnabled).toBe(true);
  });
});