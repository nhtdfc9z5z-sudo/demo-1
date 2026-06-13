import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Property } from "@/hooks/useProperties";

interface Props {
  properties: Property[];
  value: string | null;
  onChange: (id: string | null) => void;
}

const ALL = "__all__";

export default function DashboardFiltroActivo({ properties, value, onChange }: Props) {
  if (properties.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
        <Filter size={12} /> Filtrar
      </span>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? null : v)}
      >
        <SelectTrigger className="h-9 min-w-[200px] text-sm">
          <SelectValue placeholder="Todos los activos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los activos</SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre_interno || (p as any).direccion || "Activo"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="h-9 px-2"
          aria-label="Limpiar filtro"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}