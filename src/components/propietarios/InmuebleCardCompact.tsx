import { BedDouble, Car, Archive, Briefcase, Store, Mountain, Building2 } from "lucide-react";

export interface OtroInmueble {
  id: string;
  tipo: string;
  nombre_interno: string;
  direccion_completa?: string | null;
  estado?: string | null;
}

const tipoConfig: Record<string, { label: string; icon: typeof BedDouble }> = {
  habitacion: { label: "Habitación", icon: BedDouble },
  garaje: { label: "Garaje", icon: Car },
  trastero: { label: "Trastero", icon: Archive },
  oficina: { label: "Oficina", icon: Briefcase },
  local_nave: { label: "Local/Nave", icon: Store },
  terreno: { label: "Terreno", icon: Mountain },
  edificio: { label: "Edificio", icon: Building2 },
};

const estadoConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  libre: { label: "Libre", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-800" },
  alquilado: { label: "Alquilado", dotClass: "bg-sky-500", badgeClass: "bg-sky-100 text-sky-800" },
  ocupado: { label: "Ocupado", dotClass: "bg-sky-500", badgeClass: "bg-sky-100 text-sky-800" },
  "en uso": { label: "En uso", dotClass: "bg-violet-500", badgeClass: "bg-violet-100 text-violet-800" },
};

interface InmuebleCardCompactProps {
  inmueble: OtroInmueble;
  onClick: () => void;
  isSelected?: boolean;
}

const InmuebleCardCompact = ({ inmueble, onClick, isSelected }: InmuebleCardCompactProps) => {
  const config = tipoConfig[inmueble.tipo] || tipoConfig.trastero;
  const estado = estadoConfig[inmueble.estado || "libre"] || estadoConfig.libre;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
          : "border-border bg-card shadow-sm hover:shadow-md hover:border-primary/20"
      }`}
    >
      {/* Icon tile */}
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
        isSelected ? "bg-primary/15 border-primary/20" : "bg-primary/[0.07] border-primary/10"
      }`}>
        <Icon size={22} strokeWidth={2.25} className="text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-foreground truncate mb-1">{inmueble.nombre_interno}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${estado.badgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${estado.dotClass}`} />
            {estado.label}
          </span>
          <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>
        {inmueble.direccion_completa && (
          <p className="text-xs text-muted-foreground truncate mt-2.5 pt-2 border-t border-border/40">{inmueble.direccion_completa}</p>
        )}
      </div>
    </button>
  );
};

export default InmuebleCardCompact;
