import type { DireccionEstructurada } from "@/lib/direccion/formatDireccion";
import type { TipoContrato, TipoContratoDetalle } from "@/lib/contratos/tipoContrato";

export type AltaOrigen =
  | "wizard_alquiler"
  | "alta_activo_manual"
  | "alta_activo_escritura"
  | "alta_activo_nota_simple"
  | "alta_activo_contrato"
  | "alta_activo_fotos"
  | "alta_inquilino_manual"
  | "alta_inquilino_dni"
  | "alta_contrato_manual"
  | "alta_contrato_pdf"
  | "alta_contrato_fotos";

export interface AltaMeta {
  origen: AltaOrigen;
  /** OCR source file name, if any */
  fuenteOriginal?: string;
}

export type TipoActivo =
  | "vivienda"
  | "habitacion"
  | "garaje"
  | "trastero"
  | "local"
  | "nave"
  | "oficina"
  | "terreno"
  | "edificio"
  | "barco"
  | "caravana_camper"
  | "vacacional"
  | "finca_eventos";

export interface CrearActivoInput {
  tipo: TipoActivo;
  nombre_interno: string;
  direccion: DireccionEstructurada;
  superficie_m2?: number | null;
  ano_construccion?: number | null;
  ano_compra?: number | null;
  valor_compra?: number | null;
  valor_estimado?: number | null;
  referencia_catastral?: string | null;
  num_habitaciones?: number | null;
  num_banos?: number | null;
  notas?: string | null;
  meta: AltaMeta;
  /** Extra fields specific to the asset type, passed through verbatim. */
  extra?: Record<string, unknown>;
}

export interface CrearInquilinoInput {
  nombre: string;
  apellidos?: string | null;
  nif?: string | null;
  email?: string | null;
  telefono?: string | null;
  property_id?: string | null;
  notas?: string | null;
  meta: AltaMeta;
}

export interface CrearContratoInput {
  property_id: string;
  inquilino_ids: string[];
  titulo?: string;
  fecha_inicio: string; // ISO date
  fecha_fin?: string | null;
  /**
   * Duración explícita del contrato. Si se proporciona y no hay fecha_fin,
   * `crearContrato` calcula la fecha_fin con `calcularFechaFin`.
   * Si ambas existen, fecha_fin gana (no se sobrescribe).
   */
  duracion_n?: number | null;
  duracion_unidad?: "anos" | "meses" | null;
  renta_mensual: number;
  fianza_importe?: number | null;
  deposito_garantia?: number | null;
  pdf_url?: string | null;
  notas?: string | null;
  meta: AltaMeta;
  /**
   * Tipo de contrato (clasificación). Default 'habitual'.
   * Si vale 'habitaciones', `crearContrato` fuerza
   * `modalidad_alquiler='habitaciones'` para que el motor existente
   * trate los pagos como hoy. El resto de tipos no tocan el motor.
   */
  tipo_contrato?: TipoContrato;
  /** Campos específicos por tipo (precio/noche, plataforma, CIF, etc.). */
  tipo_contrato_detalle?: TipoContratoDetalle | null;
  /**
   * Fecha (YYYY-MM-DD) a partir de la cual CapitalRent toma control del
   * contrato. Periodos anteriores NO generan deuda, pendientes, ni métricas.
   * Si se omite, el motor usa el fallback defensivo (`created_at` del
   * contrato) — ver `isPeriodoBajoControl` en `rentaUtils.ts`.
   */
  fecha_inicio_control?: string | null;
  /**
   * Si el usuario indica que la renta vigente HOY (renta_mensual) es
   * distinta de la renta inicial del contrato, registramos un tramo en
   * `renta_actualizaciones` para que la reconstrucción histórica use la
   * renta correcta en cada periodo (y NO aplique la renta actual a meses
   * antiguos generando deuda ficticia).
   */
  tramo_renta_inicial?: {
    fecha_efectiva: string; // ISO date, vigencia de la renta actual
    importe_anterior: number; // renta del contrato original
    importe_nuevo: number; // renta vigente HOY (= renta_mensual)
    motivo?: string | null;
    notas?: string | null;
  } | null;
}

export interface AltaResultado {
  property_id?: string;
  inquilino_ids?: string[];
  contrato_id?: string;
}