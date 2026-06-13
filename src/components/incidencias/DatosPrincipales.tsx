import { ClipboardList, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionCard, { FormRow } from "./SectionCard";
import { ESTADOS_INCIDENCIA, RESPONSABLES_PAGO, PRIORIDADES } from "@/hooks/useIncidencias";
import { getContactForRole } from "@/lib/incidenciaAutoFill";
import { useProfile } from "@/hooks/useProfile";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  properties: Property[];
  inquilinos?: Inquilino[];
}

const DatosPrincipales = ({ data, onChange, properties, inquilinos = [] }: Props) => {
  const { profile } = useProfile();

  const selectedProperty = properties.find(p => p.id === data.property_id) || null;
  const propertyInquilino = inquilinos.find(
    i => i.property_id === data.property_id && i.rol_inquilino !== "avalista"
  ) || null;

  const handlePropertyChange = (propertyId: string) => {
    onChange("property_id", propertyId);
    const prop = properties.find(p => p.id === propertyId);
    if (prop) onChange("direccion", prop.direccion_completa || "");
    // Set inquilino_id when property changes
    const inq = inquilinos.find(i => i.property_id === propertyId && i.rol_inquilino !== "avalista");
    onChange("inquilino_id", inq?.id || null);
  };

  const handleResponsableChange = (value: string) => {
    onChange("responsable_pago", value);
    const contact = getContactForRole(value, selectedProperty, propertyInquilino, profile);
    onChange("responsable_nombre", contact.nombre);
    onChange("responsable_telefono", contact.telefono);
  };

  return (
    <SectionCard title="Datos principales" icon={ClipboardList}>
      <FormRow label="Nº Incidencia">
        <Input value={data.numero_incidencia || "Auto"} disabled className="bg-muted/50 max-w-[120px]" />
      </FormRow>
      <FormRow label="Fecha alta">
        <Input
          value={data.created_at ? new Date(data.created_at).toLocaleDateString("es-ES") : new Date().toLocaleDateString("es-ES")}
          disabled className="bg-muted/50 max-w-[160px]"
        />
      </FormRow>
      <FormRow label="Última actualización">
        <Input
          value={data.updated_at ? new Date(data.updated_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—"}
          disabled className="bg-muted/50 max-w-[200px]"
        />
      </FormRow>
      <FormRow label="Inmueble">
        <Select value={data.property_id || ""} onValueChange={handlePropertyChange}>
          <SelectTrigger><SelectValue placeholder="Seleccionar inmueble" /></SelectTrigger>
          <SelectContent>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow label="Dirección">
        <Input value={data.direccion || ""} onChange={e => onChange("direccion", e.target.value)} placeholder="Dirección completa" />
      </FormRow>
      <FormRow label="Fecha/hora incidencia">
        <div className="flex items-center gap-2">
          <Input
            type="datetime-local"
            value={data.fecha_hora_incidencia?.slice(0, 16) || ""}
            onChange={e => onChange("fecha_hora_incidencia", e.target.value)}
            className="max-w-[240px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 px-2 gap-1 shrink-0"
            onClick={() => {
              const now = new Date();
              const pad = (n: number) => String(n).padStart(2, "0");
              const val = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
              onChange("fecha_hora_incidencia", val);
            }}
          >
            <Clock size={12} /> Ahora
          </Button>
        </div>
      </FormRow>
      <FormRow label="Asunto">
        <Textarea value={data.concepto || ""} onChange={e => onChange("concepto", e.target.value)} placeholder="Descripción breve de la incidencia" rows={3} />
      </FormRow>
      {data.estado !== "Cerrada" && (
        <FormRow label="Prioridad">
          <div className="flex gap-2 flex-wrap">
            {PRIORIDADES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange("prioridad", p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  data.prioridad === p.value
                    ? `${p.color} ring-2 ring-offset-1 ring-primary/30`
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FormRow>
      )}
      <FormRow label="Estado">
        <Select value={data.estado || "Abierta"} onValueChange={v => {
          onChange("estado", v);
          if (v === "Cerrada") onChange("prioridad", null);
        }}>
          <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESTADOS_INCIDENCIA.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow label="Responsable de pago">
        <Select value={data.responsable_pago || ""} onValueChange={handleResponsableChange}>
          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            {RESPONSABLES_PAGO.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormRow>
      <FormRow label="Nombre del responsable">
        <Input value={data.responsable_nombre || ""} onChange={e => onChange("responsable_nombre", e.target.value)} placeholder="Nombre del responsable de pago" />
      </FormRow>
      <FormRow label="Teléfono del responsable">
        <Input value={data.responsable_telefono || ""} onChange={e => onChange("responsable_telefono", e.target.value)} placeholder="Teléfono" className="max-w-[200px]" />
      </FormRow>
      <FormRow label="Referencia interna">
        <Input value={data.referencia_interna || ""} onChange={e => onChange("referencia_interna", e.target.value)} placeholder="Ref. interna" className="max-w-[200px]" />
      </FormRow>
    </SectionCard>
  );
};

export default DatosPrincipales;
