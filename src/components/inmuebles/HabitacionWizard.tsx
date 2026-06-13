import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextField, NumberField, SwitchField } from "../propietarios/FormFields";
import InmuebleAddressStep, { type AddressFields } from "./InmuebleAddressStep";
import TitularidadStep, { defaultTitularidadFields, buildTitularidadSaveData, type TitularidadFields } from "./TitularidadStep";
import { BedDouble, MapPin, Users, Save, Check, ChevronRight, ChevronLeft } from "lucide-react";

const STEPS = [
  { id: "nombre", label: "Identificación", icon: BedDouble, motivational: "Ponle nombre a tu habitación" },
  { id: "titularidad", label: "Titularidad", icon: Users, motivational: "¿Quién es el propietario?" },
  { id: "ubicacion", label: "Ubicación", icon: MapPin, motivational: "¿Dónde está?" },
  { id: "detalles", label: "Detalles", icon: BedDouble, motivational: "Características de la habitación" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

const HabitacionWizard = ({ open, onOpenChange, onSave }: Props) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [f, setF] = useState({ nombre_interno: "", superficie_m2: null as number | null, amueblada: false, bano_privado: false, tiene_ventana: true, tiene_armario: false, num_camas: 1 as number | null });
  const [addr, setAddr] = useState<AddressFields>({ tipo_via: "", direccion_completa: "", numero: "", numero_portal: "", planta: "", puerta: "", urbanizacion: "", municipio: "", provincia: "", comunidad_autonoma: "", codigo_postal: "" });
  const [titularidad, setTitularidad] = useState<TitularidadFields>(defaultTitularidadFields);

  useEffect(() => { if (!open) { setF({ nombre_interno: "", superficie_m2: null, amueblada: false, bano_privado: false, tiene_ventana: true, tiene_armario: false, num_camas: 1 }); setAddr({ tipo_via: "", direccion_completa: "", numero: "", numero_portal: "", planta: "", puerta: "", urbanizacion: "", municipio: "", provincia: "", comunidad_autonoma: "", codigo_postal: "" }); setTitularidad(defaultTitularidadFields); setStep(0); setValidationError(""); } }, [open]);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF(prev => ({ ...prev, [key]: value }));
  const setAddrField = <K extends keyof AddressFields>(key: K, value: string) => setAddr(prev => ({ ...prev, [key]: value }));
  const filledCount = [...Object.values(f), ...Object.values(addr)].filter(v => v !== "" && v !== null && v !== undefined && v !== false).length;
  const progressPercent = Math.round((filledCount / (Object.keys(f).length + Object.keys(addr).length)) * 100);

  const handleSave = async () => {
    if (!f.nombre_interno.trim()) { setStep(0); setValidationError("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      await onSave({
        nombre_interno: f.nombre_interno,
        direccion_completa: [addr.tipo_via, addr.direccion_completa, addr.numero].filter(Boolean).join(" ") || null,
        numero_portal: addr.numero_portal || null, planta: addr.planta || null, puerta: addr.puerta || null,
        urbanizacion: addr.urbanizacion || null, municipio: addr.municipio || null, provincia: addr.provincia || null,
        comunidad_autonoma: addr.comunidad_autonoma || null, codigo_postal: addr.codigo_postal || null,
        superficie_m2: f.superficie_m2, amueblada: f.amueblada, bano_privado: f.bano_privado,
        tiene_ventana: f.tiene_ventana, tiene_armario: f.tiene_armario, num_camas: f.num_camas,
        ...buildTitularidadSaveData(titularidad),
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const currentStep = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => { if (i <= step) setStep(i); }}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${i === step ? "bg-primary text-primary-foreground scale-110" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground font-medium">{progressPercent}%</div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <div className="px-6 pb-2 min-h-[280px]">
          <div className="flex items-center gap-2 mb-4">
            <currentStep.icon size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-foreground">{currentStep.label}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{currentStep.motivational}</p>
          {validationError && <p className="text-sm text-destructive mb-3 bg-destructive/10 rounded-lg px-3 py-2">{validationError}</p>}

          {step === 0 && (
            <div className="space-y-4">
              <TextField label="Nombre interno *" value={f.nombre_interno} onChange={v => set("nombre_interno", v)} placeholder="Habitación principal, Hab. doble..." />
            </div>
          )}
          {step === 1 && <TitularidadStep fields={titularidad} onChange={setTitularidad} />}
          {step === 2 && <InmuebleAddressStep fields={addr} onChange={setAddrField} />}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Superficie" value={f.superficie_m2} onChange={v => set("superficie_m2", v)} placeholder="m²" suffix="m²" />
                <NumberField label="Nº camas" value={f.num_camas} onChange={v => set("num_camas", v)} placeholder="1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SwitchField label="Amueblada" checked={f.amueblada} onChange={v => set("amueblada", v)} />
                <SwitchField label="Baño privado" checked={f.bano_privado} onChange={v => set("bano_privado", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SwitchField label="Tiene ventana" checked={f.tiene_ventana} onChange={v => set("tiene_ventana", v)} />
                <SwitchField label="Tiene armario" checked={f.tiene_armario} onChange={v => set("tiene_armario", v)} />
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl gap-1"><ChevronLeft size={16} /> Atrás</Button>}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button onClick={() => { if (step === 0 && !f.nombre_interno.trim()) { setValidationError("El nombre es obligatorio"); return; } setValidationError(""); setStep(step + 1); }} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1">Siguiente <ChevronRight size={16} /></Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1"><Save size={16} /> {saving ? "Guardando..." : "Guardar habitación"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HabitacionWizard;
