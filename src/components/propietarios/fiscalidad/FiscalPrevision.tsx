import { TrendingUp, TrendingDown, Euro, AlertTriangle } from "lucide-react";
import type { FiscalPropertySummary, FiscalTotals } from "@/hooks/useFiscalData";

interface FiscalPrevisionProps {
  anio: number;
  propertySummaries: FiscalPropertySummary[];
  totals: FiscalTotals;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FiscalPrevision = ({ anio, totals }: FiscalPrevisionProps) => {
  const mesActual = new Date().getMonth() + 1;
  const mesesRestantes = 12 - mesActual;
  const ingresosEstimados = mesActual > 0 ? (totals.ingresos / mesActual) * 12 : 0;
  const gastosEstimados = mesActual > 0 ? (totals.gastos / mesActual) * 12 : 0;
  const balanceEstimado = ingresosEstimados - gastosEstimados;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-foreground">Previsión {anio}</h3>
        <span className="text-xs text-muted-foreground">{mesesRestantes} meses restantes</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Estimación basada en los datos acumulados hasta ahora</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center py-3 px-2 rounded-xl bg-emerald-50">
          <TrendingUp size={16} className="text-emerald-700 mx-auto mb-1" />
          <p className="text-xs text-emerald-700 mb-0.5">Ingresos estimados</p>
          <p className="text-base font-bold text-emerald-800">{formatImporte(ingresosEstimados)}€</p>
        </div>
        <div className="text-center py-3 px-2 rounded-xl bg-red-50">
          <TrendingDown size={16} className="text-red-700 mx-auto mb-1" />
          <p className="text-xs text-red-700 mb-0.5">Gastos estimados</p>
          <p className="text-base font-bold text-red-800">{formatImporte(gastosEstimados)}€</p>
        </div>
        <div className={`text-center py-3 px-2 rounded-xl ${balanceEstimado >= 0 ? "bg-primary/5" : "bg-amber-50"}`}>
          <Euro size={16} className={`mx-auto mb-1 ${balanceEstimado >= 0 ? "text-primary" : "text-amber-700"}`} />
          <p className={`text-xs mb-0.5 ${balanceEstimado >= 0 ? "text-primary" : "text-amber-700"}`}>Balance previsto</p>
          <p className={`text-base font-bold ${balanceEstimado >= 0 ? "text-primary" : "text-amber-800"}`}>{formatImporte(balanceEstimado)}€</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        * Estimación orientativa sin validez fiscal. Consulta con tu gestor para datos definitivos.
      </p>
    </div>
  );
};

export default FiscalPrevision;
