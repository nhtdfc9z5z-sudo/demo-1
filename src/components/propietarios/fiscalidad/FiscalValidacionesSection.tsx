import { AlertTriangle, Clock, Info, CheckCircle2, ExternalLink } from "lucide-react";
import type { FiscalValidation, FiscalNavigationTarget } from "@/hooks/useFiscalData";

interface FiscalValidacionesSectionProps {
  validations: FiscalValidation[];
  onNavigate?: (target: FiscalNavigationTarget) => void;
}

const iconMap = {
  error: <AlertTriangle size={14} className="text-destructive" />,
  warning: <Clock size={14} className="text-amber-600" />,
  info: <Info size={14} className="text-sky-600" />,
};

const bgMap = {
  error: "bg-destructive/5 border-destructive/20",
  warning: "bg-amber-50 border-amber-200",
  info: "bg-sky-50 border-sky-200",
};

const FiscalValidacionesSection = ({ validations, onNavigate }: FiscalValidacionesSectionProps) => {
  if (validations.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 size={18} />
          <h3 className="text-base font-semibold">Todo en orden</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">No se han detectado datos pendientes ni incoherencias</p>
      </div>
    );
  }

  const grouped = {
    error: validations.filter(v => v.tipo === "error"),
    warning: validations.filter(v => v.tipo === "warning"),
    info: validations.filter(v => v.tipo === "info"),
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-1">Revisión automática</h3>
      <p className="text-xs text-muted-foreground mb-4">Estos son los datos que conviene revisar antes de enviar</p>

      <div className="space-y-2">
        {(["error", "warning", "info"] as const).map(tipo => (
          grouped[tipo].map((v, idx) => {
            const isClickable = !!v.navigateTo && !!onNavigate;
            const Wrapper = isClickable ? "button" : "div";

            return (
              <Wrapper
                key={`${tipo}-${idx}`}
                className={`flex items-center gap-2.5 text-sm py-2.5 px-3.5 rounded-xl border ${bgMap[tipo]} w-full text-left ${isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                {...(isClickable ? { onClick: () => onNavigate!(v.navigateTo!) } : {})}
              >
                <span className="mt-0.5 shrink-0">{iconMap[tipo]}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">{v.mensaje}</span>
                  {v.propertyName && <span className="text-muted-foreground"> · {v.propertyName}</span>}
                </div>
                {isClickable && (
                  <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                )}
              </Wrapper>
            );
          })
        ))}
      </div>
    </div>
  );
};

export default FiscalValidacionesSection;
