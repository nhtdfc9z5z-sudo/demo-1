import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Home, Warehouse, Car, Package, Building2, Building, Trees, BedDouble,
  Briefcase, Ship, Caravan, Palmtree, PartyPopper,
} from "lucide-react";
import type { TipoActivo } from "@/lib/altas/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tipo: TipoActivo) => void;
  /**
   * Si true, incluye `vivienda` como primera tarjeta y cambia el título
   * para reflejar que cubre TODOS los tipos de inmueble (no solo
   * "otros"). Usado por la intención unificada `activo`.
   */
  incluirVivienda?: boolean;
}

interface TipoCard {
  tipo: TipoActivo;
  label: string;
  icon: typeof Warehouse;
}

const PRINCIPALES_BASE: TipoCard[] = [
  { tipo: "garaje", label: "Garaje", icon: Car },
  { tipo: "trastero", label: "Trastero", icon: Package },
  { tipo: "local", label: "Local", icon: Briefcase },
  { tipo: "habitacion", label: "Habitación", icon: BedDouble },
  { tipo: "oficina", label: "Oficina", icon: Building2 },
  { tipo: "nave", label: "Nave", icon: Warehouse },
  { tipo: "terreno", label: "Terreno", icon: Trees },
  { tipo: "edificio", label: "Edificio", icon: Building },
];

const VIVIENDA_CARD: TipoCard = { tipo: "vivienda", label: "Vivienda", icon: Home };

const EXOTICOS: TipoCard[] = [
  { tipo: "barco", label: "Barco", icon: Ship },
  { tipo: "caravana_camper", label: "Caravana / camper", icon: Caravan },
  { tipo: "vacacional", label: "Vivienda vacacional", icon: Palmtree },
  { tipo: "finca_eventos", label: "Finca para eventos", icon: PartyPopper },
];

const Tile = ({ tipo, label, icon: Icon, onSelect }: TipoCard & { onSelect: (t: TipoActivo) => void }) => (
  <button
    type="button"
    onClick={() => onSelect(tipo)}
    className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-3 min-h-[88px] flex flex-col items-start gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
  >
    <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
      <Icon size={20} />
    </span>
    <span className="text-sm font-medium text-foreground">{label}</span>
  </button>
);

/**
 * Sub-picker mostrado tras elegir "Garaje, trastero o local" en el picker
 * principal. Lista los tipos no residenciales más comunes y, debajo, los
 * exóticos (barco, caravana, finca de eventos, vacacional).
 */
const OtroActivoTipoPicker = ({ open, onOpenChange, onSelect, incluirVivienda = false }: Props) => {
  const PRINCIPALES: TipoCard[] = incluirVivienda
    ? [VIVIENDA_CARD, ...PRINCIPALES_BASE]
    : PRINCIPALES_BASE;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-semibold text-foreground">
            {incluirVivienda ? "¿Qué tipo de inmueble?" : "¿Qué tipo de activo?"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Elige el tipo más cercano. Después podrás añadir todos los detalles.</p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Más comunes</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRINCIPALES.map((c) => <Tile key={c.tipo} {...c} onSelect={onSelect} />)}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">Otros</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {EXOTICOS.map((c) => <Tile key={c.tipo} {...c} onSelect={onSelect} />)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtroActivoTipoPicker;