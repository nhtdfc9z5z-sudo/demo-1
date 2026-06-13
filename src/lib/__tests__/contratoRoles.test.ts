import { describe, it, expect } from "vitest";
import { buildOwnerPack, type MinimalProperty } from "@/lib/fiscalPack";
import {
  parteFromRol,
  getArrendadoresFiscales,
  repartoFiscalContrato,
  resolverShareFiscal,
  type PersonaContrato,
} from "@/lib/contratoRoles";
import type { PagoRenta } from "@/hooks/usePagosRenta";

function p(o: Partial<PersonaContrato>): PersonaContrato {
  return { rol: "arrendador", nombre: "X", ...o } as PersonaContrato;
}

function pago(o: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(), property_id: "A", inquilino_id: "i",
    mes: 1, anio: 2024,
    inquilino_notificado: false, inquilino_notificado_at: null,
    propietario_confirmado: true, propietario_confirmado_at: null,
    importe_pagado: 1000, tipo_pago: null, notas_acuerdo: null,
    user_id: "u", created_at: "", updated_at: "",
    tipo_registro: "pago_real", origen: "registro_manual",
    fecha_devengo: "2024-01-01", fecha_pago_real: "2024-01-05",
    afecta_finanzas_actuales: true, afecta_fiscalidad: true,
    ...o,
  } as PagoRenta;
}

describe("parteFromRol", () => {
  it("mapea cada rol a la parte correcta", () => {
    expect(parteFromRol("arrendador")).toBe("arrendadora");
    expect(parteFromRol("subarrendador")).toBe("arrendadora");
    expect(parteFromRol("arrendatario")).toBe("arrendataria");
    expect(parteFromRol("subarrendatario")).toBe("arrendataria");
    expect(parteFromRol("gestor")).toBe("gestion");
    expect(parteFromRol("avalista")).toBe("garantia");
    expect(parteFromRol("contacto_autorizado")).toBe("otro");
  });
});

describe("getArrendadoresFiscales", () => {
  it("ignora arrendatarios, gestores y avalistas", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, nombre: "A" }),
      p({ rol: "arrendatario", afecta_fiscalidad: false, nombre: "B" }),
      p({ rol: "gestor", afecta_fiscalidad: false, nombre: "C" }),
      p({ rol: "avalista", afecta_fiscalidad: false, nombre: "D" }),
    ];
    const arr = getArrendadoresFiscales(personas);
    expect(arr.map(x => x.nombre)).toEqual(["A"]);
  });

  it("excluye arrendadores con afecta_fiscalidad=false (caso gestor que firma como arrendador)", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: false, nombre: "Gestor" }),
    ];
    expect(getArrendadoresFiscales(personas)).toHaveLength(0);
  });
});

describe("repartoFiscalContrato", () => {
  it("reparto equitativo cuando no hay porcentajes", () => {
    const r = repartoFiscalContrato([
      p({ rol: "arrendador", afecta_fiscalidad: true, dni: "11111111H", nombre: "A" }),
      p({ rol: "coarrendador", afecta_fiscalidad: true, dni: "22222222J", nombre: "B" }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].porcentaje).toBe(50);
    expect(r[1].porcentaje).toBe(50);
  });

  it("respeta porcentaje 70/30 distinto a titularidad", () => {
    const r = repartoFiscalContrato([
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 70, dni: "1A", nombre: "A" }),
      p({ rol: "coarrendador", afecta_fiscalidad: true, porcentaje_fiscal: 30, dni: "2B", nombre: "B" }),
    ]);
    expect(r.find(x => x.nombre === "A")!.porcentaje).toBe(70);
    expect(r.find(x => x.nombre === "B")!.porcentaje).toBe(30);
  });

  it("usa porcentaje_participacion si no hay porcentaje_fiscal", () => {
    const r = repartoFiscalContrato([
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_participacion: 60, dni: "1A", nombre: "A" }),
      p({ rol: "coarrendador", afecta_fiscalidad: true, porcentaje_participacion: 40, dni: "2B", nombre: "B" }),
    ]);
    expect(r.find(x => x.nombre === "A")!.porcentaje).toBe(60);
  });
});

describe("resolverShareFiscal", () => {
  const propCopro: MinimalProperty = {
    id: "P1", nombre_interno: "Piso",
    titularidad: "copropietarios",
    copropietarios: [
      { nombre: "Ana", dni: "11111111H", porcentaje: 50 },
      { nombre: "Beto", dni: "22222222J", porcentaje: 50 },
    ],
  };

  it("copropiedad 50/50 pero solo Ana figura como arrendador 100% → Ana imputa 100%, Beto 0% y aviso", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "11111111H", nombre: "Ana" }),
    ];
    const rAna = resolverShareFiscal(propCopro, personas, "11111111H");
    const rBeto = resolverShareFiscal(propCopro, personas, "22222222J");
    expect(rAna.shareFactor).toBe(1);
    expect(rAna.criterio).toBe("rol_contractual");
    expect(rBeto.shareFactor).toBe(0);
    expect(rBeto.requiereRevisionFiscal).toBe(true);
    expect(rBeto.notas[0]).toMatch(/asesor/i);
  });

  it("fallback a titularidad si no hay arrendadores fiscales (legado)", () => {
    const r = resolverShareFiscal(propCopro, [], "11111111H");
    expect(r.criterio).toBe("titularidad");
    expect(r.shareFactor).toBe(0.5);
  });

  it("avalista no genera share aunque coincida la clave", () => {
    const personas = [
      p({ rol: "avalista", afecta_fiscalidad: false, dni: "99999999Z", nombre: "Aval" }),
    ];
    const r = resolverShareFiscal(propCopro, personas, "99999999Z");
    // Sin arrendadores fiscales → fallback a titularidad; avalista no es titular → 0
    expect(r.shareFactor).toBe(0);
  });
});

describe("buildOwnerPack con contratosPorProperty", () => {
  const propCopro: MinimalProperty = {
    id: "A", nombre_interno: "Piso",
    titularidad: "copropietarios",
    copropietarios: [
      { nombre: "Ana", dni: "11111111H", porcentaje: 50 },
      { nombre: "Beto", dni: "22222222J", porcentaje: 50 },
    ],
  };
  const pagos = [pago({ importe_pagado: 1000 }), pago({ mes: 2, fecha_devengo: "2024-02-01", importe_pagado: 1000 })];

  it("solo arrendador fiscal imputa el 100%; el otro copropietario muestra aviso", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "11111111H", nombre: "Ana" }),
    ];
    const packAna = buildOwnerPack(
      { properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined,
      { ownerKey: "11111111H", contratosPorProperty: { A: personas } },
    );
    expect(packAna.totalIngresosDeclarables).toBe(2000);
    expect(packAna.propiedades[0].criterioAplicado).toBe("rol_contractual");
    expect(packAna.propiedades[0].porcentajeAplicado).toBe(100);

    const packBeto = buildOwnerPack(
      { properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined,
      { ownerKey: "22222222J", contratosPorProperty: { A: personas } },
    );
    expect(packBeto.totalIngresosDeclarables).toBe(0);
    expect(packBeto.inmueblesRequierenRevision).toContain("A");
  });

  it("dos arrendadores 70/30 → ingresos repartidos al filtrar", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 70, dni: "1A", nombre: "Ana" }),
      p({ rol: "coarrendador", afecta_fiscalidad: true, porcentaje_fiscal: 30, dni: "2B", nombre: "Beto" }),
    ];
    const props: MinimalProperty[] = [{
      id: "A", nombre_interno: "Piso",
      titularidad: "copropietarios",
      copropietarios: [
        { nombre: "Ana", dni: "1A", porcentaje: 50 },
        { nombre: "Beto", dni: "2B", porcentaje: 50 },
      ],
    }];
    const ana = buildOwnerPack({ properties: props, pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "1A", contratosPorProperty: { A: personas } });
    const beto = buildOwnerPack({ properties: props, pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "2B", contratosPorProperty: { A: personas } });
    expect(ana.totalIngresosDeclarables).toBe(1400);
    expect(beto.totalIngresosDeclarables).toBe(600);
  });

  it("gestor con afecta_fiscalidad=false no aparece como declarante", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "1A", nombre: "Ana" }),
      p({ rol: "gestor", afecta_fiscalidad: false, dni: "9Z", nombre: "Gestoria" }),
    ];
    const r = buildOwnerPack({ properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "9Z", contratosPorProperty: { A: personas } });
    // El gestor no debe imputar ingresos
    expect(r.totalIngresosDeclarables).toBe(0);
    expect(r.propiedades.length).toBe(0);
  });

  it("avalista no aparece nunca como declarante", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "1A", nombre: "Ana" }),
      p({ rol: "avalista", afecta_fiscalidad: false, dni: "8X", nombre: "Aval" }),
    ];
    const r = buildOwnerPack({ properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "8X", contratosPorProperty: { A: personas } });
    expect(r.totalIngresosDeclarables).toBe(0);
  });

  it("sin personas contractuales → fallback a titularidad (50% para Ana)", () => {
    const r = buildOwnerPack({ properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "11111111H" });
    expect(r.totalIngresosDeclarables).toBe(1000); // 50% de 2000
    expect(r.propiedades[0].criterioAplicado).toBe("titularidad");
  });

  it("varios arrendatarios sin impacto fiscal no aparecen como declarantes", () => {
    const personas = [
      p({ rol: "arrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "1A", nombre: "Ana" }),
      p({ rol: "arrendatario", afecta_fiscalidad: false, dni: "I1", nombre: "Inq1" }),
      p({ rol: "coarrendatario", afecta_fiscalidad: false, dni: "I2", nombre: "Inq2" }),
    ];
    const r = buildOwnerPack({ properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "I1", contratosPorProperty: { A: personas } });
    expect(r.totalIngresosDeclarables).toBe(0);
  });

  it("subarrendador fiscal sí declara como arrendador", () => {
    const personas = [
      p({ rol: "subarrendador", afecta_fiscalidad: true, porcentaje_fiscal: 100, dni: "SS", nombre: "Sub" }),
    ];
    const r = buildOwnerPack({ properties: [propCopro], pagos, gastos: [], facturas: [] },
      2024, undefined, { ownerKey: "SS", contratosPorProperty: { A: personas } });
    expect(r.totalIngresosDeclarables).toBe(2000);
    expect(r.propiedades[0].criterioAplicado).toBe("rol_contractual");
  });
});