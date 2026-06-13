import { describe, it, expect } from "vitest";
import { fusionarResultados } from "../fusionarResultados";
import type { ContratoAnalysis } from "../types";

describe("fusionarResultados", () => {
  it("devuelve null si no hay análisis válidos", () => {
    expect(fusionarResultados([])).toBeNull();
    expect(fusionarResultados([null as any, undefined as any])).toBeNull();
  });

  it("primer archivo gana en campos escalares duplicados", () => {
    const a: ContratoAnalysis = {
      renta_mensual: 800,
      direccion_calle: "Calle Arces",
      fecha_inicio: "2024-01-01",
    };
    const b: ContratoAnalysis = {
      renta_mensual: 950, // ignorado (a gana)
      direccion_calle: "Calle Otra", // ignorado
      fianza_importe: 800, // a no lo tiene → b lo aporta
    };
    const out = fusionarResultados([a, b])!;
    expect(out.renta_mensual).toBe(800);
    expect(out.direccion_calle).toBe("Calle Arces");
    expect(out.fianza_importe).toBe(800);
    expect(out.fecha_inicio).toBe("2024-01-01");
  });

  it("ignora valores vacíos del primer archivo y usa los del siguiente", () => {
    const a: ContratoAnalysis = { direccion_calle: "", renta_mensual: 0 } as any;
    const b: ContratoAnalysis = { direccion_calle: "Calle Real", renta_mensual: 750 };
    const out = fusionarResultados([a, b])!;
    expect(out.direccion_calle).toBe("Calle Real");
    expect(out.renta_mensual).toBe(750);
  });

  it("acumula arrendatarios y deduplica por NIF (case/espacios)", () => {
    const a: ContratoAnalysis = {
      arrendatarios: [
        { nombre: "Ana López", nif: "12345678a" },
      ],
    };
    const b: ContratoAnalysis = {
      arrendatarios: [
        { nombre: "Ana López G.", nif: "12345678A", email: "ana@ex.com" },
        { nombre: "Pepe Ruiz", nif: "87654321B" },
      ],
    };
    const out = fusionarResultados([a, b])!;
    expect(out.arrendatarios).toHaveLength(2);
    const ana = out.arrendatarios!.find((x) => x.nif === "12345678a")!;
    // se queda el nombre del primero, pero el email del segundo completa el hueco
    expect(ana.nombre).toBe("Ana López");
    expect(ana.email).toBe("ana@ex.com");
  });

  it("deduplica por nombre cuando no hay NIF", () => {
    const a: ContratoAnalysis = { arrendatarios: [{ nombre: "  Juan  Pérez " }] };
    const b: ContratoAnalysis = {
      arrendatarios: [
        { nombre: "juan pérez", telefono: "600" },
        { nombre: "Otra Persona" },
      ],
    };
    const out = fusionarResultados([a, b])!;
    expect(out.arrendatarios).toHaveLength(2);
    const juan = out.arrendatarios!.find((x) =>
      (x.nombre || "").toLowerCase().includes("juan"),
    )!;
    expect(juan.telefono).toBe("600");
  });

  it("usa arrendatario_nombre (singular) como fallback si no hay array", () => {
    const a: ContratoAnalysis = {
      arrendatario_nombre: "Solo Uno",
      arrendatario_nif: "11111111H",
    };
    const out = fusionarResultados([a])!;
    expect(out.arrendatarios).toHaveLength(1);
    expect(out.arrendatarios![0].nombre).toBe("Solo Uno");
  });
});