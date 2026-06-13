import { describe, it, expect, vi } from "vitest";
import {
  prepararConsultaCatastro,
  ejecutarConsultaCatastro,
} from "../prepararConsulta";
import type { ConsultaCatastroResult } from "../consultarCatastro";

describe("prepararConsultaCatastro", () => {
  it("devuelve 3 intentos cuando hay planta/puerta + número + sigla", () => {
    const intentos = prepararConsultaCatastro({
      tipo_via: "Calle",
      nombre_via: "Mayor",
      numero: "12",
      planta: "2",
      puerta: "A",
      municipio: "Móstoles",
      provincia: "Madrid",
    });
    expect(intentos).toHaveLength(3);
    expect(intentos[0].etiqueta).toBe("completo:sigla+nº+piso+puerta");
    expect(intentos[0].tipo_via).toBe("CL");
    expect(intentos[0].planta).toBe("02");
    expect(intentos[0].puerta).toBe("A");
    expect(intentos[1].etiqueta).toBe("edificio:sigla+nº");
    expect(intentos[2].etiqueta).toBe("minimo:nº-sin-sigla");
    // Municipio normalizado sin acentos y en mayúsculas.
    expect(intentos[0].municipio).toBe("MOSTOLES");
  });

  it("deduplica intentos cuando no hay planta/puerta", () => {
    const intentos = prepararConsultaCatastro({
      tipo_via: "Calle",
      nombre_via: "Gavilán",
      numero: "38",
      municipio: "Batres",
      provincia: "Madrid",
    });
    expect(intentos.length).toBe(2);
    expect(intentos[0].etiqueta).toBe("edificio:sigla+nº");
    expect(intentos[1].etiqueta).toBe("minimo:nº-sin-sigla");
  });

  it("nunca supera 3 intentos", () => {
    const intentos = prepararConsultaCatastro({
      tipo_via: "Avenida",
      nombre_via: "Portugal",
      numero: "30",
      planta: "1",
      puerta: "B",
      municipio: "Madrid",
      provincia: "Madrid",
    });
    expect(intentos.length).toBeLessThanOrEqual(3);
  });

  it("prepara intento rústico cuando hay polígono y parcela", () => {
    const intentos = prepararConsultaCatastro({
      poligono: "3",
      parcela: "14",
      municipio: "Batres",
      provincia: "Madrid",
    });
    expect(intentos).toHaveLength(1);
    expect(intentos[0].etiqueta).toBe("rustica:poligono+parcela");
    expect(intentos[0].poligono).toBe("3");
    expect(intentos[0].parcela).toBe("14");
  });

  it("devuelve [] sin datos mínimos", () => {
    expect(prepararConsultaCatastro({})).toEqual([]);
    expect(
      prepararConsultaCatastro({ municipio: "Madrid", provincia: "Madrid" }),
    ).toEqual([]);
  });

  it("infiere sigla desde el nombre de vía si tipo_via va vacío", () => {
    const intentos = prepararConsultaCatastro({
      tipo_via: "",
      nombre_via: "Calle Mayor",
      numero: "5",
      municipio: "Madrid",
      provincia: "Madrid",
    });
    expect(intentos[0].tipo_via).toBe("CL");
    expect(intentos[0].nombre_via).toBe("Mayor");
  });
});

describe("ejecutarConsultaCatastro", () => {
  const ok = (n = 1): ConsultaCatastroResult => ({
    ok: true,
    resultados: Array.from({ length: n }, (_, i) => ({
      referencia_catastral: `REF${i}`,
      referencia_catastral_parcial: null,
      superficie_construida_m2: null,
      ano_construccion: null,
      direccion_completa: null,
    })),
  });
  const empty: ConsultaCatastroResult = { ok: true, resultados: [] };

  it("se detiene en el primer intento con resultados", async () => {
    const fn = vi.fn().mockResolvedValue(ok(1));
    const res = await ejecutarConsultaCatastro(
      {
        tipo_via: "Calle",
        nombre_via: "Mayor",
        numero: "1",
        planta: "1",
        puerta: "A",
        municipio: "Madrid",
        provincia: "Madrid",
      },
      fn,
    );
    expect(res.agotado).toBe(false);
    expect(res.resultados).toHaveLength(1);
    expect(res.intentos_realizados).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("agota intentos y devuelve agotado=true sin lanzar", async () => {
    const fn = vi.fn().mockResolvedValue(empty);
    const res = await ejecutarConsultaCatastro(
      {
        tipo_via: "Calle",
        nombre_via: "Mayor",
        numero: "1",
        planta: "1",
        puerta: "A",
        municipio: "Madrid",
        provincia: "Madrid",
      },
      fn,
    );
    expect(res.agotado).toBe(true);
    expect(res.intentos_realizados).toBe(3);
    expect(res.resultados).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("captura errores como entradas controladas, no lanza", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const res = await ejecutarConsultaCatastro(
      {
        tipo_via: "Calle",
        nombre_via: "Mayor",
        numero: "1",
        municipio: "Madrid",
        provincia: "Madrid",
      },
      fn,
    );
    expect(res.agotado).toBe(true);
    expect(res.errores.length).toBeGreaterThan(0);
    expect(res.errores[0].mensaje).toBe("boom");
  });

  it("nunca llama al cliente más de 3 veces", async () => {
    const fn = vi.fn().mockResolvedValue(empty);
    await ejecutarConsultaCatastro(
      {
        tipo_via: "Calle",
        nombre_via: "Mayor",
        numero: "1",
        planta: "1",
        puerta: "A",
        municipio: "Madrid",
        provincia: "Madrid",
      },
      fn,
    );
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
  });
});