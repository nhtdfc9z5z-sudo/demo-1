import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Inquilino } from "@/hooks/useInquilinos";

interface PendingPaymentsBannerProps {
  pagosPendientes: PagoRenta[];
  inquilinos: Inquilino[];
  onClickPago?: (pago: PagoRenta) => void;
}

const PendingPaymentsBanner = ({ pagosPendientes, inquilinos, onClickPago }: PendingPaymentsBannerProps) => {
  if (pagosPendientes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4 space-y-2"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
          <span className="text-lg">🔔</span>
        </div>
        <p className="text-sm font-medium text-foreground">
          {pagosPendientes.length === 1
            ? "Tienes 1 pago pendiente de confirmar"
            : `Tienes ${pagosPendientes.length} pagos pendientes de confirmar`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pl-11">
        {pagosPendientes.map(p => {
          const inq = inquilinos.find(i => i.id === p.inquilino_id);
          const mes = new Date(2000, p.mes - 1).toLocaleString("es-ES", { month: "long" });
          return (
            <button
              key={p.id}
              onClick={() => onClickPago?.(p)}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors cursor-pointer"
            >
              {inq?.nombre || "Inquilino"} — {mes} {p.anio}
              <ChevronRight size={12} />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PendingPaymentsBanner;
