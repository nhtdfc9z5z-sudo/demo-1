import { describe, it, expect } from "vitest";
import { computePropertyBreakdown } from "@/lib/fiscalPack";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const PROP = { id: "PV6", nombre_interno: "PV6" };

function pago(p: Partial<PagoRenta>): PagoRenta {
  return {
    id: crypto.randomUUID(),
    property_id: PROP.id,
    inquilino_id: "i",
    mes: 1, anio: 2026,
    inquilino_notificado: false, inquilino_notificado_at: null,
    propietario_confirmado: true, propietario_confirmado_at: null,
    importe_pagado: 770, tipo_pago: null, notas_acuerdo: null,
    user_id: "u", created_at: "", updated_at: "",
    tipo_registro: "pago_real",
    origen: "registro_manual",
    fecha_devengo: "2026-01-01",
    fecha_pago_real: "2026-01-05",
    afecta_finanzas_actuales: true,
    afecta_fiscalidad: true,
    contrato_id: "c1",
    ...p,
  };
}

describe("Sprint 3 — histórico fiscal ambiguo (caso PV6)", () => {
  it("histórico con afecta_fiscalidad=true coincidente con pago real → NO suma al declarable", () => {
    const pagos = [
      // pago real solidario duplicado del mismo contrato/mes
      pago({ inquilino_id: "A", importe_pagado: 770 }),
      pago({ inquilino_id: "B", importe_pagado: 770 }),
      // histórico reconstruido del mismo (contrato, mes) marcado afecta_fiscalidad=true
      pago({
        inquilino_id: "A",
        importe_pagado: 570,
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
      }),
    ];
    const r = computePropertyBreakdown(
      { property: PROP, pagos, gastos: [], facturas: [] },
      2026,
    );
    // El declarable solo debe contener el pago real (770), no el histórico (570).
    expect(r.ingresosDeclarables).toBe(770);
    expect(r.historicosAmbiguosFiscal).toBe(570);
    expect(r.meses[0].historicoAmbiguoFiscal).toBe(570);
    expect(r.meses[0].historicoFiscal).toBe(0);
  });

  it("histórico sin pago real coincidente sí suma al declarable", () => {
    const pagos = [
      pago({
        mes: 3, fecha_devengo: "2026-03-01",
        importe_pagado: 570,
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
      }),
    ];
    const r = computePropertyBreakdown(
      { property: PROP, pagos, gastos: [], facturas: [] },
      2026,
    );
    expect(r.ingresosDeclarables).toBe(570);
    expect(r.historicosAmbiguosFiscal).toBe(0);
    expect(r.meses[2].historicoFiscal).toBe(570);
  });

  it("contratos distintos con mismo mes no se consideran ambiguos entre sí", () => {
    const pagos = [
      pago({ contrato_id: "c1", importe_pagado: 770 }),
      pago({
        contrato_id: "c2",
        importe_pagado: 570,
        tipo_registro: "historico_reconstruido",
        afecta_finanzas_actuales: false,
      }),
    ];
    const r = computePropertyBreakdown(
      { property: PROP, pagos, gastos: [], facturas: [] },
      2026,
    );
    // Cada uno cuenta en su propio bucket de contrato.
    expect(r.ingresosDeclarables).toBe(770 + 570);
    expect(r.historicosAmbiguosFiscal).toBe(0);
  });
});