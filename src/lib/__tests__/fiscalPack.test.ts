import { describe, it, expect } from "vitest";
import {
  computePropertyBreakdown,
  buildOwnerPack,
  getTitulares,
  listOwnersInPortfolio,
  shareForOwner,
  titularKey,
} from "@/lib/fiscalPack";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const PROP_A = { id: "A", nombre_interno: "Piso A" };
const PROP_B = { id: "B", nombre_interno: "Piso B" };

function pago(p: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: PROP_A.id,
    inquilino_id: "i",
    mes: 1, anio: 2024,
    inquilino_notificado: false, inquilino_notificado_at: null,
    propietario_confirmado: true, propietario_confirmado_at: null,
    importe_pagado: 1000, tipo_pago: null, notas_acuerdo: null,
    user_id: "u", created_at: "", updated_at: "",
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: "2024-01-01",
    fecha_pago_real: "2024-01-05",
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    ...p,
  };
}

describe("fiscalPack.computePropertyBreakdown", () => {
  it("imputa ingresos por fecha_devengo al año fiscal correcto", () => {
    const pagos = [
      pago({ mes: 12, anio: 2024, fecha_devengo: "2024-12-01", fecha_pago_real: "2025-01-10", importe_pagado: 800 }),
      pago({ mes: 1, anio: 2025, fecha_devengo: "2025-01-01", fecha_pago_real: "2025-01-20", importe_pagado: 900 }),
    ];
    const r2024 = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2024);
    const r2025 = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2025);
    // Diciembre cobrado en enero pertenece al año fiscal del devengo (2024)
    expect(r2024.ingresosDeclarables).toBe(800);
    expect(r2024.meses[11].pagoRealFiscal).toBe(800);
    expect(r2025.ingresosDeclarables).toBe(900);
    expect(r2025.meses[0].pagoRealFiscal).toBe(900);
  });

  it("NO incluye históricos con afecta_fiscalidad=false", () => {
    const pagos = [
      pago({ tipo_registro: "historico_reconstruido", afecta_fiscalidad: false, importe_pagado: 500 }),
    ];
    const r = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2024);
    expect(r.ingresosDeclarables).toBe(0);
    expect(r.historicosFiscal).toBe(0);
  });

  it("SÍ incluye históricos con afecta_fiscalidad=true como 'historicosFiscal'", () => {
    const pagos = [
      pago({ tipo_registro: "historico_reconstruido", afecta_fiscalidad: true, importe_pagado: 750, mes: 3, fecha_devengo: "2024-03-01" }),
    ];
    const r = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2024);
    expect(r.historicosFiscal).toBe(750);
    expect(r.pagosRealesFiscal).toBe(0);
    expect(r.ingresosDeclarables).toBe(750);
    expect(r.meses[2].historicoFiscal).toBe(750);
  });

  it("nunca usa fecha_registro/created_at como criterio fiscal", () => {
    const pagos = [
      pago({
        mes: 1, anio: 2024, fecha_devengo: "2024-01-01",
        created_at: "2026-05-10T00:00:00Z", // registrado mucho después
        importe_pagado: 600,
      }),
    ];
    const r2024 = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2024);
    const r2026 = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2026);
    expect(r2024.ingresosDeclarables).toBe(600);
    expect(r2026.ingresosDeclarables).toBe(0);
  });

  it("marca meses pendientes/regularizados y mesesSinIngresos", () => {
    const pagos = [
      pago({ mes: 1, fecha_devengo: "2024-01-01" }),
      pago({ mes: 2, tipo_registro: "pendiente", importe_pagado: 0, propietario_confirmado: false, fecha_devengo: "2024-02-01" }),
      pago({ mes: 3, tipo_registro: "regularizado", afecta_fiscalidad: false, importe_pagado: 0, fecha_devengo: "2024-03-01" }),
    ];
    const r = computePropertyBreakdown({ property: PROP_A, pagos, gastos: [], facturas: [] }, 2024);
    expect(r.mesesPendientes).toEqual([2]);
    expect(r.mesesRegularizados).toEqual([3]);
    // sin ingreso: todos los meses 4..12 + ninguno extra
    expect(r.mesesSinIngresos).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("suma gastos manuales y facturas deducibles del año, excluyendo no-deducibles", () => {
    const gastos = [
      { id: "g1", property_id: "A", categoria: "comunidad", concepto: "Cuota", importe: 100, fecha: "2024-03-15" },
      { id: "g2", property_id: "A", categoria: "ibi", concepto: "IBI", importe: 300, fecha: "2023-09-01" }, // otro año
      { id: "g3", property_id: "B", categoria: "ibi", concepto: "IBI B", importe: 200, fecha: "2024-09-01" },
    ];
    const facturas = [
      { id: "f1", property_id: "A", emisor_nombre: "Fontanero", total: 250, fecha: "2024-06-01", categoria: "reparaciones", deducible_irpf: true },
      { id: "f2", property_id: "A", emisor_nombre: "X", total: 999, fecha: "2024-07-01", categoria: "otro", deducible_irpf: false },
    ];
    const r = computePropertyBreakdown({ property: PROP_A, pagos: [], gastos, facturas }, 2024);
    expect(r.gastosTotal).toBe(350);
    expect(r.gastosDeducibles).toHaveLength(2);
  });
});

describe("fiscalPack.buildOwnerPack", () => {
  it("agrega totales por inmueble y del propietario", () => {
    const pagos = [
      pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" }),
      pago({ property_id: "A", importe_pagado: 1000, mes: 2, fecha_devengo: "2024-02-01" }),
      pago({ property_id: "B", importe_pagado: 800, fecha_devengo: "2024-01-01" }),
    ];
    const gastos = [
      { id: "g1", property_id: "A", categoria: "ibi", concepto: "IBI", importe: 400, fecha: "2024-10-01" },
      { id: "g2", property_id: "B", categoria: "comunidad", concepto: "C", importe: 600, fecha: "2024-05-01" },
    ];
    const pack = buildOwnerPack({ properties: [PROP_A, PROP_B], pagos, gastos, facturas: [] }, 2024);
    expect(pack.propiedades).toHaveLength(2);
    const a = pack.propiedades.find(p => p.propertyId === "A")!;
    const b = pack.propiedades.find(p => p.propertyId === "B")!;
    expect(a.ingresosDeclarables).toBe(2000);
    expect(a.gastosTotal).toBe(400);
    expect(b.ingresosDeclarables).toBe(800);
    expect(b.gastosTotal).toBe(600);
    expect(pack.totalIngresosDeclarables).toBe(2800);
    expect(pack.totalGastosDeducibles).toBe(1000);
    expect(pack.totalNeto).toBe(1800);
  });

  it("filtra por propertyIds cuando se pasa", () => {
    const pagos = [
      pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" }),
      pago({ property_id: "B", importe_pagado: 800, fecha_devengo: "2024-01-01" }),
    ];
    const pack = buildOwnerPack({ properties: [PROP_A, PROP_B], pagos, gastos: [], facturas: [] }, 2024, ["A"]);
    expect(pack.propiedades).toHaveLength(1);
    expect(pack.totalIngresosDeclarables).toBe(1000);
  });
});

describe("fiscalPack.titularidad", () => {
  const ME = { nombre: "Ana", apellidos: "Pérez", nif: "11111111A" };

  it("inmueble 'yo' devuelve 100% al propietario único", () => {
    const prop = { id: "P1", nombre_interno: "Piso", titularidad: "yo" as const };
    const titulares = getTitulares(prop, ME);
    expect(titulares).toHaveLength(1);
    expect(titulares[0].key).toBe("me");
    expect(titulares[0].porcentaje).toBe(100);
    expect(shareForOwner(prop, "me", ME)).toBe(100);
  });

  it("copropietarios 50/50 reparte porcentaje correctamente", () => {
    const prop = {
      id: "P1", nombre_interno: "Piso",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana Pérez", dni: "11111111A", porcentaje: "50" },
        { nombre: "Luis Gómez", dni: "22222222B", porcentaje: "50" },
      ],
    };
    const titulares = getTitulares(prop, ME);
    expect(titulares).toHaveLength(2);
    const ana = titulares.find(t => t.esYo)!;
    const luis = titulares.find(t => !t.esYo)!;
    expect(ana.porcentaje).toBe(50);
    expect(luis.porcentaje).toBe(50);
    expect(shareForOwner(prop, "me", ME)).toBe(50);
    expect(shareForOwner(prop, titularKey({ dni: "22222222B" }), ME)).toBe(50);
  });

  it("sin porcentajes definidos, reparte equitativo entre copropietarios", () => {
    const prop = {
      id: "P1", nombre_interno: "Piso",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana Pérez", dni: "11111111A" },
        { nombre: "Luis", dni: "22222222B" },
        { nombre: "Marta", dni: "33333333C" },
      ],
    };
    const titulares = getTitulares(prop, ME);
    expect(titulares.every(t => Math.abs(t.porcentaje - 100 / 3) < 1e-6)).toBe(true);
  });

  it("buildOwnerPack sin filtro mantiene importes completos (100%)", () => {
    const prop = {
      id: "A", nombre_interno: "Piso",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana", dni: "11111111A", porcentaje: "50" },
        { nombre: "Luis", dni: "22222222B", porcentaje: "50" },
      ],
    };
    const pagos = [pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" })];
    const gastos = [{ id: "g1", property_id: "A", categoria: "ibi", concepto: "IBI", importe: 400, fecha: "2024-06-01" }];
    const pack = buildOwnerPack({ properties: [prop], pagos, gastos, facturas: [] }, 2024);
    expect(pack.criterioCalculo).toBe("total_inmueble");
    expect(pack.totalIngresosDeclarables).toBe(1000);
    expect(pack.totalGastosDeducibles).toBe(400);
    expect(pack.propiedades[0].porcentajeAplicado).toBe(100);
  });

  it("filtro por propietario A (yo) aplica 50% a ingresos y gastos", () => {
    const prop = {
      id: "A", nombre_interno: "Piso",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana", dni: "11111111A", porcentaje: "50" },
        { nombre: "Luis", dni: "22222222B", porcentaje: "50" },
      ],
    };
    const pagos = [pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" })];
    const gastos = [{ id: "g1", property_id: "A", categoria: "ibi", concepto: "IBI", importe: 400, fecha: "2024-06-01" }];
    const pack = buildOwnerPack({ properties: [prop], pagos, gastos, facturas: [] }, 2024, undefined, { ownerKey: "me", me: ME });
    expect(pack.criterioCalculo).toBe("por_propietario");
    expect(pack.totalIngresosDeclarables).toBe(500);
    expect(pack.totalGastosDeducibles).toBe(200);
    expect(pack.totalNeto).toBe(300);
    expect(pack.propiedades[0].porcentajeAplicado).toBe(50);
    expect(pack.propietarioNombre).toBeTruthy();
  });

  it("filtro por propietario B aplica su 50% independiente de yo", () => {
    const prop = {
      id: "A", nombre_interno: "Piso",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana", dni: "11111111A", porcentaje: "50" },
        { nombre: "Luis", dni: "22222222B", porcentaje: "50" },
      ],
    };
    const pagos = [pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" })];
    const pack = buildOwnerPack({ properties: [prop], pagos, gastos: [], facturas: [] }, 2024, undefined, {
      ownerKey: titularKey({ dni: "22222222B" }),
      me: ME,
    });
    expect(pack.totalIngresosDeclarables).toBe(500);
    expect(pack.propiedades).toHaveLength(1);
  });

  it("filtro por propietario omite inmuebles donde no participa", () => {
    const propA = {
      id: "A", nombre_interno: "Piso A",
      titularidad: "yo" as const, // sólo yo
    };
    const propB = {
      id: "B", nombre_interno: "Piso B",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana", dni: "11111111A", porcentaje: "30" },
        { nombre: "Luis", dni: "22222222B", porcentaje: "70" },
      ],
    };
    const pagos = [
      pago({ property_id: "A", importe_pagado: 1000, fecha_devengo: "2024-01-01" }),
      pago({ property_id: "B", importe_pagado: 1000, fecha_devengo: "2024-01-01" }),
    ];
    // Luis: sólo participa en B al 70%
    const luisKey = titularKey({ dni: "22222222B" });
    const pack = buildOwnerPack({ properties: [propA, propB], pagos, gastos: [], facturas: [] }, 2024, undefined, {
      ownerKey: luisKey, me: ME,
    });
    expect(pack.propiedades).toHaveLength(1);
    expect(pack.propiedades[0].propertyId).toBe("B");
    expect(pack.totalIngresosDeclarables).toBe(700);
  });

  it("listOwnersInPortfolio devuelve titulares únicos con conteo de inmuebles", () => {
    const propA = { id: "A", nombre_interno: "A", titularidad: "yo" as const };
    const propB = {
      id: "B", nombre_interno: "B",
      titularidad: "copropietarios" as const,
      copropietarios: [
        { nombre: "Ana", dni: "11111111A", porcentaje: "50" },
        { nombre: "Luis", dni: "22222222B", porcentaje: "50" },
      ],
    };
    const owners = listOwnersInPortfolio([propA, propB], ME);
    // Yo aparece en A y B
    const me = owners.find(o => o.esYo)!;
    expect(me.numInmuebles).toBe(2);
    const luis = owners.find(o => o.dni === "22222222B")!;
    expect(luis.numInmuebles).toBe(1);
    // Yo primero
    expect(owners[0].esYo).toBe(true);
  });
});