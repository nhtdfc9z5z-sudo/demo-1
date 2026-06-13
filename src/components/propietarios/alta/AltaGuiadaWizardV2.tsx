/**
 * AltaGuiadaWizardV2 — Wizard único para crear un alquiler operativo.
 *
 * Reglas (Fase A+B selladas):
 *   - Toda creación pasa por `src/lib/altas/` (crearAltaCompleta).
 *   - NO se hacen inserts directos a properties / inquilinos /
 *     contratos_arrendamiento desde este componente.
 *   - El activo puede crearse con datos mínimos. La ficha patrimonial
 *     completa se completa después con un CTA explícito.
 *
 * 5 pasos + resumen:
 *   1. Activo            — elegir existente o crear nuevo (manual / PDF OCR).
 *   2. Inquilino/s       — elegir uno o varios existentes y/o crear nuevos.
 *   3. Contrato          — PDF/foto/cámara/manual + revisión OCR + dirección
 *                          estructurada + fechas (inicio + inicio control).
 *   4. Condiciones       — renta inicial / actual, fianza inicial / actual,
 *                          garantías, sin deuda histórica anterior.
 *   5. Resumen y crear   — confirmar y persistir vía crearAltaCompleta.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Home,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  User as UserIcon,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useProperties } from "@/hooks/useProperties";
import { useInquilinos } from "@/hooks/useInquilinos";
import { useContratos, type ContratoAnalysis } from "@/hooks/useContratos";
import { crearAltaCompleta } from "@/lib/altas";
import { crearPagosHistoricos, mesesImpagadosPorCantidad } from "@/lib/altas";
import { isPremium } from "@/lib/auth/flags";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { TipoActivo, AltaOrigen } from "@/lib/altas/types";
import {
  type TipoContrato,
  type TipoContratoDetalle,
  TIPOS_CONTRATO,
  labelTipoContrato,
  microcopyTipoContrato,
  mapOCRTipoToTipoContrato,
} from "@/lib/contratos/tipoContrato";
import { calcularFechaFin, derivarDuracion } from "@/lib/contratos/duracion";
import {
  MilestoneProgress,
  type Milestone,
} from "./MilestoneProgress";
import { formatDireccion, type DireccionEstructurada } from "@/lib/direccion/formatDireccion";
import { parseDireccionLibre, formatearPlantaCorto } from "@/lib/catastro/normalizacion";
import CapturaOCRStep from "./CapturaOCRStep";
import RevisionOCRStep, { type RevisionOCRValue } from "./RevisionOCRStep";
import ResumenAltaFinal, {
  type EntidadResumen,
  type CampoPendiente,
  type CreadoResultado,
} from "./ResumenAltaFinal";
import type { AnalizarDocumentoResult, ContratoAnalysisFusionado } from "@/lib/ocr/types";
import DireccionEstructuradaForm from "@/components/direccion/DireccionEstructuradaForm";
import TitularidadStep, {
  defaultTitularidadFields,
  buildTitularidadSaveData,
  type TitularidadFields,
} from "@/components/inmuebles/TitularidadStep";

// ─────────────────────────── tipos locales ───────────────────────────

type StepId =
  | "captura"
  | "revision"
  | "activo"
  | "titularidad"
  | "inquilinos"
  | "contrato"
  | "condiciones"
  | "resumen";

const ALL_STEPS: { id: StepId; label: string; icon: typeof Home }[] = [
  { id: "captura", label: "Contrato (PDF)", icon: Upload },
  { id: "revision", label: "Revisar datos", icon: Sparkles },
  { id: "activo", label: "Activo", icon: Home },
  { id: "titularidad", label: "Titularidad", icon: UsersIcon },
  { id: "inquilinos", label: "Inquilinos", icon: UserIcon },
  { id: "contrato", label: "Contrato", icon: FileText },
  { id: "condiciones", label: "Condiciones", icon: Sparkles },
  { id: "resumen", label: "Resumen", icon: Check },
];

const TIPO_ACTIVO_OPTIONS: { value: TipoActivo; label: string }[] = [
  { value: "vivienda", label: "Vivienda" },
  { value: "habitacion", label: "Habitación" },
  { value: "garaje", label: "Garaje" },
  { value: "trastero", label: "Trastero" },
  { value: "local", label: "Local" },
  { value: "nave", label: "Nave" },
  { value: "oficina", label: "Oficina" },
  { value: "terreno", label: "Terreno / parcela" },
  { value: "edificio", label: "Edificio" },
  { value: "barco", label: "Barco" },
  { value: "caravana_camper", label: "Caravana / Camper" },
  { value: "vacacional", label: "Vivienda vacacional" },
  { value: "finca_eventos", label: "Finca para eventos" },
];

interface NuevoInquilinoDraft {
  uid: string;
  nombre: string;
  apellidos: string;
  nif: string;
  email: string;
  telefono: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefilledPropertyId?: string | null;
  prefilledInquilinoId?: string | null;
  /**
   * Fase 2+3 — controla la composición del wizard:
   *  - "alquiler" (default): flujo clásico (activo → inquilinos → contrato → …)
   *  - "pdf": añade un paso inicial de captura OCR multi-archivo que
   *    pre-rellena el resto de pasos.
   */
  intencion?: "alquiler" | "pdf";
  /** Archivos pre-capturados (p.ej. desde el picker inicial). */
  initialFiles?: File[];
  onCreated?: (r: {
    propertyId?: string;
    inquilinoId?: string;
    contratoId?: string;
  }) => void;
}

const emptyInquilino = (): NuevoInquilinoDraft => ({
  uid: crypto.randomUUID(),
  nombre: "",
  apellidos: "",
  nif: "",
  email: "",
  telefono: "",
});

const emptyDireccion = (): DireccionEstructurada => ({
  tipo_via: "",
  nombre_via: "",
  numero: "",
  portal: "",
  escalera: "",
  bloque: "",
  planta: "",
  puerta: "",
  urbanizacion: "",
  parcela: "",
  codigo_postal: "",
  municipio: "",
  provincia: "",
  pais: "España",
});

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── componente ───────────────────────────

export default function AltaGuiadaWizardV2({
  open,
  onClose,
  prefilledPropertyId,
  prefilledInquilinoId,
  intencion = "alquiler",
  initialFiles,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const premium = isPremium(user);
  const { properties } = useProperties();
  const { inquilinos } = useInquilinos();
  const { analyzeContrato } = useContratos();

  // Composición de pasos según intención (Fase 2+3).
  const STEPS = useMemo(
    () =>
      ALL_STEPS.filter((s) => {
        if (s.id === "captura" || s.id === "revision") return intencion === "pdf";
        // Fase 2 unificación de altas: si el activo viene preseleccionado
        // desde el flujo de "Crear activo → Añadir inquilino y contrato",
        // omitimos los pasos de activo y titularidad (ambos pertenecen al
        // activo) para no preguntar dos veces.
        if ((s.id === "activo" || s.id === "titularidad") && prefilledPropertyId) return false;
        return true;
      }),
    [intencion, prefilledPropertyId],
  );

  // ── navegación
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── paso 1: activo
  const [activoMode, setActivoMode] = useState<"existente" | "nuevo">(
    prefilledPropertyId ? "existente" : "nuevo",
  );
  const [activoExistenteId, setActivoExistenteId] = useState<string | null>(
    prefilledPropertyId ?? null,
  );
  const [activoTipo, setActivoTipo] = useState<TipoActivo>("vivienda");
  const [activoNombre, setActivoNombre] = useState("");
  const [activoDireccion, setActivoDireccion] = useState<DireccionEstructurada>(
    emptyDireccion(),
  );
  const [titularidad, setTitularidad] = useState<TitularidadFields>(
    defaultTitularidadFields,
  );

  // ── paso 2: inquilinos
  const [inquilinosExistentes, setInquilinosExistentes] = useState<string[]>(
    prefilledInquilinoId ? [prefilledInquilinoId] : [],
  );
  const [inquilinosNuevos, setInquilinosNuevos] = useState<NuevoInquilinoDraft[]>([]);

  // ── paso 3: contrato
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [contratoFiles, setContratoFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContratoAnalysis | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaInicioControl, setFechaInicioControl] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  // Nuevo: duración del contrato (número + unidad). Reemplaza visualmente
  // al input de fecha_fin; ésta se calcula automáticamente.
  const [duracionN, setDuracionN] = useState<string>("");
  const [duracionUnidad, setDuracionUnidad] = useState<"anos" | "meses">("anos");
  // Sync: duración + fecha_inicio → fecha_fin calculada.
  useEffect(() => {
    const n = parseFloat(duracionN);
    if (!Number.isFinite(n) || n <= 0 || !fechaInicio) return;
    const f = calcularFechaFin(fechaInicio, n, duracionUnidad);
    if (f && f !== fechaFin) setFechaFin(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duracionN, duracionUnidad, fechaInicio]);

  // ── Tipo de contrato (clasificación + campos condicionales)
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>("habitual");
  // Tipo detectado por OCR (para banner de divergencia).
  const [tipoContratoOCR, setTipoContratoOCR] = useState<TipoContrato | null>(null);
  // Sub-campos por tipo (sólo el bloque del tipo activo se persiste).
  const [vacPrecioNoche, setVacPrecioNoche] = useState("");
  const [vacPlataforma, setVacPlataforma] = useState<"airbnb" | "booking" | "directo" | "otro" | "">("");
  const [vacLicencia, setVacLicencia] = useState("");
  const [habNombre, setHabNombre] = useState("");
  const [r2rRentaPagada, setR2rRentaPagada] = useState("");
  const [empCif, setEmpCif] = useState("");

  // ── paso 4: condiciones económicas
  const [rentaInicial, setRentaInicial] = useState("");
  const [rentaActual, setRentaActual] = useState("");
  const [rentaCambiada, setRentaCambiada] = useState(false);
  /**
   * Cuándo empezó a aplicarse la renta actual.
   *  - "ahora": vigente desde hoy (renta inicial aplicó todo el contrato).
   *  - "fecha": vigente desde una fecha concreta (`rentaActualDesde`).
   *  - "siempre": ya venía aplicándose desde antes; no se conoce fecha
   *    exacta. Se trata la renta actual como la "renta de siempre" y NO
   *    se crea tramo histórico → la reconstrucción no genera deuda.
   */
  const [rentaActualDesdeModo, setRentaActualDesdeModo] = useState<
    "ahora" | "fecha" | "siempre"
  >("siempre");
  const [rentaActualDesde, setRentaActualDesde] = useState("");
  const [fianzaInicial, setFianzaInicial] = useState("");
  const [fianzaActual, setFianzaActual] = useState("");
  const [fianzaCambiada, setFianzaCambiada] = useState(false);
  const [garantiaImporte, setGarantiaImporte] = useState("");
  const [sinDeudaHistorica, setSinDeudaHistorica] = useState(true);
  /**
   * Reconstrucción de pagos históricos — nuevo flujo en 3 preguntas
   * (solo se muestra si el contrato es anterior a hoy):
   *
   *   P1: controlDesde
   *     "hoy"    → no se crean pagos históricos (free + premium).
   *     "inicio" → continúa al resto del flujo (requiere premium).
   *
   *   P2: rentaSiempreIgual  (solo si controlDesde === "inicio")
   *     true  → un único tramo con la renta inicial del contrato.
   *     false → tramos editables (historicoTramos).
   *
   *   P3: pagosCompletos     (solo si controlDesde === "inicio")
   *     true  → todos los meses pasados generan pago histórico.
   *     false → el usuario indica meses impagados (modo exactos / cuantos).
   */
  const [controlDesde, setControlDesde] = useState<"hoy" | "inicio">("hoy");
  const [rentaSiempreIgual, setRentaSiempreIgual] = useState(true);
  const [pagosCompletos, setPagosCompletos] = useState(true);
  const [impagadosModo, setImpagadosModo] = useState<"exactos" | "cuantos">("exactos");
  const [impagadosExactos, setImpagadosExactos] = useState<
    Array<{ uid: string; mes: number; anio: number }>
  >([]);
  const [impagadosCuantosCount, setImpagadosCuantosCount] = useState<string>("");
  const [impagadosCuantosAnio, setImpagadosCuantosAnio] = useState<string>("");
  const [historicoTramos, setHistoricoTramos] = useState<
    Array<{ uid: string; fecha_desde: string; importe: string }>
  >([]);
  const [notas, setNotas] = useState("");

  // ── extras de revisión OCR (no persisten, sólo guían al usuario)
  const [revSuperficie, setRevSuperficie] = useState("");
  const [revHabitaciones, setRevHabitaciones] = useState("");
  const [revAno, setRevAno] = useState("");
  const [revRefCatastral, setRevRefCatastral] = useState("");
  const [revClausulaIPC, setRevClausulaIPC] = useState("");
  const [revSuministros, setRevSuministros] = useState({
    agua: false,
    luz: false,
    gas: false,
    internet: false,
    ibi: false,
    basuras: false,
    comunidad: false,
  });

  // reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      setActivoMode(prefilledPropertyId ? "existente" : "nuevo");
      setActivoExistenteId(prefilledPropertyId ?? null);
      setActivoTipo("vivienda");
      setActivoNombre("");
      setActivoDireccion(emptyDireccion());
      setTitularidad(defaultTitularidadFields);
      setInquilinosExistentes(prefilledInquilinoId ? [prefilledInquilinoId] : []);
      setInquilinosNuevos([]);
      setContratoFile(null);
      setContratoFiles([]);
      setAnalyzing(false);
      setAnalysis(null);
      setFechaInicio("");
      setFechaInicioControl("");
      setFechaFin("");
      setTipoContrato("habitual");
      setTipoContratoOCR(null);
      setVacPrecioNoche("");
      setVacPlataforma("");
      setVacLicencia("");
      setHabNombre("");
      setR2rRentaPagada("");
      setEmpCif("");
      setRentaInicial("");
      setRentaActual("");
      setRentaCambiada(false);
      setRentaActualDesdeModo("siempre");
      setRentaActualDesde("");
      setFianzaInicial("");
      setFianzaActual("");
      setFianzaCambiada(false);
      setGarantiaImporte("");
      setSinDeudaHistorica(true);
      setControlDesde("hoy");
      setRentaSiempreIgual(true);
      setPagosCompletos(true);
      setImpagadosModo("exactos");
      setImpagadosExactos([]);
      setImpagadosCuantosCount("");
      setImpagadosCuantosAnio("");
      setHistoricoTramos([]);
      setNotas("");
      setSaving(false);
      setRevSuperficie("");
      setRevHabitaciones("");
      setRevAno("");
      setRevRefCatastral("");
      setRevClausulaIPC("");
      setRevSuministros({
        agua: false,
        luz: false,
        gas: false,
        internet: false,
        ibi: false,
        basuras: false,
        comunidad: false,
      });
    }
  }, [open, prefilledPropertyId, prefilledInquilinoId]);

  // Aplica un resultado fusionado de OCR multi-archivo al estado del wizard.
  // Reutiliza la misma lógica que `handleAnalyze` (PDF único) pero sin
  // depender del hook — el resultado ya viene fusionado y validado.
  const aplicarFusionado = (res: ContratoAnalysisFusionado, files: File[]) => {
    setContratoFiles(files);
    setContratoFile(files[0] ?? null);
    setAnalysis(res);
    if (res.fecha_inicio) setFechaInicio(res.fecha_inicio);
    if (res.fecha_fin) setFechaFin(res.fecha_fin);
    // Derivar duración para el UI (preferimos duracion_anos del OCR).
    if ((res as any).duracion_anos) {
      setDuracionN(String((res as any).duracion_anos));
      setDuracionUnidad("anos");
    } else if (res.fecha_inicio && res.fecha_fin) {
      const d = derivarDuracion(res.fecha_inicio, res.fecha_fin);
      if (d) {
        setDuracionN(String(d.n));
        setDuracionUnidad(d.unidad);
      }
    }
    if (res.renta_mensual) {
      setRentaInicial(String(res.renta_mensual));
      setRentaActual(String(res.renta_mensual));
    }
    if (res.fianza_importe) {
      setFianzaInicial(String(res.fianza_importe));
      setFianzaActual(String(res.fianza_importe));
    }
    if (res.deposito_garantia) setGarantiaImporte(String(res.deposito_garantia));
    // Tipo de contrato detectado por OCR.
    {
      const det = mapOCRTipoToTipoContrato(res.tipo_contrato);
      if (det) {
        setTipoContratoOCR(det);
        // En el wizard PDF (intencion="pdf") el usuario aún no ha elegido;
        // aplicamos directamente el tipo detectado.
        if (intencion === "pdf") setTipoContrato(det);
      }
    }
    if (activoMode === "nuevo") {
      const parsed = parseDireccionLibre(res.direccion_calle);
      setActivoDireccion((d) => ({
        ...d,
        tipo_via: parsed.tipo_via_label || d.tipo_via,
        nombre_via: parsed.nombre_via || res.direccion_calle || d.nombre_via,
        numero: res.direccion_numero || parsed.numero || d.numero,
        planta: formatearPlantaCorto(res.direccion_planta) || d.planta,
        puerta: res.direccion_puerta || d.puerta,
        portal: (res as any).direccion_portal || d.portal,
        bloque: (res as any).direccion_bloque || d.bloque,
        escalera: (res as any).direccion_escalera || d.escalera,
        urbanizacion: (res as any).direccion_urbanizacion || d.urbanizacion,
        codigo_postal: res.direccion_codigo_postal || d.codigo_postal,
        municipio: res.direccion_ciudad || d.municipio,
        provincia: res.direccion_provincia || d.provincia,
      }));
      if (!activoNombre && (parsed.nombre_via || res.direccion_calle)) {
        const nombreVia = parsed.nombre_via || res.direccion_calle;
        const numero = res.direccion_numero || parsed.numero || "";
        setActivoNombre(
          `${nombreVia}${numero ? " " + numero : ""}`,
        );
      }
    }
    if (res.arrendatarios?.length) {
      setInquilinosNuevos((prev) => {
        if (prev.length > 0) return prev;
        return res.arrendatarios!.map((a) => ({
          uid: crypto.randomUUID(),
          nombre: a.nombre || "",
          apellidos: "",
          nif: a.nif || "",
          email: a.email || "",
          telefono: a.telefono || "",
        }));
      });
    }
    if (res.clausula_actualizacion_renta) {
      setRevClausulaIPC(res.clausula_actualizacion_renta);
    }
    // Datos extra para revisión (catastro / energía / superficie útil).
    if ((res as any).referencia_catastral) {
      setRevRefCatastral((res as any).referencia_catastral);
    }
    if ((res as any).superficie_util_m2) {
      setRevSuperficie(String((res as any).superficie_util_m2));
    }
    if ((res as any).ano_construccion) {
      setRevAno(String((res as any).ano_construccion));
    }
    // Auto-lookup catastral por RC si faltan superficie o año
    {
      const rc = (res as any).referencia_catastral as string | undefined;
      const supOCR = (res as any).superficie_util_m2;
      const anoOCR = (res as any).ano_construccion;
      if (rc && (!supOCR || !anoOCR)) {
        const prov = res.direccion_provincia || activoDireccion.provincia;
        const mun = res.direccion_ciudad || activoDireccion.municipio;
        if (prov && mun) {
          (async () => {
            try {
              const { data } = await supabase.functions.invoke("catastro-lookup", {
                body: { referencia_catastral: rc, provincia: prov, ciudad: mun },
              });
              if (data?.success) {
                if (data.superficie) setRevSuperficie((cur) => cur || String(data.superficie));
                if (data.anoConstruccion) setRevAno((cur) => cur || String(data.anoConstruccion));
              }
            } catch (e) {
              console.error("Auto catastro lookup (RC) failed:", e);
            }
          })();
        }
      }
    }
    setRevSuministros((s) => ({
      agua: res.agua_paga_inquilino ?? s.agua,
      luz: res.luz_paga_inquilino ?? s.luz,
      gas: res.gas_paga_inquilino ?? s.gas,
      internet: res.internet_paga_inquilino ?? s.internet,
      ibi: res.ibi_paga_inquilino ?? s.ibi,
      basuras: res.basuras_paga_inquilino ?? s.basuras,
      comunidad: res.comunidad_paga_inquilino ?? s.comunidad,
    }));
    toast({
      title: "Contrato analizado",
      description:
        files.length > 1
          ? `Hemos fusionado los datos de ${files.length} archivos. Revísalos.`
          : "Hemos rellenado lo que hemos podido detectar. Revísalo.",
    });
  };

  const handleCapturaComplete = (r: AnalizarDocumentoResult, capturedFiles: File[]) => {
    if (r.fusionado) {
      aplicarFusionado(r.fusionado, capturedFiles);
      // Hay datos → vamos a la pantalla de revisión OCR.
      setStepIdx((s) => s + 1);
    } else {
      // OCR falló o usuario continuó manualmente → saltamos revisión
      // y entramos directamente al wizard normal.
      const activoIdx = STEPS.findIndex((s) => s.id === "activo");
      if (activoIdx >= 0) setStepIdx(activoIdx);
      else setStepIdx((s) => s + 1);
    }
  };

  // ── milestones derivados
  const milestones: Milestone[] = useMemo(() => {
    const activoOK =
      activoMode === "existente"
        ? !!activoExistenteId
        : !!activoNombre.trim();
    const inquilinosOK =
      inquilinosExistentes.length > 0 ||
      inquilinosNuevos.some((i) => i.nombre.trim());
    const contratoOK = !!fechaInicio && (!!contratoFile || !!rentaInicial);
    const condicionesOK = !!parseNum(rentaInicial) && parseNum(rentaInicial)! > 0;
    const todoOK = activoOK && inquilinosOK && contratoOK && condicionesOK;
    const base: Milestone[] = [
      { id: "inquilino", label: "Inquilino vinculado", done: inquilinosOK },
      { id: "contrato", label: "Contrato detectado", done: contratoOK },
      { id: "condiciones", label: "Condiciones económicas revisadas", done: condicionesOK },
      { id: "listo", label: "Alquiler listo para gestionar", done: todoOK },
    ];
    if (!prefilledPropertyId) {
      base.unshift({ id: "activo", label: "Activo identificado", done: activoOK });
    }
    if (intencion === "pdf") {
      base.unshift({
        id: "captura",
        label: "Contrato leído",
        done: !!analysis,
      });
    }
    return base;
  }, [
    activoMode,
    activoExistenteId,
    activoNombre,
    inquilinosExistentes,
    inquilinosNuevos,
    fechaInicio,
    contratoFile,
    rentaInicial,
    intencion,
    analysis,
    prefilledPropertyId,
  ]);

  // ── OCR del contrato → aplica al estado
  const handleAnalyze = async (file: File) => {
    setContratoFile(file);
    setAnalyzing(true);
    try {
      const res = await analyzeContrato(file);
      if (!res) return;
      setAnalysis(res);
      if (res.fecha_inicio) setFechaInicio(res.fecha_inicio);
      if (res.fecha_fin) setFechaFin(res.fecha_fin);
      if ((res as any).duracion_anos) {
        setDuracionN(String((res as any).duracion_anos));
        setDuracionUnidad("anos");
      } else if (res.fecha_inicio && res.fecha_fin) {
        const d = derivarDuracion(res.fecha_inicio, res.fecha_fin);
        if (d) {
          setDuracionN(String(d.n));
          setDuracionUnidad(d.unidad);
        }
      }
      if (res.renta_mensual) {
        setRentaInicial(String(res.renta_mensual));
        setRentaActual(String(res.renta_mensual));
      }
      if (res.fianza_importe) {
        setFianzaInicial(String(res.fianza_importe));
        setFianzaActual(String(res.fianza_importe));
      }
      if (res.deposito_garantia) setGarantiaImporte(String(res.deposito_garantia));
      // Tipo de contrato detectado por OCR.
      {
        const det = mapOCRTipoToTipoContrato(res.tipo_contrato);
        if (det) {
          setTipoContratoOCR(det);
          if (intencion === "pdf") setTipoContrato(det);
        }
      }
      // dirección detectada (si no es activo existente)
      if (activoMode === "nuevo") {
        const parsed = parseDireccionLibre(res.direccion_calle);
        setActivoDireccion((d) => ({
          ...d,
          tipo_via: parsed.tipo_via_label || d.tipo_via,
          nombre_via: parsed.nombre_via || res.direccion_calle || d.nombre_via,
          numero: res.direccion_numero || parsed.numero || d.numero,
          planta: formatearPlantaCorto(res.direccion_planta) || d.planta,
          puerta: res.direccion_puerta || d.puerta,
          portal: (res as any).direccion_portal || d.portal,
          bloque: (res as any).direccion_bloque || d.bloque,
          escalera: (res as any).direccion_escalera || d.escalera,
          urbanizacion: (res as any).direccion_urbanizacion || d.urbanizacion,
          codigo_postal: res.direccion_codigo_postal || d.codigo_postal,
          municipio: res.direccion_ciudad || d.municipio,
          provincia: res.direccion_provincia || d.provincia,
        }));
        if (!activoNombre && (parsed.nombre_via || res.direccion_calle)) {
          const nombreVia = parsed.nombre_via || res.direccion_calle;
          const numero = res.direccion_numero || parsed.numero || "";
          setActivoNombre(
            `${nombreVia}${numero ? " " + numero : ""}`,
          );
        }
      }
      // arrendatarios → propuesta de nuevos inquilinos
      if (res.arrendatarios?.length) {
        setInquilinosNuevos((prev) => {
          if (prev.length > 0) return prev;
          return res.arrendatarios!.map((a) => ({
            uid: crypto.randomUUID(),
            nombre: a.nombre || "",
            apellidos: "",
            nif: a.nif || "",
            email: a.email || "",
            telefono: a.telefono || "",
          }));
        });
      } else if (res.arrendatario_nombre && inquilinosNuevos.length === 0) {
        setInquilinosNuevos([
          {
            uid: crypto.randomUUID(),
            nombre: res.arrendatario_nombre,
            apellidos: "",
            nif: res.arrendatario_nif || "",
            email: res.arrendatario_email || "",
            telefono: res.arrendatario_telefono || "",
          },
        ]);
      }
      // Datos extra para revisión.
      if ((res as any).referencia_catastral) {
        setRevRefCatastral((res as any).referencia_catastral);
      }
      if ((res as any).superficie_util_m2) {
        setRevSuperficie(String((res as any).superficie_util_m2));
      }
      if ((res as any).ano_construccion) {
        setRevAno(String((res as any).ano_construccion));
      }
      // Auto-lookup catastral por RC si faltan superficie o año
      {
        const rc = (res as any).referencia_catastral as string | undefined;
        const supOCR = (res as any).superficie_util_m2;
        const anoOCR = (res as any).ano_construccion;
        if (rc && (!supOCR || !anoOCR)) {
          const prov = res.direccion_provincia || activoDireccion.provincia;
          const mun = res.direccion_ciudad || activoDireccion.municipio;
          if (prov && mun) {
            (async () => {
              try {
                const { data } = await supabase.functions.invoke("catastro-lookup", {
                  body: { referencia_catastral: rc, provincia: prov, ciudad: mun },
                });
                if (data?.success) {
                  if (data.superficie) setRevSuperficie((cur) => cur || String(data.superficie));
                  if (data.anoConstruccion) setRevAno((cur) => cur || String(data.anoConstruccion));
                }
              } catch (e) {
                console.error("Auto catastro lookup (RC) failed:", e);
              }
            })();
          }
        }
      }
      toast({
        title: "Contrato analizado",
        description: "Hemos rellenado lo que hemos podido detectar. Revísalo.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // ── persistir
  const handleGuardar = async (): Promise<CreadoResultado> => {
    if (saving) throw new Error("Ya se está creando…");
    setSaving(true);
    try {
      const rentaIni = parseNum(rentaInicial);
      if (!rentaIni || rentaIni <= 0) {
        throw new Error("La renta inicial debe ser mayor que 0.");
      }
      const rentaActNum = parseNum(rentaActual);
      // Renta vigente HOY (la que se cachea en contrato.renta_mensual y la
      // que CapitalRent usará para meses futuros y cobertura desde el
      // inicio de control). Si el usuario no marca "renta cambiada", la
      // renta vigente es la inicial.
      const rentaVigente =
        rentaCambiada && rentaActNum && rentaActNum > 0 ? rentaActNum : rentaIni;
      if (!fechaInicio) throw new Error("La fecha de inicio del contrato es obligatoria.");

      // ── Reconstrucción económica segura ────────────────────────────
      // 1) `fecha_inicio_control`: si el usuario marca "Contrato al día",
      //    CapitalRent solo controla desde HOY → no se genera deuda por
      //    meses anteriores. Si no, controla desde el inicio del contrato.
      const hoyISO = new Date().toISOString().slice(0, 10);
      // Si el usuario eligió registrar cobros históricos (opción A o B),
      // el control debe arrancar desde el inicio del contrato para que los
      // pagos creados encajen como meses cubiertos. En caso contrario se
      // mantiene el comportamiento previo basado en `sinDeudaHistorica`.
      const reconstruirHistorico =
        controlDesde === "inicio" && fechaInicio < hoyISO;
      const fechaControl = reconstruirHistorico
        ? fechaInicio
        : sinDeudaHistorica
          ? hoyISO
          : (fechaInicioControl || fechaInicio);

      // 2) Tramo histórico de renta: solo si el usuario indicó que la renta
      //    actual es distinta de la inicial Y conoce una fecha de cambio.
      //    Caso "siempre" (ya venía aplicándose desde antes) → no creamos
      //    tramo y guardamos directamente la renta vigente como única; así
      //    la reconstrucción nunca aplica la renta actual sobre meses con
      //    renta inicial (que generaría deuda ficticia).
      let tramo: {
        fecha_efectiva: string;
        importe_anterior: number;
        importe_nuevo: number;
        motivo?: string | null;
        notas?: string | null;
      } | null = null;
      if (rentaCambiada && rentaActNum && rentaActNum > 0 && rentaActNum !== rentaIni) {
        const fechaTramo =
          rentaActualDesdeModo === "fecha" && rentaActualDesde
            ? rentaActualDesde
            : rentaActualDesdeModo === "ahora"
              ? hoyISO
              : null; // "siempre" → sin tramo
        if (fechaTramo) {
          tramo = {
            fecha_efectiva: fechaTramo,
            importe_anterior: rentaIni,
            importe_nuevo: rentaActNum,
            motivo: "alta_guiada",
            notas: "Tramo registrado al dar de alta el alquiler.",
          };
        }
      }

      // activo
      const activoInput =
        activoMode === "existente"
          ? { existente_id: activoExistenteId! }
          : {
              nuevo: {
                tipo: activoTipo,
                nombre_interno: activoNombre.trim(),
                direccion: activoDireccion,
                superficie_m2: revSuperficie ? parseFloat(revSuperficie) : null,
                ano_construccion: revAno ? parseInt(revAno, 10) : null,
                referencia_catastral: revRefCatastral.trim() || null,
                // Titularidad opcional: si el usuario rellenó algo se persiste
                // junto al activo (jsonb + columnas legacy). Si no, los valores
                // por defecto (propietario_unico) no introducen ruido.
                extra: buildTitularidadSaveData(titularidad),
              },
            };

      // inquilinos
      const nuevosValidos = inquilinosNuevos.filter((i) => i.nombre.trim());
      const inquilinosInput = [
        ...inquilinosExistentes.map((id) => ({ existente_id: id })),
        ...nuevosValidos.map((i) => ({
          nuevo: {
            nombre: i.nombre.trim(),
            apellidos: i.apellidos.trim() || null,
            nif: i.nif.trim() || null,
            email: i.email.trim() || null,
            telefono: i.telefono.trim() || null,
          },
        })),
      ];
      if (inquilinosInput.length === 0) {
        throw new Error("Añade al menos un inquilino.");
      }

      const meta = {
        origen: (contratoFile ? "alta_contrato_pdf" : "wizard_alquiler") as AltaOrigen,
        fuenteOriginal: contratoFile?.name,
      };

      // ── tipo de contrato + detalle (solo se persiste el bloque del tipo activo)
      const detalle: TipoContratoDetalle = { version: 1, tipo: tipoContrato };
      if (tipoContrato === "vacacional") {
        detalle.vacacional = {
          precio_noche: parseNum(vacPrecioNoche),
          plataforma: vacPlataforma || null,
          licencia_turistica: vacLicencia.trim() || null,
        };
      } else if (tipoContrato === "habitaciones") {
        detalle.habitaciones = { habitacion_nombre: habNombre.trim() || null };
      } else if (tipoContrato === "rent_to_rent") {
        detalle.rent_to_rent = { renta_pagada_al_propietario: parseNum(r2rRentaPagada) };
      } else if (tipoContrato === "cesion_empresa") {
        detalle.cesion_empresa = { cif_arrendatario: empCif.trim() || null };
      }

      const result = await crearAltaCompleta({
        activo: activoInput,
        inquilinos: inquilinosInput,
        archivos_contrato:
          contratoFiles.length > 0
            ? contratoFiles
            : contratoFile
              ? [contratoFile]
              : undefined,
        contrato: {
          titulo: `Alquiler ${activoNombre || ""}`.trim() || "Contrato de arrendamiento",
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || null,
          duracion_n: duracionN ? parseFloat(duracionN) : null,
          duracion_unidad: duracionN ? duracionUnidad : null,
          renta_mensual: rentaVigente,
          fecha_inicio_control: fechaControl,
          tramo_renta_inicial: tramo,
          fianza_importe: parseNum(fianzaInicial),
          deposito_garantia: parseNum(garantiaImporte),
          tipo_contrato: tipoContrato,
          tipo_contrato_detalle: detalle,
          notas: [
            notas?.trim(),
            rentaCambiada && rentaActNum
              ? `Renta inicial del contrato: ${rentaInicial} €/mes. Renta vigente: ${rentaActual} €/mes${
                  tramo ? ` (desde ${tramo.fecha_efectiva})` : " (sin fecha exacta de cambio)"
                }.`
              : null,
            fianzaCambiada && fianzaActual
              ? `Fianza actual: ${fianzaActual} € (distinta a la inicial).`
              : null,
            `Inicio de control CapitalRent: ${fechaControl}.`,
            sinDeudaHistorica
              ? "Contrato al día: sin deuda histórica anterior a la fecha de control."
              : null,
          ]
            .filter(Boolean)
            .join("\n") || null,
        },
        meta,
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["properties"] }),
        qc.invalidateQueries({ queryKey: ["inquilinos"] }),
        qc.invalidateQueries({ queryKey: ["contratos"] }),
      ]);

      // Pagos históricos (opt-in). Solo si el contrato es anterior a hoy
      // y el usuario eligió Opción A (renta inicial) o B (tramos editables).
      if (reconstruirHistorico && result.contrato_id && result.inquilino_ids[0]) {
        const userResp = await supabase.auth.getUser();
        const uid = userResp.data.user?.id;
        if (uid) {
          // Tramos: si la renta siempre fue la misma → un solo tramo con
          // la renta inicial. Si hubo cambios → tramos editados; si falta
          // el tramo inicial, se prepende uno con la renta del contrato
          // desde fecha_inicio (fallback robusto).
          let tramosInput: Array<{ fecha_desde: string; importe: number }>;
          if (rentaSiempreIgual) {
            tramosInput = [{ fecha_desde: fechaInicio, importe: rentaIni }];
          } else {
            const parsed = historicoTramos
              .map((t) => ({
                fecha_desde: t.fecha_desde,
                importe: parseNum(t.importe),
              }))
              .filter((t) => t.fecha_desde && t.importe > 0)
              .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
            const tieneInicial = parsed.some((t) => t.fecha_desde <= fechaInicio);
            tramosInput = tieneInicial
              ? parsed
              : [{ fecha_desde: fechaInicio, importe: rentaIni }, ...parsed];
          }
          // Meses excluidos (impagados reales): no se crean → quedan como deuda.
          const mesesExcluidos = pagosCompletos
            ? []
            : impagadosModo === "exactos"
              ? impagadosExactos
                  .filter((m) => m.mes >= 1 && m.mes <= 12 && m.anio > 0)
                  .map(({ mes, anio }) => ({ mes, anio }))
              : mesesImpagadosPorCantidad(
                  Number(impagadosCuantosAnio) || 0,
                  Number(impagadosCuantosCount) || 0,
                );
          if (tramosInput.length > 0) {
            try {
              await crearPagosHistoricos({
                property_id: result.property_id,
                inquilino_id: result.inquilino_ids[0],
                contrato_id: result.contrato_id,
                user_id: uid,
                fecha_inicio: fechaInicio,
                fecha_fin_control: hoyISO,
                tramos: tramosInput,
                mesesExcluidos,
              });
              await qc.invalidateQueries({ queryKey: ["pagos_renta"] });
            } catch (e) {
              console.warn("[alta] crearPagosHistoricos falló (no bloquea alta)", e);
            }
          }
        }
      }

      return {
        property_id: result.property_id,
        inquilino_ids: result.inquilino_ids,
        contrato_id: result.contrato_id,
      };
    } finally {
      setSaving(false);
    }
  };

  // ── validación por paso para habilitar "Siguiente"
  const canAdvance = (() => {
    const id = STEPS[stepIdx].id;
    if (id === "captura") {
      // El propio CapturaOCRStep controla cuándo avanzar (botones internos).
      return false;
    }
    if (id === "revision") {
      // RevisionOCRStep tiene sus propios botones.
      return false;
    }
    if (id === "activo") {
      return activoMode === "existente"
        ? !!activoExistenteId
        : !!activoNombre.trim();
    }
    if (id === "titularidad") {
      // Paso opcional: nunca bloquea.
      return true;
    }
    if (id === "inquilinos") {
      return (
        inquilinosExistentes.length > 0 ||
        inquilinosNuevos.some((i) => i.nombre.trim())
      );
    }
    if (id === "contrato") {
      return !!fechaInicio;
    }
    if (id === "condiciones") {
      const r = parseNum(rentaInicial);
      return !!r && r > 0;
    }
    return true;
  })();

  const currentStep = STEPS[stepIdx];

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-xl">
            {intencion === "pdf" ? "Alta desde contrato (PDF)" : "Alta de alquiler"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Paso {stepIdx + 1} de {STEPS.length} · {currentStep.label}
          </p>
        </SheetHeader>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_240px]">
          {/* contenido */}
          <div className="min-w-0">
            {currentStep.id === "captura" && (
              <CapturaOCRStep
                onComplete={handleCapturaComplete}
                onSkip={() => setStepIdx((s) => s + 1)}
                initialFiles={initialFiles}
              />
            )}

            {currentStep.id === "revision" && analysis && (
              <RevisionOCRStep
                analysis={analysis as ContratoAnalysisFusionado}
                value={{
                  direccion: activoDireccion,
                  superficie: revSuperficie,
                  habitaciones: revHabitaciones,
                  ano_construccion: revAno,
                  referencia_catastral: revRefCatastral,
                  inquilinos: inquilinosNuevos,
                  fechaInicio,
                  fechaFin,
                  rentaInicial,
                  fianzaInicial,
                  clausulaIPC: revClausulaIPC,
                  suministros: revSuministros,
                }}
                onChange={(patch) => {
                  if (patch.direccion) setActivoDireccion(patch.direccion);
                  if (patch.superficie !== undefined) setRevSuperficie(patch.superficie);
                  if (patch.habitaciones !== undefined) setRevHabitaciones(patch.habitaciones);
                  if (patch.ano_construccion !== undefined) setRevAno(patch.ano_construccion);
                  if (patch.referencia_catastral !== undefined)
                    setRevRefCatastral(patch.referencia_catastral);
                  if (patch.inquilinos) setInquilinosNuevos(patch.inquilinos);
                  if (patch.fechaInicio !== undefined) setFechaInicio(patch.fechaInicio);
                  if (patch.fechaFin !== undefined) setFechaFin(patch.fechaFin);
                  if (patch.rentaInicial !== undefined) {
                    setRentaInicial(patch.rentaInicial);
                    if (!rentaCambiada) setRentaActual(patch.rentaInicial);
                  }
                  if (patch.fianzaInicial !== undefined) {
                    setFianzaInicial(patch.fianzaInicial);
                    if (!fianzaCambiada) setFianzaActual(patch.fianzaInicial);
                  }
                  if (patch.clausulaIPC !== undefined) setRevClausulaIPC(patch.clausulaIPC);
                  if (patch.suministros) setRevSuministros(patch.suministros);
                }}
                onConfirm={() => {
                  const idx = STEPS.findIndex((s) => s.id === "resumen");
                  if (idx >= 0) setStepIdx(idx);
                }}
                onEditStepByStep={() => {
                  const idx = STEPS.findIndex((s) => s.id === "activo");
                  if (idx >= 0) setStepIdx(idx);
                }}
              />
            )}

            {currentStep.id === "activo" && (
              <StepActivo
                mode={activoMode}
                onModeChange={setActivoMode}
                existenteId={activoExistenteId}
                onExistenteChange={setActivoExistenteId}
                properties={properties}
                tipo={activoTipo}
                onTipoChange={setActivoTipo}
                nombre={activoNombre}
                onNombreChange={setActivoNombre}
                direccion={activoDireccion}
                onDireccionChange={setActivoDireccion}
              />
            )}

            {currentStep.id === "titularidad" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paso opcional. Puedes continuar sin rellenar nada y completarlo
                  más tarde desde la ficha del activo.
                </p>
                <TitularidadStep fields={titularidad} onChange={setTitularidad} />
              </div>
            )}

            {currentStep.id === "inquilinos" && (
              <StepInquilinos
                inquilinos={inquilinos}
                existentes={inquilinosExistentes}
                onExistentesChange={setInquilinosExistentes}
                nuevos={inquilinosNuevos}
                onNuevosChange={setInquilinosNuevos}
              />
            )}

            {currentStep.id === "contrato" && (
              <StepContrato
                file={contratoFile}
                analyzing={analyzing}
                analysis={analysis}
                onUpload={handleAnalyze}
                onClear={() => {
                  setContratoFile(null);
                  setAnalysis(null);
                }}
                fechaInicio={fechaInicio}
                onFechaInicio={setFechaInicio}
                fechaInicioControl={fechaInicioControl}
                onFechaInicioControl={setFechaInicioControl}
                fechaFin={fechaFin}
                onFechaFin={setFechaFin}
                duracionN={duracionN}
                onDuracionN={setDuracionN}
                duracionUnidad={duracionUnidad}
                onDuracionUnidad={setDuracionUnidad}
                tipoContrato={tipoContrato}
                onTipoContrato={setTipoContrato}
                tipoContratoOCR={tipoContratoOCR}
                onDescartarSugerenciaOCR={() => setTipoContratoOCR(null)}
                vacPrecioNoche={vacPrecioNoche}
                onVacPrecioNoche={setVacPrecioNoche}
                vacPlataforma={vacPlataforma}
                onVacPlataforma={setVacPlataforma}
                vacLicencia={vacLicencia}
                onVacLicencia={setVacLicencia}
                habNombre={habNombre}
                onHabNombre={setHabNombre}
                r2rRentaPagada={r2rRentaPagada}
                onR2rRentaPagada={setR2rRentaPagada}
                empCif={empCif}
                onEmpCif={setEmpCif}
              />
            )}

            {currentStep.id === "condiciones" && (
              <StepCondiciones
                rentaInicial={rentaInicial}
                onRentaInicial={setRentaInicial}
                rentaActual={rentaActual}
                onRentaActual={setRentaActual}
                rentaCambiada={rentaCambiada}
                onRentaCambiada={setRentaCambiada}
                rentaActualDesdeModo={rentaActualDesdeModo}
                onRentaActualDesdeModo={setRentaActualDesdeModo}
                rentaActualDesde={rentaActualDesde}
                onRentaActualDesde={setRentaActualDesde}
                fianzaInicial={fianzaInicial}
                onFianzaInicial={setFianzaInicial}
                fianzaActual={fianzaActual}
                onFianzaActual={setFianzaActual}
                fianzaCambiada={fianzaCambiada}
                onFianzaCambiada={setFianzaCambiada}
                garantiaImporte={garantiaImporte}
                onGarantiaImporte={setGarantiaImporte}
                sinDeudaHistorica={sinDeudaHistorica}
                onSinDeudaHistorica={setSinDeudaHistorica}
                fechaInicio={fechaInicio}
                isPremium={premium}
                controlDesde={controlDesde}
                onControlDesde={setControlDesde}
                rentaSiempreIgual={rentaSiempreIgual}
                onRentaSiempreIgual={setRentaSiempreIgual}
                pagosCompletos={pagosCompletos}
                onPagosCompletos={setPagosCompletos}
                impagadosModo={impagadosModo}
                onImpagadosModo={setImpagadosModo}
                impagadosExactos={impagadosExactos}
                onImpagadosExactos={setImpagadosExactos}
                impagadosCuantosCount={impagadosCuantosCount}
                onImpagadosCuantosCount={setImpagadosCuantosCount}
                impagadosCuantosAnio={impagadosCuantosAnio}
                onImpagadosCuantosAnio={setImpagadosCuantosAnio}
                historicoTramos={historicoTramos}
                onHistoricoTramos={setHistoricoTramos}
                notas={notas}
                onNotas={setNotas}
              />
            )}

            {currentStep.id === "resumen" && (() => {
              const activoExistente = activoExistenteId
                ? properties.find((p) => p.id === activoExistenteId)
                : undefined;
              const tipoLabel =
                TIPO_ACTIVO_OPTIONS.find((t) => t.value === activoTipo)?.label ||
                activoTipo;
              const entidades: EntidadResumen[] = [];
              if (activoMode === "existente" && activoExistente) {
                entidades.push({
                  tipo: "activo",
                  estado: "existente",
                  titulo: activoExistente.nombre_interno || "Activo",
                  subtitulo: activoExistente.direccion_completa || undefined,
                });
              } else {
                entidades.push({
                  tipo: "activo",
                  estado: "nuevo",
                  titulo: activoNombre || `${tipoLabel} nuevo`,
                  subtitulo: formatDireccion(activoDireccion) || tipoLabel,
                });
              }
              inquilinosExistentes.forEach((id) => {
                const inq = inquilinos.find((i) => i.id === id);
                if (inq) entidades.push({
                  tipo: "inquilino",
                  estado: "existente",
                  titulo: inq.nombre || "Inquilino",
                  subtitulo: inq.email || inq.telefono || undefined,
                });
              });
              inquilinosNuevos
                .filter((i) => i.nombre.trim())
                .forEach((i) => entidades.push({
                  tipo: "inquilino",
                  estado: "nuevo",
                  titulo: [i.nombre, i.apellidos].filter(Boolean).join(" ").trim(),
                  subtitulo: i.nif || i.email || i.telefono || undefined,
                }));
              entidades.push({
                tipo: "contrato",
                estado: "nuevo",
                titulo: `Contrato desde ${fechaInicio || "—"}`,
                subtitulo: `${rentaCambiada ? rentaActual : rentaInicial || "—"} €/mes`,
              });

              const pendientes: CampoPendiente[] = [];
              if (activoMode === "nuevo") {
                if (!revRefCatastral) pendientes.push({ label: "Referencia catastral" });
                if (!revSuperficie) pendientes.push({ label: "Superficie (m²)" });
                pendientes.push({ label: "Certificado energético" });
                pendientes.push({ label: "Fotografías" });
              }

              const detalle = (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Fecha inicio</dt>
                  <dd className="text-right font-medium">{fechaInicio || "—"}</dd>
                  <dt className="text-muted-foreground">Fecha fin</dt>
                  <dd className="text-right font-medium">{fechaFin || "—"}</dd>
                  <dt className="text-muted-foreground">Inicio de control</dt>
                  <dd className="text-right font-medium">{(sinDeudaHistorica ? new Date().toISOString().slice(0,10) : (fechaInicioControl || fechaInicio)) || "—"}</dd>
                  <dt className="text-muted-foreground">Renta inicial</dt>
                  <dd className="text-right font-medium">{rentaInicial || "—"} €/mes</dd>
                  <dt className="text-muted-foreground">Renta actual</dt>
                  <dd className="text-right font-medium">{(rentaCambiada ? rentaActual : rentaInicial) || "—"} €/mes</dd>
                  <dt className="text-muted-foreground">Fianza</dt>
                  <dd className="text-right font-medium">{(fianzaCambiada ? fianzaActual : fianzaInicial) || "—"} €</dd>
                  {garantiaImporte && (<>
                    <dt className="text-muted-foreground">Garantía adicional</dt>
                    <dd className="text-right font-medium">{garantiaImporte} €</dd>
                  </>)}
                </dl>
              );

              return (
                <ResumenAltaFinal
                  intencion={intencion === "pdf" ? "pdf" : "alquiler"}
                  entidades={entidades}
                  milestones={milestones}
                  camposPendientes={pendientes}
                  detalle={detalle}
                  onCrear={handleGuardar}
                  propertyParaCompletitud={
                    activoMode === "existente" && activoExistenteId
                      ? properties.find((p) => p.id === activoExistenteId) ?? null
                      : null
                  }
                  onIrAFicha={(r) => {
                    onCreated?.({
                      propertyId: r.property_id,
                      inquilinoId: r.inquilino_ids?.[0],
                      contratoId: r.contrato_id,
                    });
                    onClose();
                  }}
                  onAltaOtro={() => {
                    onClose();
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("cr:open-alta-picker"));
                    }, 100);
                  }}
                  onCompletarDesdeFicha={(r) => {
                    onCreated?.({
                      propertyId: r.property_id,
                      inquilinoId: r.inquilino_ids?.[0],
                      contratoId: r.contrato_id,
                    });
                    onClose();
                  }}
                />
              );
            })()}
          </div>

          {/* sidebar de hitos */}
          <div className="hidden lg:block">
            <MilestoneProgress milestones={milestones} />
          </div>
        </div>

        {/* nav inferior */}
        <div className="sticky bottom-0 mt-6 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => (stepIdx === 0 ? onClose() : setStepIdx((s) => s - 1))}
              disabled={saving}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {stepIdx === 0 ? "Cancelar" : "Atrás"}
            </Button>
            {currentStep.id === "captura" ? (
              // CapturaOCRStep gestiona sus propios CTAs (Analizar / Saltar).
              <div className="text-xs text-muted-foreground">
                Pulsa “Analizar y continuar” o “Prefiero rellenarlo a mano”.
              </div>
            ) : currentStep.id === "revision" ? (
              <div className="text-xs text-muted-foreground">
                Usa los botones de la pantalla para continuar.
              </div>
            ) : currentStep.id === "resumen" ? (
              <div className="text-xs text-muted-foreground">
                Pulsa “Crear” para confirmar.
              </div>
            ) : (
              <Button
                onClick={() => setStepIdx((s) => s + 1)}
                disabled={!canAdvance}
              >
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────── Paso 1: Activo ───────────────────────────

function StepActivo(props: {
  mode: "existente" | "nuevo";
  onModeChange: (m: "existente" | "nuevo") => void;
  existenteId: string | null;
  onExistenteChange: (id: string | null) => void;
  properties: { id: string; nombre_interno: string | null; direccion_completa: string | null }[];
  tipo: TipoActivo;
  onTipoChange: (t: TipoActivo) => void;
  nombre: string;
  onNombreChange: (v: string) => void;
  direccion: DireccionEstructurada;
  onDireccionChange: (d: DireccionEstructurada) => void;
}) {
  const variant: "vivienda" | "no-vivienda" | "rustica" =
    props.tipo === "terreno"
      ? "rustica"
      : ["vivienda", "habitacion", "vacacional", "oficina", "local", "nave"].includes(props.tipo)
      ? "vivienda"
      : "no-vivienda";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => props.onModeChange("existente")}
          className={`rounded-lg border p-3 text-left text-sm transition ${
            props.mode === "existente"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <div className="font-medium">Usar activo existente</div>
          <div className="text-xs text-muted-foreground">
            Elegir uno de tu cartera
          </div>
        </button>
        <button
          type="button"
          onClick={() => props.onModeChange("nuevo")}
          className={`rounded-lg border p-3 text-left text-sm transition ${
            props.mode === "nuevo"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <div className="font-medium">Crear activo nuevo</div>
          <div className="text-xs text-muted-foreground">
            Datos básicos ahora, ficha completa después
          </div>
        </button>
      </div>

      {props.mode === "existente" ? (
        <div className="space-y-2">
          <Label>Activo</Label>
          <Select
            value={props.existenteId ?? ""}
            onValueChange={(v) => props.onExistenteChange(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un activo de tu cartera" />
            </SelectTrigger>
            <SelectContent>
              {props.properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre_interno || "Sin nombre"}
                  {p.direccion_completa ? ` — ${p.direccion_completa}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de activo</Label>
              <Select
                value={props.tipo}
                onValueChange={(v) => props.onTipoChange(v as TipoActivo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_ACTIVO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre interno *</Label>
              <Input
                value={props.nombre}
                onChange={(e) => props.onNombreChange(e.target.value)}
                placeholder="Ej. Piso Arces"
              />
            </div>
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground">
            Dirección estructurada — rellena solo lo que aplique a este tipo de
            activo. Municipio se autocompleta si se conoce.
          </p>
          <DireccionEstructuradaForm
            value={props.direccion}
            onChange={props.onDireccionChange}
            variant={variant}
          />
          {formatDireccion(props.direccion) && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Dirección completa:</span>{" "}
              <span className="font-medium">
                {formatDireccion(props.direccion)}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Ficha creada con datos básicos. Podrás completar la ficha
            patrimonial cuando quieras desde el activo.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Paso 2: Inquilinos ───────────────────────────

function StepInquilinos(props: {
  inquilinos: { id: string; nombre: string | null; email: string | null }[];
  existentes: string[];
  onExistentesChange: (ids: string[]) => void;
  nuevos: NuevoInquilinoDraft[];
  onNuevosChange: (n: NuevoInquilinoDraft[]) => void;
}) {
  const toggle = (id: string, checked: boolean) =>
    props.onExistentesChange(
      checked
        ? [...props.existentes, id]
        : props.existentes.filter((x) => x !== id),
    );

  return (
    <div className="space-y-5">
      {props.inquilinos.length > 0 && (
        <div className="space-y-2">
          <Label>Inquilinos existentes</Label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {props.inquilinos.map((i) => {
              const checked = props.existentes.includes(i.id);
              return (
                <label
                  key={i.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => toggle(i.id, !!c)}
                  />
                  <span className="text-sm">
                    {i.nombre || "Sin nombre"}
                    {i.email ? (
                      <span className="text-muted-foreground"> · {i.email}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Nuevos inquilinos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => props.onNuevosChange([...props.nuevos, emptyInquilino()])}
          >
            <Plus className="mr-1 h-4 w-4" /> Añadir
          </Button>
        </div>
        {props.nuevos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Puedes crear uno o varios inquilinos. Datos mínimos: nombre.
          </p>
        ) : (
          <div className="space-y-3">
            {props.nuevos.map((i, idx) => (
              <div
                key={i.uid}
                className="rounded-md border p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Inquilino #{idx + 1}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      props.onNuevosChange(props.nuevos.filter((x) => x.uid !== i.uid))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nombre *"
                    value={i.nombre}
                    onChange={(e) =>
                      props.onNuevosChange(
                        props.nuevos.map((x) =>
                          x.uid === i.uid ? { ...x, nombre: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Apellidos"
                    value={i.apellidos}
                    onChange={(e) =>
                      props.onNuevosChange(
                        props.nuevos.map((x) =>
                          x.uid === i.uid ? { ...x, apellidos: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="NIF"
                    value={i.nif}
                    onChange={(e) =>
                      props.onNuevosChange(
                        props.nuevos.map((x) =>
                          x.uid === i.uid ? { ...x, nif: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Teléfono"
                    value={i.telefono}
                    onChange={(e) =>
                      props.onNuevosChange(
                        props.nuevos.map((x) =>
                          x.uid === i.uid ? { ...x, telefono: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Email"
                    value={i.email}
                    onChange={(e) =>
                      props.onNuevosChange(
                        props.nuevos.map((x) =>
                          x.uid === i.uid ? { ...x, email: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Paso 3: Contrato ───────────────────────────

function StepContrato(props: {
  file: File | null;
  analyzing: boolean;
  analysis: ContratoAnalysis | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  fechaInicio: string;
  onFechaInicio: (v: string) => void;
  fechaInicioControl: string;
  onFechaInicioControl: (v: string) => void;
  fechaFin: string;
  onFechaFin: (v: string) => void;
  duracionN: string;
  onDuracionN: (v: string) => void;
  duracionUnidad: "anos" | "meses";
  onDuracionUnidad: (v: "anos" | "meses") => void;
  // Tipo de contrato
  tipoContrato: TipoContrato;
  onTipoContrato: (t: TipoContrato) => void;
  tipoContratoOCR: TipoContrato | null;
  onDescartarSugerenciaOCR: () => void;
  // Campos condicionales
  vacPrecioNoche: string;
  onVacPrecioNoche: (v: string) => void;
  vacPlataforma: "airbnb" | "booking" | "directo" | "otro" | "";
  onVacPlataforma: (v: "airbnb" | "booking" | "directo" | "otro" | "") => void;
  vacLicencia: string;
  onVacLicencia: (v: string) => void;
  habNombre: string;
  onHabNombre: (v: string) => void;
  r2rRentaPagada: string;
  onR2rRentaPagada: (v: string) => void;
  empCif: string;
  onEmpCif: (v: string) => void;
}) {
  const sugerenciaOCR =
    props.tipoContratoOCR && props.tipoContratoOCR !== props.tipoContrato
      ? props.tipoContratoOCR
      : null;
  const plataformas: { id: "airbnb" | "booking" | "directo" | "otro"; label: string }[] = [
    { id: "airbnb", label: "Airbnb" },
    { id: "booking", label: "Booking" },
    { id: "directo", label: "Directo" },
    { id: "otro", label: "Otro" },
  ];
  return (
    <div className="space-y-5">
      {/* Tipo de contrato (primera pregunta) */}
      <div className="space-y-2">
        <Label>Tipo de contrato</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIPOS_CONTRATO.map((t) => {
            const active = props.tipoContrato === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => props.onTipoContrato(t)}
                className={`min-h-[56px] p-2.5 rounded-xl border text-left transition-all ${
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                }`}
              >
                <p className="text-sm font-medium">{labelTipoContrato(t)}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{microcopyTipoContrato(t)}</p>
              </button>
            );
          })}
        </div>

        {sugerenciaOCR && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>
                Hemos detectado un contrato <b>{labelTipoContrato(sugerenciaOCR).toLowerCase()}</b>. ¿Quieres cambiar el tipo?
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="default" onClick={() => { props.onTipoContrato(sugerenciaOCR); props.onDescartarSugerenciaOCR(); }}>
                  Cambiar
                </Button>
                <Button size="sm" variant="outline" onClick={props.onDescartarSugerenciaOCR}>
                  Mantener
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Campos condicionales por tipo */}
      {props.tipoContrato === "vacacional" && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos vacacionales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Precio por noche (€)</Label>
              <Input type="number" min="0" step="0.01" value={props.vacPrecioNoche} onChange={(e) => props.onVacPrecioNoche(e.target.value)} placeholder="80" />
            </div>
            <div className="space-y-1">
              <Label>Licencia turística</Label>
              <Input value={props.vacLicencia} onChange={(e) => props.onVacLicencia(e.target.value)} placeholder="VT-1234-XX" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Plataforma</Label>
            <div className="flex flex-wrap gap-1.5">
              {plataformas.map((p) => {
                const active = props.vacPlataforma === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => props.onVacPlataforma(active ? "" : p.id)}
                    className={`min-h-[36px] px-3 rounded-full border text-xs ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            TODO: en una fase futura, el motor calculará ingresos por noche. Por ahora se guarda como información.
          </p>
        </div>
      )}

      {props.tipoContrato === "habitaciones" && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Habitación</p>
          <div className="space-y-1">
            <Label>Nombre o número de habitación</Label>
            <Input value={props.habNombre} onChange={(e) => props.onHabNombre(e.target.value)} placeholder="Hab. 1 / Suite" />
          </div>
        </div>
      )}

      {props.tipoContrato === "rent_to_rent" && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rent to rent</p>
          <div className="space-y-1">
            <Label>Renta mensual que pagas al propietario (€)</Label>
            <Input type="number" min="0" step="0.01" value={props.r2rRentaPagada} onChange={(e) => props.onR2rRentaPagada(e.target.value)} placeholder="900" />
            <p className="text-[11px] text-muted-foreground">
              Si lo dejaste en el paso de titularidad del activo, también se recogerá desde ahí.
            </p>
          </div>
        </div>
      )}

      {props.tipoContrato === "cesion_empresa" && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cesión a empresa</p>
          <div className="space-y-1">
            <Label>CIF del arrendatario</Label>
            <Input value={props.empCif} onChange={(e) => props.onEmpCif(e.target.value)} placeholder="B12345678" />
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <Label>Contrato (PDF o foto) · opcional</Label>
        {props.file ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="truncate">
              <FileText className="mr-2 inline h-4 w-4" />
              {props.file.name}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={props.onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/30">
            <Upload className="h-4 w-4" />
            Subir PDF, foto o usar cámara
            <input
              type="file"
              accept="application/pdf,image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onUpload(f);
              }}
            />
          </label>
        )}
        {props.analyzing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Analizando con IA…
          </div>
        )}
        {props.analysis && !props.analyzing && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Datos detectados aplicados. Revisa fechas y condiciones en los pasos
            siguientes.
          </div>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Fecha de inicio del contrato *</Label>
          <Input
            type="date"
            value={props.fechaInicio}
            onChange={(e) => props.onFechaInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Duración del contrato</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={props.duracionN}
              onChange={(e) => props.onDuracionN(e.target.value)}
              className="w-20"
            />
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={props.duracionUnidad}
              onChange={(e) =>
                props.onDuracionUnidad(e.target.value as "anos" | "meses")
              }
            >
              <option value="anos">años</option>
              <option value="meses">meses</option>
            </select>
          </div>
          {props.fechaFin && (
            <p className="text-xs text-muted-foreground">
              Fecha de fin: {new Date(props.fechaFin).toLocaleDateString("es-ES")}
            </p>
          )}
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Fecha de inicio de control en CapitalRent</Label>
          <Input
            type="date"
            value={props.fechaInicioControl}
            onChange={(e) => props.onFechaInicioControl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Solo si el alquiler ya estaba en marcha y empiezas a controlarlo
            ahora. Si lo dejas vacío, usamos la fecha de inicio del contrato.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Paso 4: Condiciones ───────────────────────────

function StepCondiciones(props: {
  rentaInicial: string;
  onRentaInicial: (v: string) => void;
  rentaActual: string;
  onRentaActual: (v: string) => void;
  rentaCambiada: boolean;
  onRentaCambiada: (v: boolean) => void;
  rentaActualDesdeModo: "ahora" | "fecha" | "siempre";
  onRentaActualDesdeModo: (v: "ahora" | "fecha" | "siempre") => void;
  rentaActualDesde: string;
  onRentaActualDesde: (v: string) => void;
  fianzaInicial: string;
  onFianzaInicial: (v: string) => void;
  fianzaActual: string;
  onFianzaActual: (v: string) => void;
  fianzaCambiada: boolean;
  onFianzaCambiada: (v: boolean) => void;
  garantiaImporte: string;
  onGarantiaImporte: (v: string) => void;
  sinDeudaHistorica: boolean;
  onSinDeudaHistorica: (v: boolean) => void;
  fechaInicio: string;
  isPremium: boolean;
  controlDesde: "hoy" | "inicio";
  onControlDesde: (v: "hoy" | "inicio") => void;
  rentaSiempreIgual: boolean;
  onRentaSiempreIgual: (v: boolean) => void;
  pagosCompletos: boolean;
  onPagosCompletos: (v: boolean) => void;
  impagadosModo: "exactos" | "cuantos";
  onImpagadosModo: (v: "exactos" | "cuantos") => void;
  impagadosExactos: Array<{ uid: string; mes: number; anio: number }>;
  onImpagadosExactos: (
    v: Array<{ uid: string; mes: number; anio: number }>,
  ) => void;
  impagadosCuantosCount: string;
  onImpagadosCuantosCount: (v: string) => void;
  impagadosCuantosAnio: string;
  onImpagadosCuantosAnio: (v: string) => void;
  historicoTramos: Array<{ uid: string; fecha_desde: string; importe: string }>;
  onHistoricoTramos: (
    v: Array<{ uid: string; fecha_desde: string; importe: string }>,
  ) => void;
  notas: string;
  onNotas: (v: string) => void;
}) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const esHistorico = !!props.fechaInicio && props.fechaInicio < hoyISO;
  const tramos = props.historicoTramos;
  const addTramo = () =>
    props.onHistoricoTramos([
      ...tramos,
      {
        uid: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha_desde: tramos.length === 0 ? props.fechaInicio || "" : "",
        importe: "",
      },
    ]);
  const updateTramo = (uid: string, patch: Partial<{ fecha_desde: string; importe: string }>) =>
    props.onHistoricoTramos(
      tramos.map((t) => (t.uid === uid ? { ...t, ...patch } : t)),
    );
  const removeTramo = (uid: string) =>
    props.onHistoricoTramos(tramos.filter((t) => t.uid !== uid));
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Renta inicial (€/mes) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={props.rentaInicial}
              onChange={(e) => props.onRentaInicial(e.target.value)}
              placeholder="0,00"
            />
          </div>
          {props.rentaCambiada && (
            <div className="space-y-1">
              <Label>Renta actual (€/mes)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={props.rentaActual}
                onChange={(e) => props.onRentaActual(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={props.rentaCambiada}
            onCheckedChange={(c) => props.onRentaCambiada(!!c)}
          />
          La renta actual es distinta a la inicial del contrato
        </label>
        {props.rentaCambiada && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium">
              ¿Desde cuándo se aplica la renta actual?
            </p>
            <p className="text-[11px] text-muted-foreground">
              Importante: CapitalRent usa esta fecha para no aplicar la renta
              actual a meses antiguos (lo que generaría deuda histórica
              ficticia).
            </p>
            <div className="space-y-1.5">
              {[
                { v: "siempre", label: "Ya venía aplicándose desde antes (no recuerdo la fecha exacta)" },
                { v: "ahora", label: "Empieza a aplicarse desde ahora" },
                { v: "fecha", label: "Desde una fecha concreta…" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="renta-actual-desde"
                    checked={props.rentaActualDesdeModo === opt.v}
                    onChange={() =>
                      props.onRentaActualDesdeModo(opt.v as "ahora" | "fecha" | "siempre")
                    }
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
              {props.rentaActualDesdeModo === "fecha" && (
                <Input
                  type="date"
                  value={props.rentaActualDesde}
                  onChange={(e) => props.onRentaActualDesde(e.target.value)}
                  className="mt-1 max-w-[200px]"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Fianza inicial (€)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={props.fianzaInicial}
              onChange={(e) => props.onFianzaInicial(e.target.value)}
              placeholder="0,00"
            />
          </div>
          {props.fianzaCambiada && (
            <div className="space-y-1">
              <Label>Fianza actual (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={props.fianzaActual}
                onChange={(e) => props.onFianzaActual(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={props.fianzaCambiada}
            onCheckedChange={(c) => props.onFianzaCambiada(!!c)}
          />
          La fianza actual es distinta a la inicial
        </label>
      </div>

      <Separator />

      <div className="space-y-1">
        <Label>Garantía adicional (€)</Label>
        <Input
          type="number"
          inputMode="decimal"
          value={props.garantiaImporte}
          onChange={(e) => props.onGarantiaImporte(e.target.value)}
          placeholder="0,00"
        />
      </div>

      <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
        <Checkbox
          checked={props.sinDeudaHistorica}
          onCheckedChange={(c) => props.onSinDeudaHistorica(!!c)}
        />
        <span>
          <span className="font-medium">Contrato al día.</span>{" "}
          <span className="text-xs text-muted-foreground">
            No hay pagos pendientes anteriores. CapitalRent solo controlará
            cobros desde hoy; no se generará deuda por meses pasados.
          </span>
        </span>
      </label>

      {esHistorico && (
        <HistoricoFlow
          fechaInicio={props.fechaInicio}
          isPremium={props.isPremium}
          controlDesde={props.controlDesde}
          onControlDesde={props.onControlDesde}
          rentaSiempreIgual={props.rentaSiempreIgual}
          onRentaSiempreIgual={props.onRentaSiempreIgual}
          pagosCompletos={props.pagosCompletos}
          onPagosCompletos={props.onPagosCompletos}
          impagadosModo={props.impagadosModo}
          onImpagadosModo={props.onImpagadosModo}
          impagadosExactos={props.impagadosExactos}
          onImpagadosExactos={props.onImpagadosExactos}
          impagadosCuantosCount={props.impagadosCuantosCount}
          onImpagadosCuantosCount={props.onImpagadosCuantosCount}
          impagadosCuantosAnio={props.impagadosCuantosAnio}
          onImpagadosCuantosAnio={props.onImpagadosCuantosAnio}
          tramos={tramos}
          addTramo={addTramo}
          updateTramo={updateTramo}
          removeTramo={removeTramo}
        />
      )}

      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Textarea
          value={props.notas}
          onChange={(e) => props.onNotas(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// ─────────────────────────── HistoricoFlow (3 preguntas) ───────────────────────────

const MESES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function HistoricoFlow(props: {
  fechaInicio: string;
  isPremium: boolean;
  controlDesde: "hoy" | "inicio";
  onControlDesde: (v: "hoy" | "inicio") => void;
  rentaSiempreIgual: boolean;
  onRentaSiempreIgual: (v: boolean) => void;
  pagosCompletos: boolean;
  onPagosCompletos: (v: boolean) => void;
  impagadosModo: "exactos" | "cuantos";
  onImpagadosModo: (v: "exactos" | "cuantos") => void;
  impagadosExactos: Array<{ uid: string; mes: number; anio: number }>;
  onImpagadosExactos: (
    v: Array<{ uid: string; mes: number; anio: number }>,
  ) => void;
  impagadosCuantosCount: string;
  onImpagadosCuantosCount: (v: string) => void;
  impagadosCuantosAnio: string;
  onImpagadosCuantosAnio: (v: string) => void;
  tramos: Array<{ uid: string; fecha_desde: string; importe: string }>;
  addTramo: () => void;
  updateTramo: (uid: string, patch: Partial<{ fecha_desde: string; importe: string }>) => void;
  removeTramo: (uid: string) => void;
}) {
  const inicioAnio = props.fechaInicio
    ? Number(props.fechaInicio.slice(0, 4))
    : new Date().getFullYear();
  const hoyAnio = new Date().getFullYear();
  const addImpagadoExacto = () =>
    props.onImpagadosExactos([
      ...props.impagadosExactos,
      {
        uid: `i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mes: 1,
        anio: hoyAnio,
      },
    ]);
  const updateImpagado = (uid: string, patch: Partial<{ mes: number; anio: number }>) =>
    props.onImpagadosExactos(
      props.impagadosExactos.map((m) => (m.uid === uid ? { ...m, ...patch } : m)),
    );
  const removeImpagado = (uid: string) =>
    props.onImpagadosExactos(props.impagadosExactos.filter((m) => m.uid !== uid));

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      {/* ─── Pregunta 1 ─── */}
      <p className="text-sm font-medium">
        ¿Desde cuándo quieres controlar este contrato?
      </p>
      <p className="text-[11px] text-muted-foreground">
        El contrato empezó el {props.fechaInicio}.
      </p>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="radio"
            name="control-desde"
            checked={props.controlDesde === "hoy"}
            onChange={() => props.onControlDesde("hoy")}
          />
          <span>Desde hoy</span>
        </label>
        {props.isPremium ? (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="control-desde"
              checked={props.controlDesde === "inicio"}
              onChange={() => props.onControlDesde("inicio")}
            />
            <span>Desde el inicio del contrato</span>
          </label>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Con el plan básico el control empieza desde hoy. Actualiza a
            Premium para reconstruir el historial.
          </p>
        )}
      </div>

      {props.controlDesde === "inicio" && props.isPremium && (
        <>
          <Separator />
          {/* ─── Pregunta 2 ─── */}
          <p className="text-sm font-medium">
            ¿Ha cambiado la renta desde el inicio del contrato?
          </p>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="renta-historico"
                checked={props.rentaSiempreIgual}
                onChange={() => props.onRentaSiempreIgual(true)}
              />
              <span>No, siempre ha sido la misma renta</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="renta-historico"
                checked={!props.rentaSiempreIgual}
                onChange={() => props.onRentaSiempreIgual(false)}
              />
              <span>Sí, ha habido subidas</span>
            </label>
          </div>
          {!props.rentaSiempreIgual && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Añade un tramo por cada cambio de renta. Cada tramo aplica
                desde su fecha hasta el siguiente.
              </p>
              {props.tramos.map((t) => (
                <div key={t.uid} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={t.fecha_desde}
                    onChange={(e) => props.updateTramo(t.uid, { fecha_desde: e.target.value })}
                    className="max-w-[160px]"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={t.importe}
                    onChange={(e) => props.updateTramo(t.uid, { importe: e.target.value })}
                    placeholder="€/mes"
                    className="max-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={() => props.removeTramo(t.uid)}
                    className="text-xs text-muted-foreground underline"
                  >
                    quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={props.addTramo}
                className="text-xs font-medium text-primary underline"
              >
                + añadir tramo
              </button>
            </div>
          )}

          <Separator />
          {/* ─── Pregunta 3 ─── */}
          <p className="text-sm font-medium">
            ¿Están todos los meses pagados hasta hoy?
          </p>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="pagos-completos"
                checked={props.pagosCompletos}
                onChange={() => props.onPagosCompletos(true)}
              />
              <span>Sí, todo está al día</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="pagos-completos"
                checked={!props.pagosCompletos}
                onChange={() => props.onPagosCompletos(false)}
              />
              <span>No, hay meses pendientes</span>
            </label>
          </div>
          {!props.pagosCompletos && (
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="impagados-modo"
                    checked={props.impagadosModo === "exactos"}
                    onChange={() => props.onImpagadosModo("exactos")}
                  />
                  <span>Sé qué meses son exactamente</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="impagados-modo"
                    checked={props.impagadosModo === "cuantos"}
                    onChange={() => props.onImpagadosModo("cuantos")}
                  />
                  <span>Sé cuántos meses pero no cuáles</span>
                </label>
              </div>
              {props.impagadosModo === "exactos" ? (
                <div className="space-y-2">
                  {props.impagadosExactos.map((m) => (
                    <div key={m.uid} className="flex items-center gap-2">
                      <select
                        value={m.mes}
                        onChange={(e) => updateImpagado(m.uid, { mes: Number(e.target.value) })}
                        className="h-9 rounded-md border bg-background px-2 text-xs"
                      >
                        {MESES_ES.map((nombre, i) => (
                          <option key={i + 1} value={i + 1}>{nombre}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={m.anio}
                        onChange={(e) => updateImpagado(m.uid, { anio: Number(e.target.value) })}
                        className="max-w-[100px]"
                      />
                      <button
                        type="button"
                        onClick={() => removeImpagado(m.uid)}
                        className="text-xs text-muted-foreground underline"
                      >
                        quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addImpagadoExacto}
                    className="text-xs font-medium text-primary underline"
                  >
                    + añadir mes impagado
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Nº meses"
                    value={props.impagadosCuantosCount}
                    onChange={(e) => props.onImpagadosCuantosCount(e.target.value)}
                    className="max-w-[110px]"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={`Año (${inicioAnio}–${hoyAnio})`}
                    value={props.impagadosCuantosAnio}
                    onChange={(e) => props.onImpagadosCuantosAnio(e.target.value)}
                    className="max-w-[140px]"
                  />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Esos meses no se marcan como cobrados; quedarán como deuda
                pendiente para que los gestiones.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Paso 5: Resumen ───────────────────────────

function StepResumen(props: {
  activoMode: "existente" | "nuevo";
  activoExistente?: { nombre_interno: string | null; direccion_completa: string | null };
  activoTipo: TipoActivo;
  activoNombre: string;
  activoDireccion: DireccionEstructurada;
  inquilinosExistentes: ({ nombre: string | null } | undefined)[];
  inquilinosNuevos: NuevoInquilinoDraft[];
  fechaInicio: string;
  fechaInicioControl: string;
  fechaFin: string;
  rentaInicial: string;
  rentaActual: string;
  fianzaInicial: string;
  fianzaActual: string;
  garantiaImporte: string;
  sinDeudaHistorica: boolean;
}) {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
  const tipoLabel =
    TIPO_ACTIVO_OPTIONS.find((t) => t.value === props.activoTipo)?.label ||
    props.activoTipo;

  return (
    <div className="space-y-4">
      <section className="rounded-md border p-3">
        <h3 className="mb-2 text-sm font-semibold">Activo</h3>
        {props.activoMode === "existente" ? (
          <>
            <Row k="Existente" v={props.activoExistente?.nombre_interno || "—"} />
            <Row k="Dirección" v={props.activoExistente?.direccion_completa || "—"} />
          </>
        ) : (
          <>
            <Row k="Tipo" v={tipoLabel} />
            <Row k="Nombre" v={props.activoNombre} />
            <Row k="Dirección" v={formatDireccion(props.activoDireccion) || "—"} />
          </>
        )}
      </section>

      <section className="rounded-md border p-3">
        <h3 className="mb-2 text-sm font-semibold">Inquilinos</h3>
        <ul className="text-sm">
          {props.inquilinosExistentes
            .filter(Boolean)
            .map((i, idx) => (
              <li key={`e-${idx}`}>· {i?.nombre} <span className="text-xs text-muted-foreground">(existente)</span></li>
            ))}
          {props.inquilinosNuevos.map((i) => (
            <li key={i.uid}>
              · {i.nombre} {i.apellidos}{" "}
              <span className="text-xs text-muted-foreground">(nuevo)</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border p-3">
        <h3 className="mb-2 text-sm font-semibold">Contrato</h3>
        <Row k="Fecha de inicio" v={props.fechaInicio} />
        <Row k="Fecha de fin" v={props.fechaFin} />
        <Row
          k="Inicio de control"
          v={props.fechaInicioControl || props.fechaInicio}
        />
      </section>

      <section className="rounded-md border p-3">
        <h3 className="mb-2 text-sm font-semibold">Condiciones económicas</h3>
        <Row k="Renta inicial" v={`${props.rentaInicial || "—"} €/mes`} />
        <Row k="Renta actual" v={`${props.rentaActual || props.rentaInicial || "—"} €/mes`} />
        <Row k="Fianza inicial" v={`${props.fianzaInicial || "—"} €`} />
        <Row k="Fianza actual" v={`${props.fianzaActual || props.fianzaInicial || "—"} €`} />
        <Row k="Garantía adicional" v={`${props.garantiaImporte || "—"} €`} />
        <Row
          k="Sin deuda histórica"
          v={props.sinDeudaHistorica ? "Sí" : "No"}
        />
      </section>

      {props.activoMode === "nuevo" && (
        <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Ficha creada con datos básicos. Podrás{" "}
          <strong>completar la ficha del activo</strong> cuando quieras desde su
          detalle (valoración, superficie, año, referencia catastral, etc.).
        </p>
      )}
    </div>
  );
}