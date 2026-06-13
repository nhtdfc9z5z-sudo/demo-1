import { describe, it, expect } from "vitest";
import {
  labelTipoContrato,
  microcopyTipoContrato,
  mapOCRTipoToTipoContrato,
  TIPOS_CONTRATO,
} from "../tipoContrato";

describe("tipoContrato helpers", () => {
  it("expone los 5 tipos esperados", () => {
    expect(TIPOS_CONTRATO).toEqual([
      "habitual",
      "vacacional",
      "habitaciones",
      "rent_to_rent",
      "cesion_empresa",
    ]);
  });

  it("etiquetas y microcopy no vacíos para todos los tipos", () => {
    for (const t of TIPOS_CONTRATO) {
      expect(labelTipoContrato(t).length).toBeGreaterThan(3);
      expect(microcopyTipoContrato(t).length).toBeGreaterThan(3);
    }
  });

  it("mapea enum OCR heredado", () => {
    expect(mapOCRTipoToTipoContrato("larga_duracion")).toBe("habitual");
    expect(mapOCRTipoToTipoContrato("vacacional")).toBe("vacacional");
    expect(mapOCRTipoToTipoContrato("habitacion")).toBe("habitaciones");
    expect(mapOCRTipoToTipoContrato("explotacion")).toBe("rent_to_rent");
  });

  it("acepta también los nombres nuevos directamente", () => {
    expect(mapOCRTipoToTipoContrato("habitual")).toBe("habitual");
    expect(mapOCRTipoToTipoContrato("habitaciones")).toBe("habitaciones");
    expect(mapOCRTipoToTipoContrato("rent_to_rent")).toBe("rent_to_rent");
    expect(mapOCRTipoToTipoContrato("cesion_empresa")).toBe("cesion_empresa");
  });

  it("devuelve null para valores desconocidos o vacíos", () => {
    expect(mapOCRTipoToTipoContrato(null)).toBeNull();
    expect(mapOCRTipoToTipoContrato("")).toBeNull();
    expect(mapOCRTipoToTipoContrato("otro")).toBeNull();
  });
});
