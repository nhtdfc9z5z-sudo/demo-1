import { Calendar, Phone } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionCard, { FormRow } from "./SectionCard";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

const DisponibilidadSection = ({ data, onChange }: Props) => {
  const dias: string[] = data.disponibilidad_dias || [];
  const toggleDia = (d: string) => {
    onChange("disponibilidad_dias", dias.includes(d) ? dias.filter((x: string) => x !== d) : [...dias, d]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <SectionCard title="Disponibilidad del inquilino" icon={Calendar}>
        <FormRow label="Parte del día">
          <Select value={data.disponibilidad_parte_dia || ""} onValueChange={v => onChange("disponibilidad_parte_dia", v)}>
            <SelectTrigger className="max-w-[200px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mañana">Mañana</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
              <SelectItem value="indiferente">Indiferente</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <FormRow label="Días disponibles">
          <div className="flex gap-1.5 flex-wrap pt-1">
            {DIAS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDia(d)}
                className={`w-9 h-9 rounded-lg text-xs font-medium border transition-colors ${
                  dias.includes(d)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Comentarios">
          <Textarea value={data.disponibilidad_comentarios || ""} onChange={e => onChange("disponibilidad_comentarios", e.target.value)} rows={2} />
        </FormRow>
      </SectionCard>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm h-fit">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={16} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Contacto rápido</span>
        </div>
        <p className="text-sm font-medium text-foreground">{data.inquilino_nombre || "—"}</p>
        <p className="text-sm text-muted-foreground mt-1">{data.inquilino_telefono || "—"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{data.inquilino_email || "—"}</p>
      </div>
    </div>
  );
};

export default DisponibilidadSection;
