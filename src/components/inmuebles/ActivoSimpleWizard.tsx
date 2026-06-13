import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextField, NumberField } from "../propietarios/FormFields";
import DireccionEstructuradaForm from "../direccion/DireccionEstructuradaForm";
import type { DireccionEstructurada } from "@/lib/direccion/formatDireccion";
import TitularidadStep, { defaultTitularidadFields, buildTitularidadSaveData, type TitularidadFields } from "./TitularidadStep";
import { MapPin, Users, Check, ChevronRight, ChevronLeft, FileText, ClipboardCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { crearActivo } from "@/lib/altas/crearActivo";
import type { TipoActivo } from "@/lib/altas/types";
import { detectarPendientes, etiquetaPendienteTitularidad } from "@/lib/titularidad/pendientes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import ResumenAltaFinal, {
  type EntidadResumen,
  type CampoPendiente,
  type CreadoResultado,
} from "../propietarios/alta/ResumenAltaFinal";
import type { Milestone } from "../propietarios/alta/MilestoneProgress";

/**
 * ActivoSimpleWizard — ABSORBIDO (Fase 5).
 *
 * Ya no es una puerta de entrada independiente al alta. Sólo se monta como
 * paso interno del flujo unificado de alta:
 *   AltaIntencionPicker → ("otro-activo") OtroActivoTipoPicker
 *                      → este wizard
 *   AltaIntencionPicker → ("activo")     PropertyCreateWizard (vivienda manual)
 *
 * Las CTAs visibles ("Dar de alta", "Otro tipo") siempre pasan por
 * `useAltaAlquiler().openPicker()` o el dropdown directo de tipos.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback opcional ejecutado tras la creación. Recibe el id del activo. */
  onCreated?: (id: string) => void;
  /** Slug guardado en `tipo_inmueble`. */
  tipo: TipoActivo;
  /** Etiqueta visible (singular). */
  tipoLabel: string;
  /** Icono del activo para la cabecera. */
  TipoIcon: LucideIcon;
  /** Placeholder del nombre interno (ej. "Mi velero, Camper familiar..."). */
  nombrePlaceholder?: string;
  /** Si false, el paso de ubicación queda como "Base habitual" opcional (móviles). */
  ubicacionFija?: boolean;
  /** Etiqueta del paso de ubicación. */
  ubicacionLabel?: string;
  /** Intención original que abrió el wizard. Sólo afecta al título del resumen. */
  intencion?: "activo" | "otro-activo";
}

const ActivoSimpleWizard = ({
  open,
  onOpenChange,
  onCreated,
  tipo,
  tipoLabel,
  TipoIcon,
  nombrePlaceholder,
  ubicacionFija = true,
  ubicacionLabel,
  intencion = "otro-activo",
}: Props) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const STEPS = [
    { id: "nombre", label: "Identificación", icon: TipoIcon, motivational: `Ponle nombre a tu ${tipoLabel.toLowerCase()}` },
    { id: "titularidad", label: "Titularidad", icon: Users, motivational: "¿Quién es el propietario?" },
    { id: "ubicacion", label: ubicacionLabel || (ubicacionFija ? "Ubicación" : "Base habitual"), icon: MapPin, motivational: ubicacionFija ? "¿Dónde está?" : "¿Dónde suele estar? (opcional)" },
    { id: "detalles", label: "Detalles", icon: FileText, motivational: "Datos básicos y valoración" },
    { id: "resumen", label: "Resumen", icon: ClipboardCheck, motivational: "Revisa y confirma antes de crear" },
  ];

  const [step, setStep] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [f, setF] = useState({
    nombre_interno: "",
    superficie_m2: null as number | null,
    valor_compra: null as number | null,
    ano_compra: null as number | null,
    valor_estimado: null as number | null,
    referencia_catastral: "" as string,
    valor_catastral: null as number | null,
    notas: "",
  });
  const [direccion, setDireccion] = useState<DireccionEstructurada>({
    tipo_via: "", nombre_via: "", numero: "", portal: "", escalera: "", bloque: "",
    planta: "", puerta: "", urbanizacion: "", parcela: "",
    codigo_postal: "", municipio: "", provincia: "", pais: "España",
  });
  const [titularidad, setTitularidad] = useState<TitularidadFields>(defaultTitularidadFields);

  useEffect(() => {
    if (!open) {
      setF({ nombre_interno: "", superficie_m2: null, valor_compra: null, ano_compra: null, valor_estimado: null, referencia_catastral: "", valor_catastral: null, notas: "" });
      setDireccion({ tipo_via: "", nombre_via: "", numero: "", portal: "", escalera: "", bloque: "", planta: "", puerta: "", urbanizacion: "", parcela: "", codigo_postal: "", municipio: "", provincia: "", pais: "España" });
      setTitularidad(defaultTitularidadFields);
      setStep(0);
      setValidationError("");
    }
  }, [open]);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF(prev => ({ ...prev, [key]: value }));

  const filledCount = [...Object.values(f), ...Object.values(direccion)].filter(v => v !== "" && v !== null && v !== undefined && v !== false).length;
  const progressPercent = Math.round((filledCount / (Object.keys(f).length + Object.keys(direccion).length)) * 100);

  const handleCrear = async (): Promise<CreadoResultado> => {
    if (!f.nombre_interno.trim()) {
      setStep(0);
      setValidationError("El nombre es obligatorio.");
      throw new Error("El nombre es obligatorio.");
    }
    const { id } = await crearActivo({
      tipo,
      nombre_interno: f.nombre_interno,
      direccion,
      superficie_m2: f.superficie_m2,
      ano_compra: f.ano_compra,
      valor_compra: f.valor_compra,
      valor_estimado: f.valor_estimado,
      notas: f.notas || null,
      meta: { origen: "alta_activo_manual" },
      extra: buildTitularidadSaveData(titularidad),
    });
    queryClient.invalidateQueries({ queryKey: ["properties", user?.id] });
    return { property_id: id };
  };

  // Datos derivados para el resumen final.
  const direccionResumen = [
    [direccion.tipo_via, direccion.nombre_via, direccion.numero].filter(Boolean).join(" "),
    [direccion.codigo_postal, direccion.municipio].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");

  const entidades: EntidadResumen[] = [
    {
      tipo: "activo",
      estado: "nuevo",
      titulo: f.nombre_interno || `Nuevo ${tipoLabel.toLowerCase()}`,
      subtitulo: direccionResumen || tipoLabel,
    },
  ];

  const milestones: Milestone[] = [
    { id: "nombre", label: "Identificación", done: !!f.nombre_interno.trim() },
    { id: "titularidad", label: "Titularidad", done: true },
    { id: "ubicacion", label: ubicacionFija ? "Ubicación" : "Base habitual", done: ubicacionFija ? !!direccion.nombre_via : true },
    { id: "detalles", label: "Datos básicos", done: !!(f.superficie_m2 || f.valor_compra || f.valor_estimado) },
  ];

  const pendientesTitularidad = detectarPendientes({
    relacion: titularidad.relacion,
    copropietarios: titularidad.copropietarios,
    nudo_propietario_nombre: titularidad.nudo_propietario_nombre,
    nudo_propietario_nif: titularidad.nudo_propietario_nif,
    tercero_nombre: titularidad.tercero_nombre,
    tercero_dni: titularidad.tercero_dni,
    comision_pct: titularidad.comision_pct ? Number(titularidad.comision_pct.replace(",", ".")) : null,
    renta_pagada_mensual: titularidad.renta_pagada_mensual ? Number(titularidad.renta_pagada_mensual.replace(",", ".")) : null,
  });

  const camposPendientes: CampoPendiente[] = [
    { label: "Certificado energético" },
    { label: "Referencia catastral" },
    { label: "Fotografías" },
    ...pendientesTitularidad.map((c) => ({
      label: etiquetaPendienteTitularidad(c),
      hint: "Titularidad",
    })),
  ];

  const currentStep = STEPS[step];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { if (i <= step) setStep(i); }}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                  i === step ? "bg-primary text-primary-foreground scale-110" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground font-medium">{progressPercent}%</div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <div className="px-6 pb-2 min-h-[280px] max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <currentStep.icon size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-foreground">{currentStep.label}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{currentStep.motivational}</p>
          {validationError && <p className="text-sm text-destructive mb-3 bg-destructive/10 rounded-lg px-3 py-2">{validationError}</p>}

          {step === 0 && (
            <TextField
              label="Nombre interno *"
              value={f.nombre_interno}
              onChange={v => set("nombre_interno", v)}
              placeholder={nombrePlaceholder || `Mi ${tipoLabel.toLowerCase()}`}
            />
          )}
          {step === 1 && <TitularidadStep fields={titularidad} onChange={setTitularidad} />}
          {step === 2 && (
            <DireccionEstructuradaForm
              value={direccion}
              onChange={setDireccion}
              variant={ubicacionFija ? "no-vivienda" : "no-vivienda"}
            />
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Superficie / Eslora" value={f.superficie_m2} onChange={v => set("superficie_m2", v)} placeholder="m² o m" suffix="m²" />
                <NumberField label="Año de compra" value={f.ano_compra} onChange={v => set("ano_compra", v)} placeholder="2020" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Precio compra" value={f.valor_compra} onChange={v => set("valor_compra", v)} placeholder="€" suffix="€" />
                <NumberField label="Valor estimado" value={f.valor_estimado} onChange={v => set("valor_estimado", v)} placeholder="€" suffix="€" />
              </div>
              <TextField label="Notas" value={f.notas} onChange={v => set("notas", v)} placeholder="Cualquier detalle relevante..." />
            </div>
          )}
          {step === 4 && (
            <ResumenAltaFinal
              intencion={intencion}
              entidades={entidades}
              milestones={milestones}
              camposPendientes={camposPendientes}
              onCrear={handleCrear}
              onIrAFicha={(r) => {
                if (r.property_id) onCreated?.(r.property_id);
                onOpenChange(false);
              }}
              onAltaOtro={() => {
                onOpenChange(false);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("cr:open-alta-picker"));
                }, 100);
              }}
              onCompletarDesdeFicha={(r) => {
                if (r.property_id) onCreated?.(r.property_id);
                onOpenChange(false);
              }}
            />
          )}
        </div>
        {step < STEPS.length - 1 ? (
          <div className="px-6 pb-6 flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl gap-1">
                <ChevronLeft size={16} /> Atrás
              </Button>
            )}
            <div className="flex-1" />
            <Button
              onClick={() => {
                if (step === 0 && !f.nombre_interno.trim()) { setValidationError("El nombre es obligatorio"); return; }
                setValidationError("");
                setStep(step + 1);
              }}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
            >
              {step === STEPS.length - 2 ? "Revisar" : "Siguiente"} <ChevronRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="px-6 pb-6 flex">
            <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl gap-1">
              <ChevronLeft size={16} /> Atrás
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ActivoSimpleWizard;