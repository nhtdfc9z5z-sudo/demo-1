import { Download, Calendar, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Inquilino } from "@/hooks/useInquilinos";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  inquilinos: Inquilino[];
}

const InquilinoTab = ({ data, onChange, inquilinos }: Props) => {
  const { toast } = useToast();
  const dias: string[] = data.disponibilidad_dias || [];

  const loadInquilino = () => {
    if (!data.property_id) {
      toast({ title: "Selecciona una propiedad", variant: "destructive" });
      return;
    }
    const propertyInqs = inquilinos.filter(
      i => i.property_id === data.property_id && i.rol_inquilino !== "avalista"
    );
    if (propertyInqs.length === 0) {
      toast({ title: "Sin inquilino", description: "No hay inquilinos asociados a esta propiedad.", variant: "destructive" });
      return;
    }
    const inq = propertyInqs[0];
    onChange("inquilino_nombre", `${inq.nombre} ${inq.apellidos || ""}`.trim());
    onChange("inquilino_telefono", inq.telefono || "");
    onChange("inquilino_email", inq.email || "");
    toast({ title: "Datos cargados", description: `Inquilino: ${inq.nombre}` });
  };

  const toggleDia = (d: string) => {
    onChange("disponibilidad_dias", dias.includes(d) ? dias.filter(x => x !== d) : [...dias, d]);
  };

  return (
    <div className="space-y-6">
      {/* Datos del inquilino */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User size={16} className="text-primary" /> Datos del inquilino
          </h4>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={loadInquilino}>
            <Download size={13} /> Cargar datos
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Nombre</label>
            <Input value={data.inquilino_nombre || ""} onChange={e => onChange("inquilino_nombre", e.target.value)} placeholder="Ej: Juan García" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Teléfono</label>
            <Input value={data.inquilino_telefono || ""} onChange={e => onChange("inquilino_telefono", e.target.value)} placeholder="Ej: 612 345 678" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input value={data.inquilino_email || ""} onChange={e => onChange("inquilino_email", e.target.value)} placeholder="Ej: inquilino@email.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Preferencias de contacto</label>
            <div className="flex gap-4 flex-wrap pt-2">
              {[
                { field: "inquilino_contacto_whatsapp", label: "WhatsApp" },
                { field: "inquilino_contacto_llamada", label: "Llamada" },
                { field: "inquilino_contacto_email", label: "Email" },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!data[field]} onCheckedChange={v => onChange(field, v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Disponibilidad */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-primary" /> Disponibilidad del inquilino
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Parte del día</label>
            <Select value={data.disponibilidad_parte_dia || ""} onValueChange={v => onChange("disponibilidad_parte_dia", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mañana">Mañana</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="indiferente">Indiferente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Días disponibles</label>
            <div className="flex gap-1.5">
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
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Comentarios de acceso</label>
            <Textarea value={data.disponibilidad_comentarios || ""} onChange={e => onChange("disponibilidad_comentarios", e.target.value)} rows={2} placeholder="Ej: La llave está con el portero, llamar antes de ir..." />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InquilinoTab;
