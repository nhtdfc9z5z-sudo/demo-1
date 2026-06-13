import { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, TrendingUp, AlertCircle, Wallet } from "lucide-react";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { useAllRentaActualizaciones } from "@/hooks/useAllRentaActualizaciones";
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
}

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

export default function KpiHeroRow({ properties, inquilinos, pagos, contratos, incidencias, filterPropertyId }: Props) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  const { byProperty } = useAllRentaActualizaciones();

  const data = useMemo(() => {
    let esperado = 0;
    let cobrado = 0;
    let rentAnualBruta = 0;
    let valorBase = 0;

    const visibles = filterPropertyId ? properties.filter(x => x.id === filterPropertyId) : properties;
    for (const p of visibles) {
      const renta = resolveRentaEsperada(p.id, inquilinos, contratos, {
        actualizaciones: byProperty.get(p.id),
        mes, anio,
      }) || 0;
      const tenants = inquilinos.filter(i => i.property_id === p.id && i.rol_inquilino !== "avalista");
      if (tenants.length > 0) esperado += renta;

      const pagosMes = pagos.filter(x => x.property_id === p.id && x.mes === mes && x.anio === anio && Number(x.importe_pagado || 0) > 0);
      cobrado += pagosMes.reduce((s, x) => s + Number(x.importe_pagado || 0), 0);

      const valor = (p as any).valor_mercado_manual ?? (p as any).valor_estimado ?? 0;
      if (valor > 0) {
        valorBase += valor;
        if (renta > 0 && tenants.length > 0) rentAnualBruta += renta * 12;
      }
    }

    const valorTotal = visibles.reduce(
      (s, p) => s + ((p as any).valor_mercado_manual ?? (p as any).valor_estimado ?? 0), 0
    );
    const rentNetaPct = valorBase > 0 ? (rentAnualBruta * 0.85) / valorBase * 100 : null;
    const incAbiertas = incidencias.filter(i => i.estado !== "Cerrada" && (!filterPropertyId || (i as any).property_id === filterPropertyId));
    const incAltas = incAbiertas.filter(i => (i as any).prioridad === 1 || (i as any).prioridad === 2).length;

    return { esperado, cobrado, pct: esperado > 0 ? Math.round((cobrado / esperado) * 100) : null, rentNetaPct, valorTotal, incAbiertas: incAbiertas.length, incAltas, numActivos: visibles.length };
  }, [properties, inquilinos, pagos, contratos, incidencias, byProperty, mes, anio, filterPropertyId]);

  const dia = now.getDate();
  let cobradoSub: string;
  if (data.cobrado > 0) {
    cobradoSub = data.esperado > 0
      ? `esperado ${fmt(data.esperado)} €${data.pct !== null ? ` · ${data.pct}%` : ""}`
      : "sin renta esperada";
  } else if (data.esperado > 0 && dia <= 10) {
    cobradoSub = "aún no confirmado este mes";
  } else if (data.esperado > 0 && dia > 10) {
    cobradoSub = "pendiente de cobrar";
  } else {
    cobradoSub = "sin renta esperada";
  }

  const items = [
    {
      label: `Cobrado ${now.toLocaleDateString("es-ES", { month: "long" })}`,
      value: `${fmt(data.cobrado)} €`,
      sub: cobradoSub,
      icon: <CheckCircle2 size={14} />,
      tone: "success" as const,
    },
    {
      label: "Rentabilidad neta",
      value: data.rentNetaPct !== null ? `${data.rentNetaPct.toFixed(2).replace(".", ",")} %` : "—",
      sub: data.rentNetaPct !== null ? "estimación cartera" : "añade valor a tus activos",
      icon: <TrendingUp size={14} />,
      tone: "primary" as const,
    },
    {
      label: "Incidencias",
      value: `${data.incAbiertas} abiertas`,
      sub: data.incAltas > 0 ? `${data.incAltas} alta prioridad` : "sin urgencias",
      icon: <AlertCircle size={14} />,
      tone: data.incAbiertas > 0 ? ("warning" as const) : ("success" as const),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"
    >
      {items.map((it, idx) => {
        const toneCls =
          it.tone === "success"
            ? "text-emerald-600 bg-emerald-50 border-emerald-100"
            : it.tone === "warning"
            ? "text-amber-600 bg-amber-50 border-amber-100"
            : "text-primary bg-primary/10 border-primary/15";
        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * idx }}
            className="p-4 md:p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/20 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{it.label}</div>
              <div className={`w-7 h-7 rounded-md border flex items-center justify-center ${toneCls}`}>{it.icon}</div>
            </div>
            <div className="text-2xl md:text-4xl font-bold text-foreground font-mono tracking-tight">{it.value}</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">{it.sub}</div>
          </motion.div>
        );
      })}

      {data.valorTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="p-4 md:p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm md:col-span-3 lg:col-span-1"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold tracking-widest uppercase text-primary/80">Valor patrimonial</div>
            <div className="w-7 h-7 rounded-md border border-primary/15 bg-primary/10 text-primary flex items-center justify-center">
              <Wallet size={14} />
            </div>
          </div>
          <div className="text-3xl md:text-5xl font-bold text-foreground font-mono tracking-tight">
            {fmt(data.valorTotal)} €
          </div>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">
            estimación cartera · {data.numActivos} {data.numActivos === 1 ? "activo" : "activos"}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
