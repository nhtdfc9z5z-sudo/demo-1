import { describe, it, expect } from "vitest";
import { detectarHallazgos } from "../detectarHallazgos";

const today = new Date("2026-06-15T12:00:00Z");

function ctr(over: any = {}) {
  return {
    id: "ctr-1",
    property_id: "prop-1",
    renta_mensual: 900,
    fecha_inicio: "2025-01-01",
    fecha_fin: null,
    fecha_inicio_control: "2025-01-01",
    estado: "vigente",
    archivado: false,
    modalidad_alquiler: "completo",
    created_at: "2025-01-01",
    ...over,
  };
}

function pago(over: any = {}) {
  return {
    id: "p-1",
    property_id: "prop-1",
    inquilino_id: "inq-1",
    contrato_id: null,
    mes: 4,
    anio: 2026,
    importe_pagado: 900,
    tipo_registro: "pago_real" as const,
    afecta_finanzas_actuales: true,
    propietario_confirmado: true,
    inquilino_notificado: false,
    ...over,
  };
}

function link(contratoId: string, inquilinoId: string) {
  return { contrato_id: contratoId, inquilino_id: inquilinoId } as any;
}

describe("Sprint 3.9 — detectarHallazgos (auditoría visible de datos legacy)", () => {
  it("1) pago legacy con 2 contratos vigentes ⇒ ambiguo (no se atribuye)", () => {
    const contratos = [
      ctr({ id: "ctr-a" }),
      ctr({ id: "ctr-b" }),
    ];
    const personas = [link("ctr-a", "inq-1"), link("ctr-b", "inq-1")];
    const res = detectarHallazgos({
      contratos,
      contratoPersonas: personas,
      pagos: [pago()],
      today,
    });
    const ambiguos = res.agrupadosPorTipo["pago_sin_contrato_ambiguo"] ?? [];
    expect(ambiguos.length).toBe(1);
    expect(ambiguos[0].contratosCandidatos?.length).toBe(2);
  });

  it("2) pago legacy con 1 único contrato compatible ⇒ resoluble", () => {
    const contratos = [ctr({ id: "ctr-a" })];
    const personas = [link("ctr-a", "inq-1")];
    const res = detectarHallazgos({
      contratos, contratoPersonas: personas, pagos: [pago()], today,
    });
    const resoluble = res.agrupadosPorTipo["pago_sin_contrato_resoluble"] ?? [];
    expect(resoluble.length).toBe(1);
    expect(resoluble[0].contratosCandidatos).toEqual(["ctr-a"]);
  });

  it("3) duplicados mismo contrato/mes/año ⇒ pago_duplicado", () => {
    const contratos = [ctr({ id: "ctr-a" })];
    const personas = [link("ctr-a", "inq-1")];
    const pagos = [
      pago({ id: "p1", contrato_id: "ctr-a" }),
      pago({ id: "p2", contrato_id: "ctr-a" }),
    ];
    const res = detectarHallazgos({ contratos, contratoPersonas: personas, pagos, today });
    const dup = res.agrupadosPorTipo["pago_duplicado"] ?? [];
    expect(dup.length).toBe(1);
    expect(dup[0].pagoIds?.sort()).toEqual(["p1", "p2"]);
  });

  it("4) pago real + histórico mismo contrato/mes ⇒ pago_real_e_historico e inconsistencia", () => {
    const contratos = [ctr({ id: "ctr-a" })];
    const personas = [link("ctr-a", "inq-1")];
    const pagos = [
      pago({ id: "p1", contrato_id: "ctr-a", tipo_registro: "pago_real", afecta_finanzas_actuales: true }),
      pago({ id: "p2", contrato_id: "ctr-a", tipo_registro: "historico_reconstruido", afecta_finanzas_actuales: false }),
    ];
    const res = detectarHallazgos({ contratos, contratoPersonas: personas, pagos, today });
    expect((res.agrupadosPorTipo["pago_real_e_historico"] ?? []).length).toBe(1);
    // No debe duplicarse como "mes_inconsistente"
    expect((res.agrupadosPorTipo["mes_inconsistente"] ?? []).length).toBe(0);
  });

  it("5) activo con 2 contratos completos vigentes ⇒ alerta", () => {
    const contratos = [
      ctr({ id: "ctr-a", modalidad_alquiler: "completo" }),
      ctr({ id: "ctr-b", modalidad_alquiler: "completo" }),
    ];
    const res = detectarHallazgos({
      contratos, contratoPersonas: [], pagos: [], today,
    });
    const al = res.agrupadosPorTipo["activo_varios_contratos_completos"] ?? [];
    expect(al.length).toBe(1);
    expect(al[0].propertyId).toBe("prop-1");
  });

  it("6) contrato vigente sin renta ⇒ contrato_sin_renta", () => {
    const contratos = [ctr({ renta_mensual: null })];
    const res = detectarHallazgos({ contratos, contratoPersonas: [], pagos: [], today });
    expect((res.agrupadosPorTipo["contrato_sin_renta"] ?? []).length).toBe(1);
  });

  it("7) contrato sin fecha_inicio_control y con pagos históricos ⇒ aviso", () => {
    const contratos = [ctr({ fecha_inicio_control: null })];
    const personas = [link("ctr-1", "inq-1")];
    const pagos = [
      pago({ id: "p1", contrato_id: "ctr-1", tipo_registro: "historico_reconstruido", afecta_finanzas_actuales: false }),
    ];
    const res = detectarHallazgos({ contratos, contratoPersonas: personas, pagos, today });
    expect((res.agrupadosPorTipo["contrato_sin_fecha_inicio_control"] ?? []).length).toBe(1);
  });

  it("8) habitaciones (modalidad != completo) no disparan alerta de varios completos", () => {
    const contratos = [
      ctr({ id: "ctr-a", modalidad_alquiler: "habitaciones" }),
      ctr({ id: "ctr-b", modalidad_alquiler: "habitaciones" }),
    ];
    const res = detectarHallazgos({ contratos, contratoPersonas: [], pagos: [], today });
    expect((res.agrupadosPorTipo["activo_varios_contratos_completos"] ?? []).length).toBe(0);
  });
});