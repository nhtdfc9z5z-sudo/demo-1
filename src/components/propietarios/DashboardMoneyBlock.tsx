import { useMemo } from "react";
import { Euro, CheckCircle2, AlertTriangle } from "lucide-react";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { useAllRentaActualizaciones } from "@/hooks/useAllRentaActualizaciones";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos: Contrato[];
  onPendientesClick?: () => void;
}

export default function DashboardMoneyBlock({ properties, inquilinos, pagos, contratos, onPendientesClick }: Props) {
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const { byProperty: tramosByProperty } = useAllRentaActualizaciones();

  const metrics = useMemo(() => {
    let esperado = 0;
    let cobrado = 0;
    let inquilinosPendientes = 0;

    for (const prop of properties) {
      const tenants = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      if (tenants.length === 0) continue;

      const renta = resolveRentaEsperada(prop.id, inquilinos, contratos, {
        actualizaciones: tramosByProperty.get(prop.id),
        mes: mesActual,
        anio: anioActual,
      }) || 0;
      esperado += renta;

      const pagosMes = pagos.filter(
        p => p.property_id === prop.id && p.mes === mesActual && p.anio === anioActual && p.propietario_confirmado
      );
      const cobradoProp = pagosMes.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
      cobrado += cobradoProp;

      if (cobradoProp < renta) {
        inquilinosPendientes++;
      }
    }

    return { esperado, cobrado, falta: Math.max(0, esperado - cobrado), inquilinosPendientes };
  }, [properties, inquilinos, pagos, contratos, mesActual, anioActual, tramosByProperty]);

  if (properties.length === 0) return null;

  const items = [
    {
      label: "Deberías cobrar",
      value: metrics.esperado,
      icon: Euro,
      colorClass: "text-foreground",
      bgClass: "bg-muted/50",
      borderClass: "border-border/50",
    },
    {
      label: "Has cobrado",
      value: metrics.cobrado,
      icon: CheckCircle2,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
      borderClass: "border-emerald-200 dark:border-emerald-800/50",
    },
    {
      label: "Falta por cobrar",
      value: metrics.falta,
      icon: AlertTriangle,
      colorClass: metrics.falta > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      bgClass: metrics.falta > 0 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-emerald-50 dark:bg-emerald-950/20",
      borderClass: metrics.falta > 0 ? "border-amber-200 dark:border-amber-800/50" : "border-emerald-200 dark:border-emerald-800/50",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`rounded-xl border ${item.borderClass} ${item.bgClass} p-4`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={15} className={item.colorClass} />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${item.colorClass} leading-none`}>
                {item.value.toLocaleString("es-ES")} €
              </p>
            </div>
          );
        })}
      </div>

      {metrics.falta > 0 && metrics.inquilinosPendientes > 0 && (
        <button
          onClick={onPendientesClick}
          className="w-full text-left rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/10 px-4 py-2.5 flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
        >
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {metrics.inquilinosPendientes === 1
              ? "1 inquilino pendiente de pago"
              : `${metrics.inquilinosPendientes} inquilinos pendientes de pago`}
          </span>
        </button>
      )}
    </div>
  );
}
