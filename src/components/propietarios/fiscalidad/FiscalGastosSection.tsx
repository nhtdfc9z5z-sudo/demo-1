import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GastoGroup {
  key: string;
  label: string;
  total: number;
  items: { concepto: string; importe: number; propertyName: string; recurrente: boolean }[];
}

interface FiscalGastosSectionProps {
  gastosAgrupados: GastoGroup[];
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FiscalGastosSection = ({ gastosAgrupados }: FiscalGastosSectionProps) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (gastosAgrupados.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">No se han detectado gastos para este año</p>
      </div>
    );
  }

  const totalGastos = gastosAgrupados.reduce((s, g) => s + g.total, 0);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Gastos por categoría</h3>
        <span className="text-sm font-semibold text-muted-foreground">{formatImporte(totalGastos)}€</span>
      </div>

      <div className="space-y-2">
        {gastosAgrupados.map(group => {
          const isExpanded = expandedGroup === group.key;
          const pct = totalGastos > 0 ? (group.total / totalGastos) * 100 : 0;

          return (
            <div key={group.key}>
              <button
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{group.label}</span>
                    <span className="text-sm font-semibold text-foreground">{formatImporte(group.total)}€</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="ml-4 mr-4 mb-2 space-y-1.5">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-2 px-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{item.concepto}</span>
                        <span className="text-muted-foreground">· {item.propertyName}</span>
                        {item.recurrente && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-0.5">
                            <RefreshCw size={8} />
                            Recurrente
                          </Badge>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">{formatImporte(item.importe)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FiscalGastosSection;
