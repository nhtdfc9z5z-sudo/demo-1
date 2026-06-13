import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextField, NumberField, SelectField, SwitchField } from "./FormFields";
import { supabase } from "@/integrations/supabase/client";
import TitularidadStep, { defaultTitularidadFields, buildTitularidadSaveData, type TitularidadFields } from "@/components/inmuebles/TitularidadStep";
import PhotonAddressSearch, { type PhotonSelection } from "@/components/direccion/PhotonAddressSearch";
import {
  Home, MapPin, Ruler, Building2, Users, ChevronRight, ChevronLeft,
  Save, Sparkles, Check, SkipForward,
} from "lucide-react";

const TIPOS_VIVIENDA = [
  { value: "piso", label: "Piso" },
  { value: "casa", label: "Casa" },
  { value: "estudio", label: "Estudio" },
  { value: "atico", label: "Ático" },
  { value: "duplex", label: "Dúplex" },
  { value: "chalet", label: "Chalet" },
  { value: "adosado", label: "Adosado" },
  { value: "local", label: "Local" },
];

// Catálogo unificado con DireccionEstructuradaForm (mismo orden y etiquetas).
const TIPOS_VIA = [
  "Calle","Avenida","Paseo","Plaza","Carretera","Ronda","Travesía","Camino",
  "Pasaje","Bulevar","Glorieta","Urbanización","Rambla","Callejón","Senda","Vía",
].map((v) => ({ value: v, label: v }));

interface PropertyCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Record<string, unknown> | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

const STEPS = [
  { id: "nombre", label: "Identificación", icon: Home, motivational: "¡Empecemos! Dale un nombre a tu activo" },
  { id: "titularidad", label: "Titularidad", icon: Users, motivational: "¿Quién es el propietario?" },
  { id: "ubicacion", label: "Ubicación", icon: MapPin, motivational: "¿Dónde está el activo?" },
  { id: "detalles", label: "Detalles", icon: Ruler, motivational: "Un poco más sobre tu activo" },
  { id: "extras", label: "Comunidad y gastos", icon: Building2, motivational: "Casi listo — datos opcionales" },
];

const PropertyCreateWizard = ({
  open,
  onOpenChange,
  initialData,
  onSave,
}: PropertyCreateWizardProps) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [titularidad, setTitularidad] = useState<TitularidadFields>(defaultTitularidadFields);

  const [f, setF] = useState({
    nombre_interno: "",
    tipo_vivienda: "",
    tipo_via: "",
    direccion_completa: "",
    numero: "",
    numero_portal: "",
    escalera: "",
    bloque: "",
    planta: "",
    puerta: "",
    urbanizacion: "",
    ciudad: "",
    municipio: "",
    provincia: "",
    comunidad_autonoma: "",
    codigo_postal: "",
    superficie_m2: null as number | null,
    num_habitaciones: null as number | null,
    num_banos: null as number | null,
    tiene_ascensor: false,
    tiene_terraza: false,
    tiene_patio: false,
    tiene_balcon: false,
    referencia_catastral: "",
    ano_construccion: null as number | null,
    cuota_comunidad: null as number | null,
    ibi_importe: null as number | null,
    basuras_importe: null as number | null,
  });

  // Apply initial data
  useEffect(() => {
    if (open && initialData) {
      setF((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next) as (keyof typeof next)[]) {
          if (key in initialData && initialData[key] != null) {
            (next as any)[key] = initialData[key];
          }
        }
        // If initialData has direccion_completa with number embedded, try to split
        if (initialData.direccion_completa && typeof initialData.direccion_completa === "string") {
          const match = (initialData.direccion_completa as string).match(/^(.+?)\s+(\d+\S*)$/);
          if (match) {
            next.direccion_completa = match[1];
            next.numero = match[2];
          }
        }
        return next;
      });
    }
    if (open) {
      setStep(0);
      setValidationError("");
    }
  }, [open, initialData]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setF({
        nombre_interno: "", tipo_vivienda: "", tipo_via: "", direccion_completa: "", numero: "",
        numero_portal: "", escalera: "", bloque: "", planta: "", puerta: "", urbanizacion: "",
        ciudad: "", municipio: "", provincia: "", comunidad_autonoma: "", codigo_postal: "",
        superficie_m2: null, num_habitaciones: null, num_banos: null,
        tiene_ascensor: false, tiene_terraza: false, tiene_patio: false, tiene_balcon: false,
        referencia_catastral: "", ano_construccion: null,
        cuota_comunidad: null, ibi_importe: null, basuras_importe: null,
      });
      setStep(0);
      setValidationError("");
      setTitularidad(defaultTitularidadFields);
    }
  }, [open]);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  // Selección explícita desde Photon: solo rellena al elegir una sugerencia.
  // Sobrescribe tipo_via / nombre_via / numero (el usuario eligió esa
  // dirección concreta); CP/provincia/CA/municipio solo si están vacíos.
  const handlePhotonSelect = useCallback((sel: PhotonSelection) => {
    setF((prev) => ({
      ...prev,
      ...(sel.tipo_via ? { tipo_via: sel.tipo_via } : {}),
      ...(sel.nombre_via ? { direccion_completa: sel.nombre_via } : {}),
      ...(sel.numero ? { numero: sel.numero } : {}),
      ...(sel.municipio && !prev.municipio ? { municipio: sel.municipio } : {}),
      ...(sel.codigo_postal && !prev.codigo_postal ? { codigo_postal: sel.codigo_postal } : {}),
      ...(sel.provincia && !prev.provincia ? { provincia: sel.provincia } : {}),
      ...(sel.comunidad_autonoma && !prev.comunidad_autonoma
        ? { comunidad_autonoma: sel.comunidad_autonoma }
        : {}),
    }));
  }, []);

  // Calculate completion percentage for progress bar
  const filledFields = [
    f.nombre_interno, f.tipo_vivienda, f.direccion_completa, f.numero,
    f.ciudad, f.planta, f.puerta, f.codigo_postal, f.provincia,
    f.superficie_m2, f.num_habitaciones, f.num_banos,
    f.referencia_catastral, f.cuota_comunidad,
  ].filter((v) => v !== "" && v !== null && v !== undefined).length;
  const totalFields = 14;
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  const getProgressMessage = () => {
    if (progressPercent < 25) return "Estás empezando — ¡cada dato cuenta!";
    if (progressPercent < 50) return "Buen comienzo — sigue así 💪";
    if (progressPercent < 75) return "¡Genial! Ya tienes bastante información";
    if (progressPercent < 100) return "¡Casi perfecto! Tu vivienda está muy completa";
    return "🎉 ¡Información completa! Tu vivienda está lista";
  };

  const buildSaveData = (): Record<string, unknown> => ({
    nombre_interno: f.nombre_interno,
    tipo_vivienda: f.tipo_vivienda || null,
    // Dirección estructurada (consumida por crearActivo en el padre).
    tipo_via: f.tipo_via || null,
    nombre_via: f.direccion_completa || null,
    numero: f.numero || null,
    // Versión plana legible (no se usa para persistir; insertPropertyRow la
    // recalcula desde los campos estructurados, pero mantenemos el campo
    // para compatibilidad con consumidores antiguos del objeto data).
    direccion_completa: [f.tipo_via, f.direccion_completa, f.numero].filter(Boolean).join(" ") || null,
    numero_portal: f.numero_portal || null,
    escalera: f.escalera || null,
    bloque: f.bloque || null,
    planta: f.planta || null,
    puerta: f.puerta || null,
    urbanizacion: f.urbanizacion || null,
    ciudad: f.ciudad || null,
    municipio: (f as any).municipio || null,
    provincia: f.provincia || null,
    comunidad_autonoma: (f as any).comunidad_autonoma || null,
    codigo_postal: f.codigo_postal || null,
    superficie_m2: f.superficie_m2,
    num_habitaciones: f.num_habitaciones,
    num_banos: f.num_banos,
    tiene_ascensor: f.tiene_ascensor,
    tiene_terraza: f.tiene_terraza,
    tiene_patio: f.tiene_patio,
    tiene_balcon: f.tiene_balcon,
    referencia_catastral: f.referencia_catastral || null,
    ano_construccion: f.ano_construccion,
    cuota_comunidad: f.cuota_comunidad,
    ibi_importe: f.ibi_importe,
    basuras_importe: f.basuras_importe,
    ...buildTitularidadSaveData(titularidad),
  });

  const validateStep = () => {
    if (step === 0 && !f.nombre_interno.trim()) {
      setValidationError("Dale un nombre a tu vivienda para identificarla (ej: \"Piso Centro\")");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = async (callback: (data: Record<string, unknown>) => Promise<void>) => {
    if (!f.nombre_interno.trim()) {
      setStep(0);
      setValidationError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await callback(buildSaveData());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Progress header */}
        <div className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { if (i < step || validateStep()) setStep(i); }}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                  i === step
                    ? "bg-primary text-primary-foreground scale-110"
                    : i < step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground font-medium">
              {progressPercent}%
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">{getProgressMessage()}</p>
        </div>

        {/* Step content */}
        <div className="px-6 pb-2 min-h-[280px]">
          <div className="flex items-center gap-2 mb-4">
            <currentStep.icon size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-foreground">{currentStep.label}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{currentStep.motivational}</p>

          {validationError && (
            <p className="text-sm text-destructive mb-3 bg-destructive/10 rounded-lg px-3 py-2">{validationError}</p>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <TextField
                label="Nombre interno *"
                value={f.nombre_interno}
                onChange={(v) => set("nombre_interno", v)}
                placeholder="Casa Playa, Piso Móstoles, Estudio Centro..."
              />
              <SelectField
                label="Tipo de vivienda"
                value={f.tipo_vivienda}
                onChange={(v) => set("tipo_vivienda", v)}
                options={TIPOS_VIVIENDA}
              />
            </div>
          )}

          {step === 1 && (
            <TitularidadStep fields={titularidad} onChange={setTitularidad} />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <PhotonAddressSearch
                onSelect={handlePhotonSelect}
                interiorPending={!f.planta || !f.puerta || !f.numero_portal}
              />
              <div className="grid grid-cols-[120px_1fr_80px] gap-2">
                <SelectField label="Tipo vía" value={f.tipo_via} onChange={(v) => set("tipo_via", v)} options={TIPOS_VIA} />
                <div>
                  <TextField
                    label="Nombre de vía"
                    value={f.direccion_completa}
                    onChange={(v) => set("direccion_completa", v)}
                    placeholder="Ej: Gran Vía"
                  />
                </div>
                <TextField
                  label="Nº"
                  value={f.numero}
                  onChange={(v) => set("numero", v)}
                  placeholder="Ej: 24"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <TextField label="Planta" value={f.planta} onChange={(v) => set("planta", v)} placeholder="Ej: 2" />
                <TextField label="Puerta" value={f.puerta} onChange={(v) => set("puerta", v)} placeholder="Ej: A" />
                <TextField label="Portal" value={f.numero_portal} onChange={(v) => set("numero_portal", v)} placeholder="si se precisa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Bloque" value={f.bloque} onChange={(v) => set("bloque", v)} placeholder="si se precisa" />
                <TextField label="Escalera" value={f.escalera} onChange={(v) => set("escalera", v)} placeholder="si se precisa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Municipio / Ciudad" value={(f as any).municipio || ""} onChange={(v) => set("municipio", v)} placeholder="Ej: Madrid, Albacete, Alcorcón..." />
                <TextField label="Código postal" value={f.codigo_postal} onChange={(v) => set("codigo_postal", v)} placeholder="Ej: 28013" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Provincia" value={f.provincia} onChange={(v) => set("provincia", v)} placeholder="Ej: Madrid" />
                <TextField label="Comunidad Autónoma" value={(f as any).comunidad_autonoma || ""} onChange={(v) => set("comunidad_autonoma", v)} placeholder="Ej: Comunidad de Madrid" />
              </div>
              <div>
                <TextField label="Urbanización" value={f.urbanizacion} onChange={(v) => set("urbanizacion", v)} placeholder="si se precisa" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Superficie" value={f.superficie_m2} onChange={(v) => set("superficie_m2", v)} placeholder="Ej: 75" suffix="m²" />
                <NumberField label="Habitaciones" value={f.num_habitaciones} onChange={(v) => set("num_habitaciones", v)} placeholder="Ej: 3" />
                <NumberField label="Baños" value={f.num_banos} onChange={(v) => set("num_banos", v)} placeholder="Ej: 2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SwitchField label="Ascensor" checked={f.tiene_ascensor} onChange={(v) => set("tiene_ascensor", v)} />
                <SwitchField label="Terraza" checked={f.tiene_terraza} onChange={(v) => set("tiene_terraza", v)} />
                <SwitchField label="Patio" checked={f.tiene_patio} onChange={(v) => set("tiene_patio", v)} />
                <SwitchField label="Balcón" checked={f.tiene_balcon} onChange={(v) => set("tiene_balcon", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Ref. catastral" value={f.referencia_catastral} onChange={(v) => set("referencia_catastral", v)} placeholder="Ej: 6547606VK2664N0011MI" />
                <NumberField label="Año construcción" value={f.ano_construccion} onChange={(v) => set("ano_construccion", v)} placeholder="Ej: 1985" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Sparkles size={12} className="inline mr-1 text-primary" />
                Estos datos son opcionales. Puedes añadirlos ahora o completarlos más tarde desde la ficha del activo.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Comunidad" value={f.cuota_comunidad} onChange={(v) => set("cuota_comunidad", v)} placeholder="50" suffix="€/mes" />
                <NumberField label="IBI" value={f.ibi_importe} onChange={(v) => set("ibi_importe", v)} placeholder="450" suffix="€/año" />
                <NumberField label="Basuras" value={f.basuras_importe} onChange={(v) => set("basuras_importe", v)} placeholder="60" suffix="€/año" />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-secondary/30 space-y-3">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="rounded-xl gap-1">
                <ChevronLeft size={14} /> Atrás
              </Button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave(onSave)}
                  disabled={saving}
                  className="rounded-xl gap-1 text-muted-foreground"
                >
                  <SkipForward size={14} />
                  Crear ya
                </Button>
                <Button size="sm" onClick={handleNext} className="rounded-xl gap-1">
                  Siguiente <ChevronRight size={14} />
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleSave(onSave)}
                  disabled={saving}
                  className="rounded-xl gap-1.5"
                  size="sm"
                >
                  <Save size={14} />
                  {saving ? "Guardando..." : "Crear vivienda"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyCreateWizard;
