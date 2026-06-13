import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, CheckCircle2, ArrowRight, Receipt } from "lucide-react";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos: Contrato[];
  /** Mismo handler que ya usa el panel para navegar al activo con pago pendiente */
  onIrACobrar: (propertyId: string) => void;
  /** Abre el flujo "He comprado" (registro rápido de gastos). */
  onHeComprado?: () => void;
  filterPropertyId?: string | null;
}

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

export default function HeCobradoCTA({ properties, inquilinos, pagos, contratos, onIrACobrar, onHeComprado, filterPropertyId }: Props) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  const { pendientes, totalPendiente, primerActivo } = useMemo(() => {
    const list: { propertyId: string; nombreActivo: string; inquilinos: string[]; importe: number }[] = [];
    let total = 0;
    const visibles = filterPropertyId ? properties.filter(x => x.id === filterPropertyId) : properties;
    for (const p of visibles) {
      const tenants = inquilinos.filter(i => i.property_id === p.id && i.rol_inquilino !== "avalista");
      if (tenants.length === 0) continue;
      const renta = resolveRentaEsperada(p.id, inquilinos, contratos, { mes, anio }) || 0;
      const pagosMes = pagos.filter(x => x.property_id === p.id && x.mes === mes && x.anio === anio && x.propietario_confirmado);
      const cobrado = pagosMes.reduce((s, x) => s + Number(x.importe_pagado || 0), 0);
      const pend = Math.max(0, renta - cobrado);
      if (pend > 0) {
        total += pend;
        list.push({
          propertyId: p.id,
          nombreActivo: (p as any).nombre_interno || (p as any).direccion || "Activo",
          inquilinos: tenants.map(t => t.nombre).filter(Boolean) as string[],
          importe: pend,
        });
      }
    }
    return { pendientes: list, totalPendiente: total, primerActivo: list[0]?.propertyId };
  }, [properties, inquilinos, pagos, contratos, mes, anio, filterPropertyId]);

  if (pendientes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4"
        style={{ background: "hsl(var(--accent-mint) / 0.12)", borderColor: "hsl(var(--accent-mint) / 0.4)" }}
      >
        <div className="flex items-center gap-4 flex-1">
          <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(var(--accent-mint) / 0.35)" }}>
            <CheckCircle2 className="text-emerald-700" size={24} />
          </span>
          <div>
            <div className="text-base md:text-lg font-bold text-emerald-900">Todo cobrado este mes</div>
            <div className="text-xs md:text-sm text-emerald-800/70 mt-0.5">No tienes pagos pendientes por confirmar.</div>
          </div>
        </div>
        {onHeComprado && (
          <button
            type="button"
            onClick={onHeComprado}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-xl bg-teal-600/15 text-teal-900 text-sm md:text-base font-semibold hover:bg-teal-600/25 active:scale-[0.98] transition-all border border-teal-700/20 w-full md:w-auto"
          >
            <Receipt size={18} />
            🧾 He comprado
          </button>
        )}
      </motion.div>
    );
  }

  const inquilinosLabel = pendientes
    .flatMap(p => p.inquilinos)
    .slice(0, 3)
    .join(", ");
  const extra = pendientes.flatMap(p => p.inquilinos).length - 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 md:p-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest uppercase text-primary/80 mb-1">Cobro mensual</div>
          <div className="text-lg md:text-xl font-bold text-foreground tracking-tight">
            Te quedan {fmt(totalPendiente)} € por cobrar
          </div>
          <div className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
            {inquilinosLabel}{extra > 0 ? ` y ${extra} más` : ""} · {pendientes.length} {pendientes.length === 1 ? "activo" : "activos"} pendientes
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => primerActivo && onIrACobrar(primerActivo)}
            className="group inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm md:text-base font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 w-full md:w-auto"
          >
            <Check size={18} strokeWidth={3} />
            He cobrado
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          {onHeComprado && (
            <button
              type="button"
              onClick={onHeComprado}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-xl bg-teal-600/15 text-teal-900 text-sm md:text-base font-semibold hover:bg-teal-600/25 active:scale-[0.98] transition-all border border-teal-700/20 w-full md:w-auto"
            >
              <Receipt size={18} />
              🧾 He comprado
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
