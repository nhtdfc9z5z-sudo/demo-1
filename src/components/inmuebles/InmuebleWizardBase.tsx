import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextField, NumberField, SwitchField } from "../propietarios/FormFields";
import InmuebleAddressStep, { type AddressFields } from "./InmuebleAddressStep";
import { Home, MapPin, Save, Check, ChevronRight, ChevronLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  tipoInmueble: string;
  tipoLabel: string;
  tipoIcon: React.ReactNode;
  steps: { id: string; label: string; icon: React.ElementType; motivational: string }[];
  renderStep: (step: number, fields: any, set: (key: string, value: any) => void) => React.ReactNode;
  initialFields: Record<string, any>;
  buildSaveData: (fields: any, addr: AddressFields) => Record<string, unknown>;
}

const InmuebleWizardBase = ({ open, onOpenChange, onSave, tipoLabel, steps, renderStep, initialFields, buildSaveData }: Props) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [f, setF] = useState(initialFields);
  const [addr, setAddr] = useState<AddressFields>({
    tipo_via: "", direccion_completa: "", numero: "", numero_portal: "",
    planta: "", puerta: "", urbanizacion: "", municipio: "", provincia: "",
    comunidad_autonoma: "", codigo_postal: "",
  });

  useEffect(() => {
    if (!open) {
      setF(initialFields);
      setAddr({ tipo_via: "", direccion_completa: "", numero: "", numero_portal: "", planta: "", puerta: "", urbanizacion: "", municipio: "", provincia: "", comunidad_autonoma: "", codigo_postal: "" });
      setStep(0);
      setValidationError("");
    }
  }, [open]);

  const set = (key: string, value: any) => setF((prev: any) => ({ ...prev, [key]: value }));
  const setAddrField = <K extends keyof AddressFields>(key: K, value: string) => setAddr(prev => ({ ...prev, [key]: value }));

  const filledCount = [...Object.values(f), ...Object.values(addr)].filter(v => v !== "" && v !== null && v !== undefined && v !== false).length;
  const totalCount = Object.keys(f).length + Object.keys(addr).length;
  const progressPercent = Math.round((filledCount / totalCount) * 100);

  const validateStep = () => {
    if (step === 0 && !(f as any).nombre_interno?.trim()) {
      setValidationError(`Dale un nombre a tu ${tipoLabel.toLowerCase()}`);
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleNext = () => { if (validateStep() && step < steps.length - 1) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleSave = async () => {
    if (!(f as any).nombre_interno?.trim()) { setStep(0); setValidationError("El nombre es obligatorio."); return; }
    setSaving(true);
    try {
      await onSave(buildSaveData(f, addr));
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <button key={s.id} onClick={() => { if (i < step || validateStep()) setStep(i); }}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                  i === step ? "bg-primary text-primary-foreground scale-110" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>{i < step ? <Check size={14} /> : i + 1}</button>
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
          {renderStep(step, f, set)}
          {/* Address step is always step 1 */}
        </div>

        <div className="px-6 pb-6 flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={handleBack} className="rounded-xl gap-1"><ChevronLeft size={16} /> Atrás</Button>
          )}
          <div className="flex-1" />
          {step < steps.length - 1 ? (
            <Button onClick={handleNext} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
              Siguiente <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
              <Save size={16} /> {saving ? "Guardando..." : `Guardar ${tipoLabel.toLowerCase()}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InmuebleWizardBase;
export { InmuebleAddressStep };
export type { AddressFields };
