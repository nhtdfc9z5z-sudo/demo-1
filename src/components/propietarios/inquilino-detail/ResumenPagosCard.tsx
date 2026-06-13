import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { isPeriodoBajoControl } from "@/lib/rentaUtils";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Contrato } from "@/hooks/useContratos";

interface ResumenPagosCardProps {
  inquilino: Inquilino;
  contratos: Contrato[];
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const ResumenPagosCard = ({ inquilino, contratos }: ResumenPagosCardProps) => {
  const { pagos, loading } = usePagosRenta({ inquilinoId: inquilino.id });

  const activeContrato = useMemo(
    () => contratos.find(c => c.inquilino_id === inquilino.id && !c.archivado && c.estado !== "finalizado"),
    [contratos, inquilino.id]
  );

  const rentaEsperada = activeContrato?.renta_mensual != null
    ? Number(activeContrato.renta_mensual)
    : (inquilino.renta_mensual != null ? Number(inquilino.renta_mensual) : null);

  // Last 6 months summary
  const now = new Date();
  const last6 = useMemo(() => {
    const months: { mes: number; anio: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ mes: d.getMonth() + 1, anio: d.getFullYear(), label: MESES[d.getMonth()] });
    }
    return months;
  }, []);

  const dots = useMemo(() => {
    // [H2.9] Vista operativa: ocultar por completo los meses anteriores al inicio de control.
    return last6
      .filter(m => isPeriodoBajoControl(activeContrato, m.mes, m.anio))
      .map(m => {
        const pago = pagos.find(p => p.mes === m.mes && p.anio === m.anio);
        if (!pago) return { ...m, status: "pendiente" as const };
        if (pago.propietario_confirmado) return { ...m, status: "pagado" as const };
        if (pago.inquilino_notificado) return { ...m, status: "notificado" as const };
        if (pago.importe_pagado != null && rentaEsperada && pago.importe_pagado < rentaEsperada) return { ...m, status: "parcial" as const };
        return { ...m, status: "pendiente" as const };
      });
  }, [last6, pagos, rentaEsperada, activeContrato]);

  // Accumulated debt
  const deudaAcumulada = useMemo(() => {
    if (!rentaEsperada) return null;
    return dots.reduce((acc, d) => {
      if (d.status === "pagado") return acc;
      const pago = pagos.find(p => p.mes === d.mes && p.anio === d.anio);
      const pagado = pago?.importe_pagado ?? 0;
      return acc + Math.max(0, rentaEsperada - Number(pagado));
    }, 0);
  }, [dots, pagos, rentaEsperada]);

  // Last confirmed payment
  const ultimoPago = useMemo(() => {
    const confirmed = pagos
      .filter(p => p.propietario_confirmado)
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
    return confirmed[0] || null;
  }, [pagos]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-12 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!rentaEsperada) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground italic">Sin renta definida — no se puede calcular el resumen de pagos.</p>
        </CardContent>
      </Card>
    );
  }

  const dotColor: Record<string, string> = {
    pagado: "bg-emerald-500",
    notificado: "bg-amber-400",
    parcial: "bg-orange-500",
    pendiente: "bg-muted-foreground/20",
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Resumen de pagos</h4>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Último pago:{" "}
            {ultimoPago
              ? <span className="text-foreground font-medium">{MESES[ultimoPago.mes - 1]} {ultimoPago.anio} ✓</span>
              : "Sin pagos confirmados"}
          </span>
          {deudaAcumulada != null && deudaAcumulada > 0 && (
            <span className="text-red-600 font-medium">Pendiente (últ. 6 meses): {deudaAcumulada.toLocaleString("es-ES")} €</span>
          )}
          {deudaAcumulada != null && deudaAcumulada === 0 && (
            <span className="text-emerald-600 font-medium">Al corriente</span>
          )}
        </div>

        {/* Dot timeline */}
        <div className="flex items-center gap-2">
          {dots.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-4 h-4 rounded-full ${dotColor[d.status]}`}
                title={`${d.label} ${d.anio}: ${d.status}`}
              />
              <span className="text-[9px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResumenPagosCard;
