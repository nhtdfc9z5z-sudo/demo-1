import { describe, it, expect } from "vitest";
import {
  normalizarTipoVia,
  normalizarPlanta,
  normalizarPuerta,
  parseDireccionLibre,
  formatearPlantaDisplay,
} from "../normalizacion";

describe("normalizarTipoVia", () => {
  it("acepta el código en mayúsculas o minúsculas", () => {
    expect(normalizarTipoVia("CL")).toBe("CL");
    expect(normalizarTipoVia("av")).toBe("AV");
  });

  it("reconoce palabras completas con o sin acentos", () => {
    expect(normalizarTipoVia("Calle")).toBe("CL");
    expect(normalizarTipoVia("Avenida")).toBe("AV");
    expect(normalizarTipoVia("Plaza")).toBe("PZ");
    expect(normalizarTipoVia("Paseo")).toBe("PS");
    expect(normalizarTipoVia("Travesía")).toBe("TR");
    expect(normalizarTipoVia("Travesia")).toBe("TR");
  });

  it("reconoce abreviaturas habituales", () => {
    expect(normalizarTipoVia("Avda.")).toBe("AV");
    expect(normalizarTipoVia("Pza")).toBe("PZ");
    expect(normalizarTipoVia("Ctra")).toBe("CR");
  });

  it("devuelve null para texto no reconocido", () => {
    expect(normalizarTipoVia("")).toBeNull();
    expect(normalizarTipoVia(undefined)).toBeNull();
    expect(normalizarTipoVia("nada123")).toBeNull();
  });
});

describe("normalizarPlanta", () => {
  it("textos comunes", () => {
    expect(normalizarPlanta("bajo")).toBe("BJ");
    expect(normalizarPlanta("Baja")).toBe("BJ");
    expect(normalizarPlanta("entresuelo")).toBe("EN");
    expect(normalizarPlanta("Principal")).toBe("PR");
    expect(normalizarPlanta("sótano")).toBe("SS");
  });

  it("plantas numéricas con ordinal", () => {
    expect(normalizarPlanta("1º")).toBe("01");
    expect(normalizarPlanta("2ª")).toBe("02");
    expect(normalizarPlanta("10")).toBe("10");
    expect(normalizarPlanta("3 A")).toBe("03");
  });

  it("códigos directos", () => {
    expect(normalizarPlanta("BJ")).toBe("BJ");
    expect(normalizarPlanta("en")).toBe("EN");
  });

  it("ordinales escritos", () => {
    expect(normalizarPlanta("primera")).toBe("01");
    expect(normalizarPlanta("Segunda")).toBe("02");
    expect(normalizarPlanta("tercero")).toBe("03");
  });

  it("devuelve null si no entiende", () => {
    expect(normalizarPlanta("")).toBeNull();
    expect(normalizarPlanta("xxxx")).toBeNull();
  });
});

describe("formatearPlantaDisplay", () => {
  it("ordinales escritos a formato legible", () => {
    expect(formatearPlantaDisplay("segunda")).toBe("2ª planta");
    expect(formatearPlantaDisplay("primera")).toBe("1ª planta");
    expect(formatearPlantaDisplay("3")).toBe("3ª planta");
    expect(formatearPlantaDisplay("2º")).toBe("2ª planta");
  });
  it("códigos especiales", () => {
    expect(formatearPlantaDisplay("bajo")).toBe("Bajo");
    expect(formatearPlantaDisplay("principal")).toBe("Principal");
    expect(formatearPlantaDisplay("atico")).toBe("Ático");
  });
  it("vacío y desconocido", () => {
    expect(formatearPlantaDisplay("")).toBe("");
    expect(formatearPlantaDisplay("xxxx")).toBe("xxxx");
  });
});

describe("normalizarPuerta", () => {
  it("variantes de izquierda/derecha/centro", () => {
    expect(normalizarPuerta("izquierda")).toBe("IZ");
    expect(normalizarPuerta("izda")).toBe("IZ");
    expect(normalizarPuerta("izq")).toBe("IZ");
    expect(normalizarPuerta("dcha")).toBe("DR");
    expect(normalizarPuerta("Derecha")).toBe("DR");
    expect(normalizarPuerta("centro")).toBe("CT");
  });

  it("letras", () => {
    expect(normalizarPuerta("a")).toBe("A");
    expect(normalizarPuerta("B")).toBe("B");
  });

  it("devuelve null si no entiende", () => {
    expect(normalizarPuerta("")).toBeNull();
    expect(normalizarPuerta(undefined)).toBeNull();
    expect(normalizarPuerta("zzz")).toBeNull();
  });
});

describe("parseDireccionLibre", () => {
  it("Calle Gran Vía 24", () => {
    const r = parseDireccionLibre("Calle Gran Vía 24");
    expect(r.tipo_via_codigo).toBe("CL");
    expect(r.tipo_via_label).toBe("Calle");
    expect(r.nombre_via).toBe("Gran Vía");
    expect(r.numero).toBe("24");
  });

  it("Avenida de Portugal 30", () => {
    const r = parseDireccionLibre("Avenida de Portugal 30");
    expect(r.tipo_via_codigo).toBe("AV");
    expect(r.nombre_via).toBe("Portugal");
    expect(r.numero).toBe("30");
  });

  it("Plaza Mayor 1", () => {
    const r = parseDireccionLibre("Plaza Mayor 1");
    expect(r.tipo_via_codigo).toBe("PZ");
    expect(r.nombre_via).toBe("Mayor");
    expect(r.numero).toBe("1");
  });

  it("conserva el número aunque venga con coma", () => {
    const r = parseDireccionLibre("Calle Arces, 12");
    expect(r.nombre_via).toBe("Arces");
    expect(r.numero).toBe("12");
  });

  it("número bis", () => {
    const r = parseDireccionLibre("Calle Mayor 24 bis");
    expect(r.numero?.toLowerCase()).toBe("24 bis");
  });

  it("sin número (s/n)", () => {
    const r = parseDireccionLibre("Camino del Pilar s/n");
    expect(r.tipo_via_codigo).toBe("CM");
    expect(r.numero).toBe("s/n");
  });

  it("sin tipo reconocido conserva todo en nombre_via", () => {
    const r = parseDireccionLibre("Parque Vosa");
    expect(r.tipo_via_codigo).toBeNull();
    expect(r.nombre_via).toBe("Parque Vosa");
    expect(r.numero).toBeNull();
  });

  it("solo nombre y número", () => {
    const r = parseDireccionLibre("Gran Vía 24");
    expect(r.tipo_via_codigo).toBeNull();
    expect(r.nombre_via).toBe("Gran Vía");
    expect(r.numero).toBe("24");
  });

  it("vacío", () => {
    const r = parseDireccionLibre("");
    expect(r.nombre_via).toBe("");
    expect(r.numero).toBeNull();
  });
});