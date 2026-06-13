import { describe, it, expect } from "vitest";
import { seleccionarMensaje } from "../seleccionMensaje";
import type { Property } from "@/hooks/useProperties";
import type { Contrato } from "@/hooks/useContratos";
import type { Inquilino } from "@/hooks/useInquilinos";

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    user_id: "u",
    nombre_interno: "Piso Gran Vía",
    direccion_completa: null,
    referencia_catastral: "1234ABC",
    tiene_certificado_energetico: true,
    titularidad: "propio",
    titularidad_detalle: {},
    tiene_usufructo: false,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    tipo_inmueble: "vivienda",
    ...overrides,
  } as unknown as Property;
}

function makeContrato(overrides: Partial<Contrato> = {}): Contrato {
  return {
    id: "c1",
    user_id: "u",
    property_id: "p1",
    inquilino_id: "i1",
    titulo: "Contrato",
    fecha_inicio: "2025-01-01",
    fecha_fin: null,
    renta_mensual: 1000,
    archivo_nombre: null,
    storage_path: null,
    archivo_url: null,
    estado: "activo",
    notas: null,
    duracion_anos: null,
    prorroga_anos: null,
    preaviso_meses: null,
    fianza_importe: null,
    deposito_garantia: null,
    archivado: false,
    revisado_por_usuario: true,
    tiene_inventario: false,
    renovacion_automatica: false,
    agua_paga_inquilino: false,
    luz_paga_inquilino: false,
    gas_paga_inquilino: false,
    internet_paga_inquilino: false,
    ibi_paga_inquilino: false,
    basuras_paga_inquilino: false,
    comunidad_paga_inquilino: false,
    cuota_comunidad: null,
    documento_original_nombre: null,
    documento_original_path: null,
    documento_original_url: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeInquilino(overrides: Partial<Inquilino> = {}): Inquilino {
  return {
    id: "i1",
    user_id: "u",
    property_id: "p1",
    nombre: "Juan",
    apellidos: "García",
    dni: null,
    telefono: null,
    email: null,
    fecha_entrada: null,
    fecha_salida: null,
    renta_mensual: null,
    fianza: null,
    deposito_garantia: null,
    estado: "activo",
    notas: null,
    tipo_inquilino: null,
    rol_inquilino: null,
    auth_user_id: null,
    orden: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const NOW = new Date("2026-06-07T10:00:00Z");

describe("seleccionarMensaje", () => {
  it("devuelve null si no hay activos", () => {
    expect(
      seleccionarMensaje({ properties: [], contratos: [], inquilinos: [], now: NOW })
    ).toBeNull();
  });

  it("P1: contrato que vence en <30 días gana sobre todo", () => {
    const props = [makeProperty({ referencia_catastral: null })]; // P2 también activo
    const fechaFin = new Date(NOW.getTime() + 10 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const contratos = [makeContrato({ fecha_fin: fechaFin })];
    const inquilinos = [makeInquilino()];
    const r = seleccionarMensaje({ properties: props, contratos, inquilinos, now: NOW });
    expect(r?.prioridad).toBe(1);
    expect(r?.descripcion).toContain("Juan García");
    expect(r?.descripcion).toContain("10 días");
  });

  it("P2: titularidad incompleta gana sobre catastro y CEE", () => {
    const props = [
      makeProperty({
        referencia_catastral: null,
        tiene_certificado_energetico: false,
        titularidad_detalle: { pendientes: ["copropietario_1_dni"] } as never,
      }),
    ];
    const r = seleccionarMensaje({ properties: props, contratos: [], inquilinos: [], now: NOW });
    expect(r?.prioridad).toBe(2);
    expect(r?.id).toMatch(/^titularidad-/);
  });

  it("P2: sin catastro cuando titularidad ok", () => {
    const props = [makeProperty({ referencia_catastral: null })];
    const r = seleccionarMensaje({ properties: props, contratos: [], inquilinos: [], now: NOW });
    expect(r?.prioridad).toBe(2);
    expect(r?.id).toMatch(/^catastro-/);
  });

  it("P2: sin CEE cuando catastro ok", () => {
    const props = [makeProperty({ tiene_certificado_energetico: false })];
    const r = seleccionarMensaje({ properties: props, contratos: [], inquilinos: [], now: NOW });
    expect(r?.prioridad).toBe(2);
    expect(r?.id).toMatch(/^cee-/);
  });

  it("P3: declaración de renta en junio con contratos vigentes", () => {
    const props = [makeProperty()];
    const contratos = [makeContrato()];
    const r = seleccionarMensaje({
      properties: props,
      contratos,
      inquilinos: [makeInquilino()],
      now: new Date("2026-06-15T10:00:00Z"),
    });
    expect(r?.prioridad).toBe(3);
  });

  it("P3 no aparece en mayo", () => {
    const props = [makeProperty()];
    const contratos = [makeContrato()];
    const r = seleccionarMensaje({
      properties: props,
      contratos,
      inquilinos: [makeInquilino()],
      now: new Date("2026-05-15T10:00:00Z"),
    });
    expect(r).toBeNull();
  });

  it("P5: onboarding cuando no hay contratos", () => {
    const props = [makeProperty()];
    const r = seleccionarMensaje({
      properties: props,
      contratos: [],
      inquilinos: [],
      now: new Date("2026-05-15T10:00:00Z"),
    });
    expect(r?.prioridad).toBe(5);
  });

  it("orden de contratos urgentes: gana el más próximo", () => {
    const props = [makeProperty()];
    const f1 = new Date(NOW.getTime() + 25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const f2 = new Date(NOW.getTime() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const contratos = [
      makeContrato({ id: "c-lejos", fecha_fin: f1 }),
      makeContrato({ id: "c-cerca", fecha_fin: f2 }),
    ];
    const r = seleccionarMensaje({
      properties: props,
      contratos,
      inquilinos: [makeInquilino()],
      now: NOW,
    });
    expect(r?.id).toBe("contrato-vence-c-cerca");
  });
});