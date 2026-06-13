import { describe, it, expect } from "vitest";
import { detectarPendientes } from "../pendientes";

describe("detectarPendientes", () => {
  it("propietario_unico: sin pendientes", () => {
    expect(detectarPendientes({ relacion: "propietario_unico" })).toEqual([]);
  });

  it("copropietarios: vacío marca pendiente", () => {
    expect(detectarPendientes({ relacion: "copropietarios", copropietarios: [] }))
      .toContain("copropietarios_vacio");
  });

  it("copropietarios: campos vacíos se marcan por índice", () => {
    const r = detectarPendientes({
      relacion: "copropietarios",
      copropietarios: [{ nombre: "", dni: "", porcentaje: "" }],
    });
    expect(r).toEqual(
      expect.arrayContaining(["copropietario_0_nombre", "copropietario_0_dni", "copropietario_0_porcentaje"]),
    );
  });

  it("copropietarios: suma ≠ 100 marca pendiente", () => {
    const r = detectarPendientes({
      relacion: "copropietarios",
      copropietarios: [
        { nombre: "A", dni: "1A", porcentaje: "40" },
        { nombre: "B", dni: "2B", porcentaje: "40" },
      ],
    });
    expect(r).toContain("copropietarios_suma");
  });

  it("copropietarios: suma = 100 sin pendientes", () => {
    const r = detectarPendientes({
      relacion: "copropietarios",
      copropietarios: [
        { nombre: "A", dni: "1A", porcentaje: "50" },
        { nombre: "B", dni: "2B", porcentaje: "50" },
      ],
    });
    expect(r).toEqual([]);
  });

  it("usufructuario: pide nudo propietario", () => {
    const r = detectarPendientes({ relacion: "usufructuario" });
    expect(r).toEqual(["nudo_propietario_nombre", "nudo_propietario_nif"]);
  });

  it("gestor: comision opcional, no pendiente", () => {
    const r = detectarPendientes({
      relacion: "gestor",
      tercero_nombre: "X",
      tercero_dni: "Y",
    });
    expect(r).toEqual([]);
  });

  it("subarrendador: renta_pagada obligatoria", () => {
    const r = detectarPendientes({
      relacion: "subarrendador",
      tercero_nombre: "X",
      tercero_dni: "Y",
    });
    expect(r).toContain("renta_pagada_mensual");
  });
});
