import { useMemo } from "react";
import { TrendingUp, Home, AlertTriangle, Users } from "lucide-react";
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
  totalDeuda: number;
  onDeudaClick?: () => void;
}

export default function PatrimonioResumen({ properties, inquilinos, pagos, contratos, totalDeuda, onDeudaClick }: Props) {
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const { byProperty: tramosByProperty } = useAllRentaActualizaciones();

  const metrics = useMemo(() => {
    let ingresosConfirmados = 0;
    let ingresosEsperados = 0;
    let propiedadesOcupadas = 0;

    for (const prop of properties) {
      const tenants = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      const renta = resolveRentaEsperada(prop.id, inquilinos, contratos, {
        actualizaciones: tramosByProperty.get(prop.id),
        mes: mesActual,
        anio: anioActual,
      });

      if (tenants.length > 0) {
        propiedadesOcupadas++;
        if (renta) ingresosEsperados += renta;
      }

      const pagosMes = pagos.filter(
        p => p.property_id === prop.id && p.mes === mesActual && p.anio === anioActual && p.propietario_confirmado
      );
      ingresosConfirmados += pagosMes.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
    }

    const ocupacion = properties.length > 0 ? Math.round((propiedadesOcupadas / properties.length) * 100) : 0;

    return { ingresosConfirmados, ingresosEsperados, ocupacion, propiedadesOcupadas };
  }, [properties, inquilinos, pagos, contratos, mesActual, anioActual, tramosByProperty]);

  if (properties.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Hero KPI: Cobrado este mes */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Cobrado este mes</span>
        </div>
        <p className="text-2xl font-bold text-primary leading-none">
          {metrics.ingresosConfirmados.toLocaleString("es-ES")} €
        </p>
        {metrics.ingresosEsperados > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            de {metrics.ingresosEsperados.toLocaleString("es-ES")} € esperados
          </p>
        )}
      </div>

      {/* Secondary KPIs row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-border/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Renta esperada</span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-none">
            {metrics.ingresosEsperados.toLocaleString("es-ES")} €
          </p>
        </div>

        <div className="rounded-lg border border-border/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Ocupación</span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-none">
            {metrics.ocupacion}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.propiedadesOcupadas} de {properties.length}</p>
        </div>

        {totalDeuda > 0 ? (
          <button
            onClick={onDeudaClick}
            className="rounded-lg border border-destructive/20 px-3 py-2.5 text-left hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[11px] text-destructive/70">Deuda</span>
            </div>
            <p className="text-sm font-semibold text-destructive leading-none">
              {totalDeuda.toLocaleString("es-ES")} €
            </p>
          </button>
        ) : (
          <div className="rounded-lg border border-border/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-muted-foreground">Deuda</span>
            </div>
            <p className="text-sm font-semibold text-emerald-600 leading-none">0 €</p>
          </div>
        )}
      </div>
    </div>
  );
}
