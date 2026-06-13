import { Check } from "lucide-react";
import { ESTADOS_INCIDENCIA } from "@/hooks/useIncidencias";

const estadoColors: Record<string, string> = {
  "Abierta": "bg-red-500",
  "En revisión": "bg-amber-500",
  "Proveedor asignado": "bg-blue-500",
  "Pendiente de factura": "bg-indigo-500",
  "Cerrada": "bg-emerald-500",
};

interface Props {
  estado: string;
  onChangeEstado: (estado: string) => void;
}

const IncidenciaStatusBar = ({ estado, onChangeEstado }: Props) => {
  const currentIdx = ESTADOS_INCIDENCIA.indexOf(estado);

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto pb-1">
      {ESTADOS_INCIDENCIA.map((e, idx) => {
        const isActive = e === estado;
        const isPast = idx < currentIdx;

        return (
          <div key={e} className="flex items-center flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onChangeEstado(e)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all w-full justify-center whitespace-nowrap ${
                isActive
                  ? `${estadoColors[e]} text-white shadow-sm`
                  : isPast
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {isPast && <Check size={12} className="shrink-0" />}
              <span className="truncate">{e}</span>
            </button>
            {idx < ESTADOS_INCIDENCIA.length - 1 && (
              <div className={`h-px w-4 shrink-0 ${isPast ? "bg-foreground/20" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default IncidenciaStatusBar;
