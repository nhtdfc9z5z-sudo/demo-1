import { MapPin, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import SectionCard, { FormRow } from "./SectionCard";
import { RESPONSABLES_PAGO } from "@/hooks/useIncidencias";

interface Props {
  variant: "origen" | "afectado";
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  copyActions: { label: string; onClick: () => void }[];
}

const OrigenAfectadosSection = ({ variant, data, onChange, copyActions }: Props) => {
  const prefix = variant;
  const personLabel = variant === "origen" ? "Responsable" : "Damnificado";
  const title = variant === "origen" ? "Origen" : "Afectados";

  const nameField = variant === "origen" ? `${prefix}_nombre_responsable` : `${prefix}_nombre`;
  const phoneField = variant === "origen" ? `${prefix}_telefono_responsable` : `${prefix}_telefono`;

  return (
    <SectionCard title={title} icon={MapPin}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {copyActions.map(a => (
          <Button key={a.label} variant="outline" size="sm" className="text-xs gap-1.5" onClick={a.onClick}>
            <Copy size={13} /> {a.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Datos generales</p>
          <FormRow label={variant === "origen" ? "Dirección del causante de la incidencia" : "Domicilio"}>
            <Input value={data[`${prefix}_domicilio`] || ""} onChange={e => onChange(`${prefix}_domicilio`, e.target.value)} />
          </FormRow>
          <FormRow label={variant === "origen" ? "Ubicación dentro del inmueble" : "Lugar"}>
            <Input value={data[`${prefix}_lugar`] || ""} onChange={e => onChange(`${prefix}_lugar`, e.target.value)} />
          </FormRow>
          <FormRow label={personLabel}>
            <Select value={data[`${prefix}_responsable`] || ""} onValueChange={v => onChange(`${prefix}_responsable`, v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {RESPONSABLES_PAGO.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label={`Nombre del ${personLabel.toLowerCase()}`}>
            <Input value={data[nameField] || ""} onChange={e => onChange(nameField, e.target.value)} />
          </FormRow>
          <FormRow label={`Teléfono del ${personLabel.toLowerCase()}`}>
            <Input value={data[phoneField] || ""} onChange={e => onChange(phoneField, e.target.value)} />
          </FormRow>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Seguro</p>
          <FormRow label="Nombre">
            <Input value={data[`${prefix}_seguro_nombre`] || ""} onChange={e => onChange(`${prefix}_seguro_nombre`, e.target.value)} />
          </FormRow>
          <FormRow label="Póliza">
            <Input value={data[`${prefix}_seguro_poliza`] || ""} onChange={e => onChange(`${prefix}_seguro_poliza`, e.target.value)} />
          </FormRow>
          <FormRow label="Ref. siniestro">
            <Input value={data[`${prefix}_seguro_ref_siniestro`] || ""} onChange={e => onChange(`${prefix}_seguro_ref_siniestro`, e.target.value)} />
          </FormRow>
          <FormRow label="Teléfono">
            <Input value={data[`${prefix}_seguro_telefono`] || ""} onChange={e => onChange(`${prefix}_seguro_telefono`, e.target.value)} />
          </FormRow>
          <FormRow label="Email">
            <Input value={data[`${prefix}_seguro_email`] || ""} onChange={e => onChange(`${prefix}_seguro_email`, e.target.value)} />
          </FormRow>
          <FormRow label="Observaciones">
            <Textarea value={data[`${prefix}_seguro_observaciones`] || ""} onChange={e => onChange(`${prefix}_seguro_observaciones`, e.target.value)} rows={2} />
          </FormRow>
        </div>
      </div>
    </SectionCard>
  );
};

export default OrigenAfectadosSection;
