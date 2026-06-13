import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle, CalendarClock, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
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
}

type StatusLevel = "green" | "yellow" | "red";

export default function DashboardStatusHero({ properties, inquilinos, pagos, contratos, incidencias }: Props) {
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const status = useMemo((): { level: StatusLevel; title: string; subtitle: string } => {
    if (properties.length === 0) {
      return { level: "green", title: "Empieza añadiendo tu primer activo", subtitle: "Aún no tienes propiedades registradas" };
    }

    let totalEsperado = 0;
    let totalCobrado = 0;
    let inquilinosPendientes = 0;
    let activosConProblema = 0;

    for (const prop of properties) {
      const tenants = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      if (tenants.length === 0) continue;

      const renta = resolveRentaEsperada(prop.id, inquilinos, contratos) || 0;
      totalEsperado += renta;

      const pagosMes = pagos.filter(
        p => p.property_id === prop.id && p.mes === mesActual && p.anio === anioActual && p.propietario_confirmado
      );
      const cobrado = pagosMes.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
      totalCobrado += cobrado;

      if (cobrado < renta) {
        inquilinosPendientes++;
      }

      // Check for open incidencias
      const openInc = incidencias.filter(i => i.property_id === prop.id && i.estado !== "Cerrada");
      if (openInc.length > 0 || cobrado < renta) {
        activosConProblema++;
      }
    }

    const falta = totalEsperado - totalCobrado;

    if (activosConProblema === 0 && falta <= 0) {
      return {
        level: "green",
        title: "Todo bajo control",
        subtitle: "Has cobrado todo este mes",
      };
    }

    if (falta > 0 && activosConProblema <= 1) {
      return {
        level: "yellow",
        title: `Te falta cobrar ${falta.toLocaleString("es-ES")} €`,
        subtitle: inquilinosPendientes === 1
          ? "1 inquilino pendiente de pago"
          : `${inquilinosPendientes} inquilinos pendientes de pago`,
      };
    }

    return {
      level: "red",
      title: `Tienes problemas en ${activosConProblema} activos`,
      subtitle: "Revisa incidencias o pagos pendientes",
    };
  }, [properties, inquilinos, pagos, contratos, incidencias, mesActual, anioActual]);

  const config = {
    green: {
      icon: CheckCircle2,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
      iconColor: "text-emerald-500",
      titleColor: "text-emerald-800 dark:text-emerald-300",
      subtitleColor: "text-emerald-600/80 dark:text-emerald-400/80",
    },
    yellow: {
      icon: AlertTriangle,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
      iconColor: "text-amber-500",
      titleColor: "text-amber-800 dark:text-amber-300",
      subtitleColor: "text-amber-600/80 dark:text-amber-400/80",
    },
    red: {
      icon: XCircle,
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800",
      iconColor: "text-red-500",
      titleColor: "text-red-800 dark:text-red-300",
      subtitleColor: "text-red-600/80 dark:text-red-400/80",
    },
  };

  const c = config[status.level];
  const Icon = c.icon;

  // 4 tarjetas de estado del flujo unificado de alquileres
  const cards = useMemo(() => {
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const proximasRenov = contratos.filter(c => {
      if (!c.fecha_fin) return false;
      const f = new Date(c.fecha_fin);
      return c.estado === "vigente" && f >= now && f <= in90;
    }).length;

    const pagosPendHist = pagos.filter((p: any) => p.tipo_pago === "pendiente").length;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    // Solo contar "cambios reales": updated_at posterior a la creación (margen 2 min)
    const cambiosRecientes = contratos.filter(c => {
      const u = (c as any).updated_at ? new Date((c as any).updated_at).getTime() : 0;
      const cr = c.created_at ? new Date(c.created_at).getTime() : 0;
      return u >= since.getTime() && u - cr > 120_000 && c.estado !== "archivado";
    }).length;

    // Vigentes "al día": estado vigente y sin pagos pendientes históricos asociados
    const contratosConPendiente = new Set(
      pagos.filter((p: any) => p.tipo_pago === "pendiente").map((p: any) => p.inquilino_id),
    );
    const activosAlDia = contratos.filter(c =>
      c.estado === "vigente" && !(c.inquilino_id && contratosConPendiente.has(c.inquilino_id)),
    ).length;

    return [
      { key: "renov", label: "Próximas renovaciones", value: proximasRenov, hint: "Próximos 90 días", Icon: CalendarClock, tone: "amber" as const },
      { key: "cambios", label: "Contratos con cambios recientes", value: cambiosRecientes, hint: "Últimos 30 días", Icon: RefreshCw, tone: "sky" as const },
      { key: "ok", label: "Contratos activos al día", value: activosAlDia, hint: "Vigentes sin deuda histórica", Icon: ShieldCheck, tone: "emerald" as const },
    ];
  }, [contratos, pagos, now]);

  const toneMap: Record<string, string> = {
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
    sky: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <div className="space-y-4">
      {/* Estado principal — respirable, jerarquía clara */}
      <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 sm:p-7 flex items-center gap-4 sm:gap-5`}>
        <Icon className={`${c.iconColor} shrink-0`} size={44} strokeWidth={1.8} />
        <div className="min-w-0">
          <h2 className={`text-xl sm:text-2xl font-bold ${c.titleColor} leading-tight`}>
            {status.title}
          </h2>
          <p className={`text-sm ${c.subtitleColor} mt-1`}>
            {status.subtitle}
          </p>
        </div>
      </div>

      {/* Tarjetas resumen — más aire, números protagonistas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ key, label, value, hint, Icon: CardIcon, tone }) => (
          <div
            key={key}
            className={`rounded-xl border p-4 ${toneMap[tone]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <CardIcon size={18} strokeWidth={1.8} className="shrink-0 opacity-80" />
              <span className="text-2xl font-bold leading-none font-mono tabular-nums">{value}</span>
            </div>
            <p className="text-xs font-medium leading-snug">{label}</p>
            <p className="text-[11px] opacity-70 leading-snug mt-0.5">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
