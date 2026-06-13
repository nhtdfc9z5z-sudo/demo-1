import { describe, it, expect } from "vitest";
import {
  contratoVigenteEnAnio,
  filterPersonasParaAnioFiscal,
  type ContratoVigenciaInput,
  type PersonaConContrato,
} from "@/lib/contratosVigentes";

const persona = (overrides: Partial<PersonaConContrato>): PersonaConContrato => ({
  rol: "arrendador",
  nombre: "Test",
  dni: "00000000A",
  afecta_fiscalidad: true,
  ...overrides,
});

describe("contratoVigenteEnAnio", () => {
  it("contrato archivado nunca está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: "2025-01-01", fecha_fin: null, archivado: true }, 2025)).toBe(false);
  });

  it("contrato sin fecha_inicio no está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: null, fecha_fin: null, archivado: false }, 2025)).toBe(false);
  });

  it("contrato terminado antes del año fiscal no está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: "2023-01-01", fecha_fin: "2023-12-31", archivado: false }, 2025)).toBe(false);
  });

  it("contrato iniciado después del año fiscal no está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: "2026-03-01", fecha_fin: null, archivado: false }, 2025)).toBe(false);
  });

  it("contrato iniciado en mitad del año fiscal sí está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: "2025-06-15", fecha_fin: null, archivado: false }, 2025)).toBe(true);
  });

  it("contrato indefinido (fecha_fin=null) iniciado antes está vigente", () => {
    expect(contratoVigenteEnAnio({ fecha_inicio: "2020-01-01", fecha_fin: null, archivado: false }, 2025)).toBe(true);
  });
});

describe("filterPersonasParaAnioFiscal", () => {
  const PROP = "PROP-1";

  it("contrato 2024 archivado NO afecta al pack 2025", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-old", property_id: PROP, fecha_inicio: "2024-01-01", fecha_fin: "2024-12-31", archivado: true },
    ];
    const personas = [persona({ contrato_id: "C-old", property_id: PROP, dni: "11111111A" })];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.porProperty[PROP]).toBeUndefined();
    expect(r.contratosVigentesIds).toEqual([]);
    expect(r.propiedadesSinContratoVigente).toEqual([PROP]);
  });

  it("contrato terminado en 2023 NO afecta al pack 2025", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-2023", property_id: PROP, fecha_inicio: "2022-01-01", fecha_fin: "2023-06-30", archivado: false },
    ];
    const personas = [persona({ contrato_id: "C-2023", property_id: PROP, dni: "22222222B" })];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.porProperty[PROP]).toBeUndefined();
  });

  it("contrato iniciado en junio 2025 afecta al pack 2025", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-new", property_id: PROP, fecha_inicio: "2025-06-01", fecha_fin: null, archivado: false },
    ];
    const personas = [persona({ contrato_id: "C-new", property_id: PROP, dni: "33333333C" })];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.porProperty[PROP]).toHaveLength(1);
    expect(r.porProperty[PROP][0].dni).toBe("33333333C");
    expect(r.propiedadesConSolapamiento).toEqual([]);
  });

  it("dos contratos CONSECUTIVOS en 2025 (sin solape) NO mezclan arrendadores y NO generan revisión", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-a", property_id: PROP, fecha_inicio: "2025-01-01", fecha_fin: "2025-05-31", archivado: false },
      { id: "C-b", property_id: PROP, fecha_inicio: "2025-06-01", fecha_fin: null, archivado: false },
    ];
    const personas = [
      persona({ contrato_id: "C-a", property_id: PROP, dni: "AAA" }),
      persona({ contrato_id: "C-b", property_id: PROP, dni: "BBB" }),
    ];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.porProperty[PROP]).toHaveLength(2);
    expect(r.propiedadesConSolapamiento).toEqual([]);
  });

  it("contratos SOLAPADOS en 2025 generan revisión (solapamiento)", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-a", property_id: PROP, fecha_inicio: "2025-01-01", fecha_fin: "2025-07-31", archivado: false },
      { id: "C-b", property_id: PROP, fecha_inicio: "2025-06-01", fecha_fin: null, archivado: false },
    ];
    const personas = [
      persona({ contrato_id: "C-a", property_id: PROP, dni: "AAA" }),
      persona({ contrato_id: "C-b", property_id: PROP, dni: "BBB" }),
    ];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.propiedadesConSolapamiento).toEqual([PROP]);
  });

  it("personas sin contrato_id (huérfanas) se ignoran", () => {
    const contratos: ContratoVigenciaInput[] = [
      { id: "C-ok", property_id: PROP, fecha_inicio: "2025-01-01", fecha_fin: null, archivado: false },
    ];
    const personas = [
      persona({ contrato_id: null as any, property_id: PROP, dni: "X" }),
      persona({ contrato_id: "C-ok", property_id: PROP, dni: "Y" }),
    ];
    const r = filterPersonasParaAnioFiscal(personas, contratos, 2025);
    expect(r.porProperty[PROP]).toHaveLength(1);
    expect(r.porProperty[PROP][0].dni).toBe("Y");
  });
});