import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyGasto } from "@/hooks/usePropertyGastos";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import { computeMonthData } from "@/lib/finanzasEngine";
import { useAllRentaActualizaciones } from "@/hooks/useAllRentaActualizaciones";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type ViewMode = "trimestre" | "semestre" | "anual" | "2anos";

const VIEW_MODES: { value: ViewMode; label: string; months: number }[] = [
  { value: "trimestre", label: "3M", months: 3 },
  { value: "semestre", label: "6M", months: 6 },
  { value: "anual", label: "1A", months: 12 },
  { value: "2anos", label: "2A", months: 24 },
];

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface GraficaAnualProps {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  filterPropertyId?: string | null;
  title?: string;
  gastosManuales?: PropertyGasto[];
  contratos?: Contrato[];
  incidencias?: Incidencia[];
  /**
   * Si es `true`, suma a los ingresos de cada mes los pagos
   * marcados como `historico_reconstruido`, `regularizado` o
   * `afecta_finanzas_actuales=false`. Por defecto la gráfica
   * los excluye (comportamiento histórico). Útil para mostrar
   * la misma definición de ingreso que KpiHeroRow
   * (cualquier `importe_pagado > 0` cuenta como cobrado).
   */
  incluirHistoricos?: boolean;
}

const GraficaAnual = ({ properties, inquilinos, pagos, filterPropertyId, title, gastosManuales, contratos, incidencias, incluirHistoricos = false }: GraficaAnualProps) => {
  const now = new Date();
  const { byProperty: tramosByProperty } = useAllRentaActualizaciones();
  const [viewMode, setViewMode] = useState<ViewMode>("anual");
  // startMonth is absolute month index (year*12 + month)
  const currentAbsMonth = now.getFullYear() * 12 + now.getMonth();
  const modeMonths = VIEW_MODES.find(v => v.value === viewMode)!.months;
  const [startAbsMonth, setStartAbsMonth] = useState(now.getFullYear() * 12); // Jan of current year

  // Calculate available years from contracts, inquilinos and pagos
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(now.getFullYear());

    // From contracts
    if (contratos) {
      for (const c of contratos) {
        if (c.fecha_inicio) {
          const y = new Date(c.fecha_inicio).getFullYear();
          if (!isNaN(y)) years.add(y);
        }
      }
    }

    // From inquilinos entry dates
    for (const inq of inquilinos) {
      if (inq.fecha_entrada) {
        const y = new Date(inq.fecha_entrada).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    }

    // From pagos
    for (const p of pagos) {
      if (p.anio) years.add(p.anio);
    }

    return Array.from(years).sort((a, b) => a - b);
  }, [contratos, inquilinos, pagos]);

  const navigate = (dir: number) => {
    setStartAbsMonth(s => s + dir * modeMonths);
  };

  const jumpToYear = (year: number) => {
    setViewMode("anual");
    setStartAbsMonth(year * 12);
  };

  const data = useMemo(() => {
    const filteredProps = filterPropertyId ? properties.filter(p => p.id === filterPropertyId) : properties;
    const result = [];
    for (let i = 0; i < modeMonths; i++) {
      const abs = startAbsMonth + i;
      const yr = Math.floor(abs / 12);
      const mo = abs % 12;
      const { ingresos, gastos } = computeMonthData(yr, mo, filteredProps, inquilinos, pagos, gastosManuales, contratos, incidencias, tramosByProperty);
      let ingresosFinal = ingresos;
      if (incluirHistoricos) {
        // Sumar pagos históricos/regularizados que el engine excluye
        // pero que sí afectan a la lectura de ingreso del usuario.
        for (const p of pagos) {
          if (filterPropertyId && p.property_id !== filterPropertyId) continue;
          if (filteredProps.length && !filteredProps.some(fp => fp.id === p.property_id)) continue;
          if (p.mes !== mo + 1 || p.anio !== yr) continue;
          const esHistorico =
            p.tipo_registro === "historico_reconstruido" ||
            p.tipo_registro === "regularizado" ||
            p.afecta_finanzas_actuales === false;
          if (!esHistorico) continue;
          ingresosFinal += Number(p.importe_pagado || 0);
        }
      }
      result.push({
        mes: `${MESES_CORTOS[mo]}${modeMonths > 12 ? ` ${yr.toString().slice(2)}` : ""}`,
        ingresos: ingresosFinal,
        gastos,
        balance: ingresosFinal - gastos,
      });
    }
    return result;
  }, [startAbsMonth, modeMonths, properties, inquilinos, pagos, filterPropertyId, gastosManuales, contratos, incidencias, tramosByProperty, incluirHistoricos]);

  const totals = useMemo(() => {
    const totalIngresos = data.reduce((s, d) => s + d.ingresos, 0);
    const totalGastos = data.reduce((s, d) => s + d.gastos, 0);
    return { ingresos: totalIngresos, gastos: totalGastos, balance: totalIngresos - totalGastos };
  }, [data]);

  // H2.6 — Aviso: históricos reconstruidos quedan fuera del gráfico.
  // Contamos pagos `historico_reconstruido` (o `afecta_finanzas_actuales=false`)
  // que caigan dentro del rango visible (por mes/año de devengo).
  const historicoFueraDelGrafico = useMemo(() => {
    const endAbs = startAbsMonth + modeMonths - 1;
    let count = 0;
    let total = 0;
    for (const p of pagos) {
      if (filterPropertyId && p.property_id !== filterPropertyId) continue;
      const esHistorico =
        p.tipo_registro === "historico_reconstruido" ||
        p.tipo_registro === "regularizado" ||
        p.afecta_finanzas_actuales === false;
      if (!esHistorico) continue;
      const abs = p.anio * 12 + (p.mes - 1);
      if (abs < startAbsMonth || abs > endAbs) continue;
      count += 1;
      total += Number(p.importe_pagado || 0);
    }
    return { count, total };
  }, [pagos, filterPropertyId, startAbsMonth, modeMonths]);

  // Label for the range
  const rangeStart = new Date(Math.floor(startAbsMonth / 12), startAbsMonth % 12);
  const rangeEnd = new Date(Math.floor((startAbsMonth + modeMonths - 1) / 12), (startAbsMonth + modeMonths - 1) % 12);
  const rangeLabel = modeMonths <= 12
    ? rangeStart.getFullYear() === rangeEnd.getFullYear()
      ? `${MESES_CORTOS[rangeStart.getMonth()]} – ${MESES_CORTOS[rangeEnd.getMonth()]} ${rangeStart.getFullYear()}`
      : `${MESES_CORTOS[rangeStart.getMonth()]} ${rangeStart.getFullYear()} – ${MESES_CORTOS[rangeEnd.getMonth()]} ${rangeEnd.getFullYear()}`
    : `${rangeStart.getFullYear()} – ${rangeEnd.getFullYear()}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3.5">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {title || "Resumen económico"}
        </h3>
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-secondary rounded-lg p-0.5 mr-2">
            {VIEW_MODES.map(vm => (
              <button
                key={vm.value}
                onClick={() => {
                  setViewMode(vm.value);
                  const newStart = currentAbsMonth - Math.floor(vm.months / 2);
                  setStartAbsMonth(vm.value === "anual" ? now.getFullYear() * 12 : newStart);
                }}
                className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
                  viewMode === vm.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {vm.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-medium text-foreground min-w-[100px] text-center">{rangeLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Year quick-jump */}
      {availableYears.length > 1 && (
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto">
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">Año:</span>
          {availableYears.map(y => {
            const isActive = viewMode === "anual" && startAbsMonth === y * 12;
            return (
              <button
                key={y}
                onClick={() => jumpToYear(y)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline summary */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Ingresos</span>
          <span className="font-semibold text-foreground">{formatImporte(totals.ingresos)}€</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Gastos</span>
          <span className="font-semibold text-foreground">{formatImporte(totals.gastos)}€</span>
        </span>
        <span className={`font-semibold ${totals.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {totals.balance >= 0 ? "+" : ""}{formatImporte(totals.balance)}€
        </span>
      </div>

      {/* Chart — reduced height */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="mes" tick={{ fontSize: modeMonths > 12 ? 8 : 10 }} className="text-muted-foreground" interval={modeMonths > 12 ? 1 : 0} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} className="text-muted-foreground" />
          <Tooltip
            formatter={(value: number, name: string) => [`${formatImporte(value)}€`, name === "ingresos" ? "Ingresos" : "Gastos"]}
            contentStyle={{ borderRadius: "0.75rem", fontSize: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Line type="monotone" dataKey="ingresos" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="gastos" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>

      {historicoFueraDelGrafico.count > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
          <History size={13} className="text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
            Hay {historicoFueraDelGrafico.count} {historicoFueraDelGrafico.count === 1 ? "mes regularizado" : "meses regularizados"} históricamente
            ({formatImporte(historicoFueraDelGrafico.total)}€) en este rango que no se incluyen en el gráfico.
            Aparecen en el histórico económico del contrato.
          </p>
        </div>
      )}
    </div>
  );
};

export default GraficaAnual;
