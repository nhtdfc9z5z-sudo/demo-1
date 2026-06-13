import { User, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SectionCard, { FormRow } from "./SectionCard";
import type { Inquilino } from "@/hooks/useInquilinos";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  inquilinos: Inquilino[];
}

const InquilinoIncidenciaSection = ({ data, onChange, inquilinos }: Props) => {
  const { toast } = useToast();

  const loadInquilino = () => {
    if (!data.property_id) {
      toast({ title: "Selecciona una propiedad", description: "Primero debes seleccionar una propiedad.", variant: "destructive" });
      return;
    }

    // Find inquilinos for this property (exclude avalistas)
    const propertyInqs = inquilinos.filter(
      i => i.property_id === data.property_id && i.rol_inquilino !== "avalista"
    );

    if (propertyInqs.length === 0) {
      toast({ title: "Sin inquilino", description: "No hay inquilinos asociados a esta propiedad.", variant: "destructive" });
      return;
    }

    const inq = propertyInqs[0];
    onChange("inquilino_id", inq.id);
    onChange("inquilino_nombre", `${inq.nombre} ${inq.apellidos || ""}`.trim());
    onChange("inquilino_telefono", inq.telefono || "");
    onChange("inquilino_email", inq.email || "");
    toast({ title: "Datos cargados", description: `Inquilino: ${inq.nombre} ${inq.apellidos || ""}`.trim() });
  };

  return (
    <SectionCard title="Inquilino" icon={User}>
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={loadInquilino} disabled={!data.property_id}>
          <Download size={13} /> Cargar datos del inquilino
        </Button>
      </div>
      <FormRow label="Nombre">
        <Input value={data.inquilino_nombre || ""} onChange={e => onChange("inquilino_nombre", e.target.value)} />
      </FormRow>
      <FormRow label="Teléfono">
        <Input value={data.inquilino_telefono || ""} onChange={e => onChange("inquilino_telefono", e.target.value)} />
      </FormRow>
      <FormRow label="Correo electrónico">
        <Input value={data.inquilino_email || ""} onChange={e => onChange("inquilino_email", e.target.value)} />
      </FormRow>
      <FormRow label="Preferencias contacto">
        <div className="flex gap-4 flex-wrap pt-2">
          {[
            { field: "inquilino_contacto_whatsapp", label: "WhatsApp" },
            { field: "inquilino_contacto_llamada", label: "Llamada" },
            { field: "inquilino_contacto_email", label: "Correo electrónico" },
          ].map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!data[field]} onCheckedChange={v => onChange(field, v)} />
              {label}
            </label>
          ))}
        </div>
      </FormRow>
      <FormRow label="Observaciones">
        <Textarea value={data.inquilino_observaciones || ""} onChange={e => onChange("inquilino_observaciones", e.target.value)} rows={2} />
      </FormRow>
    </SectionCard>
  );
};

export default InquilinoIncidenciaSection;
