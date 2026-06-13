import { describe, it, expect } from "vitest";
import {
  calcularCompletitud,
  mensajePorTramo,
  calcularCaducidadCEE,
} from "../completitud";
import type { Property } from "@/hooks/useProperties";

const base = (over: Partial<Property> = {}): Property =>
  ({
    id: "p1",
    user_id: "u1",
    nombre_interno: "",
    tipo_inmueble: "vivienda",
    direccion_completa: null,
    codigo_postal: null,
    ciudad: null,
    municipio: null,
    nombre_via: null,
    superficie_m2: null,
    num_habitaciones: null,
    num_banos: null,
    ano_construccion: null,
    amueblada: false,
    referencia_catastral: null,
    valor_compra: null,
    ano_compra: null,
    ibi_importe: null,
    cuota_comunidad: null,
    calificacion_energetica: null,
    caracteristicas_detalle: {},
    ...over,
  } as unknown as Property);

describe("calcularCompletitud", () => {
  it("ficha vacía da 0% y mensaje del primer tramo", () => {
    const r = calcularCompletitud(base({ nombre_interno: "" }));
    expect(r.porcentaje).toBeLessThanOrEqual(20); // tipo_inmueble cuenta algo
    expect(r.mensaje).toBe("Empieza añadiendo las características básicas");
  });

  it("rellenando datos básicos sube al rango 25-50%", () => {
    const r = calcularCompletitud(
      base({
        nombre_interno: "Piso centro",
        nombre_via: "Mayor",
        codigo_postal: "28013",
        ciudad: "Madrid",
      }),
    );
    expect(r.grupos.basico).toBe(100);
    expect(r.porcentaje).toBeGreaterThanOrEqual(25);
    expect(r.porcentaje).toBeLessThan(50);
    expect(r.mensaje).toBe("Bien. Añade superficie y habitaciones");
  });

  it("añadiendo características llega al rango 50-75%", () => {
    const r = calcularCompletitud(
      base({
        nombre_interno: "Piso",
        nombre_via: "Mayor",
        codigo_postal: "28013",
        ciudad: "Madrid",
        superficie_m2: 80 as any,
        num_habitaciones: 3,
        num_banos: 2,
        ano_construccion: 1990,
        caracteristicas_detalle: {
          orientacion: "S",
          estado_conservacion: "bueno",
          amueblado: "si",
        } as any,
      }),
    );
    expect(r.grupos.caracteristicas).toBe(100);
    expect(r.porcentaje).toBeGreaterThanOrEqual(50);
    expect(r.mensaje).toBe("Casi. Los datos fiscales te ayudarán en la declaración");
  });

  it("añadiendo fiscal llega al rango 75-99%", () => {
    const r = calcularCompletitud(
      base({
        nombre_interno: "P",
        nombre_via: "M",
        codigo_postal: "1",
        ciudad: "X",
        superficie_m2: 1 as any,
        num_habitaciones: 1,
        num_banos: 1,
        ano_construccion: 1,
        caracteristicas_detalle: {
          orientacion: "S",
          estado_conservacion: "bueno",
          amueblado: "si",
        } as any,
        referencia_catastral: "x",
        num_finca_registral: "x",
        valor_catastral: 1 as any,
        valor_compra: 1 as any,
        ano_compra: 1,
        ibi_importe: 1 as any,
        cuota_comunidad: 1 as any,
      }),
    );
    expect(r.grupos.fiscal).toBe(100);
    expect(r.porcentaje).toBeGreaterThanOrEqual(75);
    expect(r.porcentaje).toBeLessThan(100);
    expect(r.mensaje).toBe("Último tramo. El CEE y las fotos completan la ficha");
  });

  it("ficha 100% completa", () => {
    const r = calcularCompletitud(
      base({
        nombre_interno: "P",
        nombre_via: "M",
        codigo_postal: "1",
        ciudad: "X",
        superficie_m2: 1 as any,
        num_habitaciones: 1,
        num_banos: 1,
        ano_construccion: 1,
        caracteristicas_detalle: {
          orientacion: "S",
          estado_conservacion: "bueno",
          amueblado: "si",
        } as any,
        referencia_catastral: "x",
        num_finca_registral: "x",
        valor_catastral: 1 as any,
        valor_compra: 1 as any,
        ano_compra: 1,
        ibi_importe: 1 as any,
        cuota_comunidad: 1 as any,
        calificacion_energetica: "B",
        cee_fecha_emision: "2024-01-01",
        cee_numero_registro: "ES-001",
      }),
    );
    expect(r.porcentaje).toBe(100);
    expect(r.mensaje).toBe("Ficha completa. Tu expediente está listo");
    expect(r.siguienteCampo).toBeNull();
  });
});

describe("mensajePorTramo", () => {
  it("cubre los 5 tramos", () => {
    expect(mensajePorTramo(0)).toMatch(/Empieza/);
    expect(mensajePorTramo(30)).toMatch(/Bien/);
    expect(mensajePorTramo(60)).toMatch(/Casi/);
    expect(mensajePorTramo(80)).toMatch(/Último tramo/);
    expect(mensajePorTramo(100)).toMatch(/Ficha completa/);
  });
});

describe("calcularCaducidadCEE", () => {
  it("suma 10 años exactos", () => {
    expect(calcularCaducidadCEE("2024-03-15")).toBe("2034-03-15");
  });
  it("devuelve null si no hay fecha o es inválida", () => {
    expect(calcularCaducidadCEE(null)).toBeNull();
    expect(calcularCaducidadCEE("")).toBeNull();
    expect(calcularCaducidadCEE("no-fecha")).toBeNull();
  });
});