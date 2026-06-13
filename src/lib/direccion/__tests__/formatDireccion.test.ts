import { describe, it, expect } from "vitest";
import { formatDireccion } from "../formatDireccion";

describe("formatDireccion", () => {
  it("formats piso urbano", () => {
    expect(
      formatDireccion({
        tipo_via: "Calle",
        nombre_via: "Arces",
        numero: "6",
        portal: "8",
        planta: "1",
        puerta: "B",
        codigo_postal: "28922",
        municipio: "Alcorcón",
        provincia: "Madrid",
      }),
    ).toBe("Calle Arces 6, Portal 8, 1ºB, 28922 Alcorcón (Madrid)");
  });

  it("formats chalet en urbanización", () => {
    expect(
      formatDireccion({
        urbanizacion: "Cotorredondo",
        parcela: "127",
        codigo_postal: "28976",
        municipio: "Batres",
        provincia: "Madrid",
      }),
    ).toBe("Urbanización Cotorredondo, Parcela 127, 28976 Batres (Madrid)");
  });

  it("rústica sin número usa s/n", () => {
    expect(
      formatDireccion({
        tipo_via: "Camino",
        nombre_via: "del Valle",
        municipio: "Batres",
      }),
    ).toBe("Camino del Valle s/n, Batres");
  });

  it("omite España por defecto", () => {
    expect(
      formatDireccion({
        tipo_via: "Calle",
        nombre_via: "Mayor",
        numero: "1",
        municipio: "Madrid",
        pais: "España",
      }),
    ).toBe("Calle Mayor 1, Madrid");
  });

  it("incluye país extranjero", () => {
    expect(
      formatDireccion({
        tipo_via: "Rue",
        nombre_via: "Lafayette",
        numero: "10",
        municipio: "Paris",
        pais: "Francia",
      }),
    ).toBe("Rue Lafayette 10, Paris, Francia");
  });

  it("vacío devuelve string vacío", () => {
    expect(formatDireccion({})).toBe("");
  });
});