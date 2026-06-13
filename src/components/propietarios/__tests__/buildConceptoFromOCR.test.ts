import { describe, it, expect } from "vitest";
import { buildConceptoFromOCR } from "../GastoRapidoSheet";

describe("buildConceptoFromOCR", () => {
  it("prioridad 1: concatena factura_detalle_lineas con ' · '", () => {
    const r = {
      factura_detalle_lineas: [
        "Cuota comunidad propietarios",
        "Fondo de reserva",
        "Derrama ascensor (6/24)",
      ],
      factura_concepto: "Comunidad",
    };
    expect(buildConceptoFromOCR(r)).toBe(
      "Cuota comunidad propietarios · Fondo de reserva · Derrama ascensor (6/24)",
    );
  });

  it("prioridad 2: usa factura_concepto si no hay líneas", () => {
    expect(buildConceptoFromOCR({ factura_concepto: "Reparación caldera" }))
      .toBe("Reparación caldera");
    expect(buildConceptoFromOCR({ factura_detalle_lineas: [], factura_concepto: "Caldera" }))
      .toBe("Caldera");
  });

  it("prioridad 3: vacío si OCR no aporta nada", () => {
    expect(buildConceptoFromOCR({})).toBe("");
    expect(buildConceptoFromOCR({ factura_detalle_lineas: ["", "  "] })).toBe("");
  });
});