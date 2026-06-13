import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TextField, NumberField, SwitchField } from "../propietarios/FormFields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import InmuebleAddressStep, { type AddressFields } from "./InmuebleAddressStep";
import TitularidadStep, { type TitularidadFields, defaultTitularidadFields, buildTitularidadSaveData, parseTitularidadFromRow } from "./TitularidadStep";

export interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "switch" | "select" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  suffix?: string;
  group?: string;
}

interface InmuebleDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Record<string, any> | null;
  tipoLabel: string;
  fields: FieldConfig[];
  onSave: (id: string, data: Record<string, any>) => Promise<void>;
}

const InmuebleDetailSheet = ({ open, onOpenChange, item, tipoLabel, fields, onSave }: InmuebleDetailSheetProps) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [addr, setAddr] = useState<AddressFields>({
    tipo_via: "", direccion_completa: "", numero: "", numero_portal: "",
    planta: "", puerta: "", urbanizacion: "", municipio: "", provincia: "",
    comunidad_autonoma: "", codigo_postal: "",
  });
  const [titularidad, setTitularidad] = useState<TitularidadFields>(defaultTitularidadFields);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
      setAddr({
        tipo_via: item.tipo_via || "",
        direccion_completa: item.direccion_completa || "",
        numero: "",
        numero_portal: item.numero_portal || "",
        planta: item.planta || "",
        puerta: item.puerta || "",
        urbanizacion: item.urbanizacion || "",
        municipio: item.municipio || "",
        provincia: item.provincia || "",
        comunidad_autonoma: item.comunidad_autonoma || "",
        codigo_postal: item.codigo_postal || "",
      });
      setTitularidad(parseTitularidadFromRow(item as any));
    }
  }, [item]);

  const set = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));
  const setAddrField = <K extends keyof AddressFields>(key: K, value: string) => setAddr(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const saveData: Record<string, any> = {};
      for (const f of fields) {
        if (formData[f.key] !== undefined) saveData[f.key] = formData[f.key];
      }
      // Include address fields
      saveData.tipo_via = addr.tipo_via || null;
      saveData.direccion_completa = [addr.tipo_via, addr.direccion_completa, addr.numero].filter(Boolean).join(" ") || null;
      saveData.numero_portal = addr.numero_portal || null;
      saveData.planta = addr.planta || null;
      saveData.puerta = addr.puerta || null;
      saveData.urbanizacion = addr.urbanizacion || null;
      saveData.municipio = addr.municipio || null;
      saveData.provincia = addr.provincia || null;
      saveData.comunidad_autonoma = addr.comunidad_autonoma || null;
      saveData.codigo_postal = addr.codigo_postal || null;
      saveData.nombre_interno = formData.nombre_interno;

      // Include titularidad fields
      Object.assign(saveData, buildTitularidadSaveData(titularidad));

      await onSave(item.id, saveData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Group fields
  const groups = new Map<string, FieldConfig[]>();
  for (const f of fields) {
    const g = f.group || "Detalles";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar {tipoLabel}: {item?.nombre_interno}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Name */}
          <TextField label="Nombre interno *" value={formData.nombre_interno || ""} onChange={v => set("nombre_interno", v)} placeholder="Nombre identificativo" />

          {/* Titularidad */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Titularidad y propiedad</h4>
            <TitularidadStep fields={titularidad} onChange={setTitularidad} />
          </div>

          {/* Address */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Ubicación</h4>
            <InmuebleAddressStep fields={addr} onChange={setAddrField} />
          </div>

          {/* Grouped fields */}
          {Array.from(groups.entries()).map(([groupName, groupFields]) => (
            <div key={groupName}>
              <h4 className="text-sm font-semibold text-foreground mb-3">{groupName}</h4>
              <div className="space-y-3">
                {groupFields.map(f => {
                  if (f.type === "text") return <TextField key={f.key} label={f.label} value={formData[f.key] || ""} onChange={v => set(f.key, v)} placeholder={f.placeholder} />;
                  if (f.type === "number") return <NumberField key={f.key} label={f.label} value={formData[f.key] ?? null} onChange={v => set(f.key, v)} placeholder={f.placeholder} suffix={f.suffix} />;
                  if (f.type === "switch") return <SwitchField key={f.key} label={f.label} checked={!!formData[f.key]} onChange={v => set(f.key, v)} />;
                  if (f.type === "select" && f.options) return (
                    <div key={f.key}>
                      <Label className="text-sm">{f.label}</Label>
                      <Select value={formData[f.key] || ""} onValueChange={v => set(f.key, v)}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                        <SelectContent>
                          {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                  if (f.type === "textarea") return (
                    <div key={f.key}>
                      <Label className="text-sm">{f.label}</Label>
                      <Textarea className="mt-1" value={formData[f.key] || ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3} />
                    </div>
                  );
                  return null;
                })}
              </div>
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gap-2">
            <Save size={16} /> {saving ? "Guardando..." : `Guardar ${tipoLabel.toLowerCase()}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InmuebleDetailSheet;
