import { describe, it, expect } from "vitest";
import { validarPorcentajesFiscales, type PersonaContrato } from "@/lib/contratoRoles";
import { buildOwnerPack, type MinimalProperty } from "@/lib/fiscalPack";

function p(o: Partial<PersonaContrato>): PersonaContrato {
  return { rol: "arrendador", nombre: "X", afecta_fiscalidad: true, ...o } as PersonaContrato;
}

describe("validarPorcentajesFiscales", () => {
  it("60/40 → ok", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 60, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 40, dni: "2B" }),
    ]);
    expect(r.status).toBe("ok");
    expect(r.mensaje).toBeNull();
  });

  it("50/50 → ok", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 50, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 50, dni: "2B" }),
    ]);
    expect(r.status).toBe("ok");
  });

  it("100 → ok", () => {
    const r = validarPorcentajesFiscales([p({ porcentaje_fiscal: 100, dni: "1A" })]);
    expect(r.status).toBe("ok");
  });

  it("60/30 → incompleto con suma 90", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 60, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 30, dni: "2B" }),
    ]);
    expect(r.status).toBe("incompleto");
    expect(r.suma).toBe(90);
    expect(r.mensaje).toMatch(/90%/);
  });

  it("70/50 → excedido con suma 120", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_fiscal: 70, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 50, dni: "2B" }),
    ]);
    expect(r.status).toBe("excedido");
    expect(r.suma).toBe(120);
    expect(r.mensaje).toMatch(/120%/);
  });

  it("sin porcentaje fiscal → sin_datos con mensaje de fallback", () => {
    const r = validarPorcentajesFiscales([
      p({ dni: "1A" }),
      p({ rol: "coarrendador", dni: "2B" }),
    ]);
    expect(r.status).toBe("sin_datos");
    expect(r.mensaje).toMatch(/fallback|titularidad/i);
  });

  it("sin arrendadores fiscales → sin_arrendadores sin mensaje", () => {
    const r = validarPorcentajesFiscales([
      p({ rol: "arrendatario", afecta_fiscalidad: false, dni: "I1" }),
      p({ rol: "gestor", afecta_fiscalidad: false, dni: "G1" }),
    ]);
    expect(r.status).toBe("sin_arrendadores");
    expect(r.mensaje).toBeNull();
  });

  it("usa porcentaje_participacion como fallback si no hay porcentaje_fiscal", () => {
    const r = validarPorcentajesFiscales([
      p({ porcentaje_participacion: 70, dni: "1A" }),
      p({ rol: "coarrendador", porcentaje_participacion: 30, dni: "2B" }),
    ]);
    expect(r.status).toBe("ok");
  });
});

describe("buildOwnerPack propaga warning de porcentajes fiscales", () => {
  const prop: MinimalProperty = {
    id: "A", nombre_interno: "Piso",
    titularidad: "copropietarios",
    copropietarios: [
      { nombre: "Ana", dni: "1A", porcentaje: 50 },
      { nombre: "Beto", dni: "2B", porcentaje: 50 },
    ],
  };

  it("60/30 marca el inmueble como requiereRevisionFiscal con nota legible", () => {
    const personas = [
      p({ porcentaje_fiscal: 60, dni: "1A", nombre: "Ana" }),
      p({ rol: "coarrendador", porcentaje_fiscal: 30, dni: "2B", nombre: "Beto" }),
    ];
    const pack = buildOwnerPack(
      { properties: [prop], pagos: [], gastos: [], facturas: [] },
      2025, undefined,
      { contratosPorProperty: { A: personas } },
    );
    expect(pack.inmueblesRequierenRevision).toContain("A");
    const notas = pack.propiedades[0].notasRegularizacion.join(" | ");
    expect(notas).toMatch(/90%/);
  });

  it("100% no marca revisión por este motivo", () => {
    const personas = [p({ porcentaje_fiscal: 100, dni: "1A", nombre: "Ana" })];
    const pack = buildOwnerPack(
      { properties: [prop], pagos: [], gastos: [], facturas: [] },
      2025, undefined,
      { contratosPorProperty: { A: personas } },
    );
    expect(pack.inmueblesRequierenRevision).not.toContain("A");
  });
});