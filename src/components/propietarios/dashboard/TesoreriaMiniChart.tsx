import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import GraficaAnual from "../GraficaAnual";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos: Contrato[];
  incidencias: Incidencia[];
  filterPropertyId?: string | null;
  filterPropertyName?: string | null;
}

export default function TesoreriaMiniChart({ properties, inquilinos, pagos, contratos, incidencias, filterPropertyId, filterPropertyName }: Props) {
  if (!properties.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="rounded-2xl border border-border/60 bg-gradient-to-b from-primary/[0.03] to-card p-5 md:p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp size={16} />
          </span>
          <div>
            <h3 className="text-sm md:text-base font-semibold text-foreground">Tesorería neta</h3>
            <p className="text-[11px] text-muted-foreground">Ingresos vs gastos de los últimos meses</p>
            {filterPropertyId && filterPropertyName && (
              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold tracking-wide">
                {filterPropertyName}
              </span>
            )}
          </div>
        </div>
      </div>
      <GraficaAnual
        properties={properties}
        inquilinos={inquilinos}
        pagos={pagos}
        contratos={contratos}
        incidencias={incidencias}
        filterPropertyId={filterPropertyId ?? undefined}
        title=""
        incluirHistoricos
      />
    </motion.div>
  );
}
