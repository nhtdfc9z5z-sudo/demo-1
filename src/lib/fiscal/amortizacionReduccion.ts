/**
 * Helpers fiscales puros para amortización (3%) y reducción 60% por
 * arrendamiento de vivienda habitual.
 *
 * Reglas (LIRPF 23.2, art. 14 RIRPF):
 *  - Amortización anual deducible = valor_construcción * 0,03.
 *      · Si existe `valor_catastral_construccion` se usa ese valor.
 *      · Si no, se aproxima como `valor_compra * 0,7` (criterio AEAT).
 *      · Si no hay base suficiente → 0 + flag `requiereValorCompra`.
 *  - Reducción 60%: sólo si el contrato es de vivienda habitual ("habitual").
 *      Vacacional, oficina, local, temporada, garaje, trastero y otros
 *      usos NO tienen reducción.
 */

export interface PropertyAmortInput {
  valor_compra?: number | null;
  valor_catastral?: number | null;
  valor_catastral_construccion?: number | null;
}

export interface AmortizacionResultado {
  valorConstruccion: number;
  amortizacionAnual: number;
  requiereValorCompra: boolean;
  /** Origen del valor de construcción usado. */
  fuente: "catastral_construccion" | "valor_compra_estimado" | "ninguno";
}

const TASA_AMORTIZACION = 0.03;
const RATIO_CONSTRUCCION_ESTIMADO = 0.7;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function calcularAmortizacion(property: PropertyAmortInput | null | undefined): AmortizacionResultado {
  const vConstr = num(property?.valor_catastral_construccion);
  if (vConstr > 0) {
    return {
      valorConstruccion: vConstr,
      amortizacionAnual: vConstr * TASA_AMORTIZACION,
      requiereValorCompra: false,
      fuente: "catastral_construccion",
    };
  }
  const vCompra = num(property?.valor_compra);
  if (vCompra > 0) {
    const base = vCompra * RATIO_CONSTRUCCION_ESTIMADO;
    return {
      valorConstruccion: base,
      amortizacionAnual: base * TASA_AMORTIZACION,
      requiereValorCompra: false,
      fuente: "valor_compra_estimado",
    };
  }
  return {
    valorConstruccion: 0,
    amortizacionAnual: 0,
    requiereValorCompra: true,
    fuente: "ninguno",
  };
}

/** Tipos de contrato que dan derecho a la reducción del 60%. */
const TIPOS_HABITUAL = new Set(["habitual", "larga_duracion", "vivienda_habitual"]);

export function aplicaReduccion60(tipoContrato: string | null | undefined): boolean {
  if (!tipoContrato) return false;
  return TIPOS_HABITUAL.has(String(tipoContrato).toLowerCase().trim());
}

export interface RendimientoFiscalInput {
  ingresosDeclarables: number;
  gastosDeducibles: number;
  amortizacionAnual: number;
  aplicaReduccion: boolean;
}

export interface RendimientoFiscalResultado {
  rendimientoNetoBruto: number;
  reduccion: number;
  rendimientoNetoReducido: number;
  baseLiquidableEstimada: number;
}

/**
 * Calcula el rendimiento neto y la base liquidable estimada de un inmueble.
 * No considera mínimos personales ni tipos marginales: es una estimación
 * informativa para que el usuario pueda revisar con su asesor.
 */
export function calcularRendimientoFiscal(input: RendimientoFiscalInput): RendimientoFiscalResultado {
  const bruto = input.ingresosDeclarables - input.gastosDeducibles - input.amortizacionAnual;
  const reduccion = input.aplicaReduccion && bruto > 0 ? bruto * 0.6 : 0;
  const reducido = bruto - reduccion;
  return {
    rendimientoNetoBruto: bruto,
    reduccion,
    rendimientoNetoReducido: reducido,
    baseLiquidableEstimada: reducido,
  };
}