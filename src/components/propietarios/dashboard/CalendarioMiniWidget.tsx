import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import CalendarioHorizontal from "@/components/propietarios/CalendarioHorizontal";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { Incidencia } from "@/hooks/useIncidencias";

interface CalendarioMiniWidgetProps {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  eventos: PropertyEvento[];
  incidencias: Incidencia[];
  contratos?: any[];
  filterPropertyId?: string | null;
  toastVisible?: boolean;
  onCreateEvento: (data: any) => Promise<any>;
  onUpdateEvento: (id: string, data: any) => Promise<void>;
  onDeleteEvento: (id: string) => Promise<void>;
  onConfirmarPago?: (propertyId: string, inquilinoId: string, datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }, mes: number, anio: number) => Promise<void>;
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

const CalendarioMiniWidget = ({
  properties, inquilinos, pagos, eventos, incidencias, contratos,
  filterPropertyId, toastVisible, onCreateEvento, onUpdateEvento, onDeleteEvento, onConfirmarPago,
}: CalendarioMiniWidgetProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const eventosFiltrados = useMemo(() => {
    return filterPropertyId
      ? eventos.filter(e => e.property_id === filterPropertyId)
      : eventos;
  }, [eventos, filterPropertyId]);

  const proximos = useMemo(() => {
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return eventosFiltrados
      .filter(e => {
        const t = new Date(e.fecha).getTime();
        return !isNaN(t) && t >= t0;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 3);
  }, [eventosFiltrados]);

  const eventosMes = useMemo(() => {
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return eventosFiltrados.filter(e => (e.fecha || "").startsWith(ym)).length;
  }, [eventosFiltrados]);

  const sheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-primary" /> Calendario
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <CalendarioHorizontal
            properties={
              filterPropertyId
                ? properties.filter(p => p.id === filterPropertyId)
                : properties
            }
            inquilinos={inquilinos}
            pagos={
              filterPropertyId
                ? pagos.filter(p => p.property_id === filterPropertyId)
                : pagos
            }
            eventos={eventosFiltrados}
            incidencias={
              filterPropertyId
                ? incidencias.filter(i => i.property_id === filterPropertyId)
                : incidencias
            }
            filterPropertyId={filterPropertyId}
            contratos={contratos}
            onCreateEvento={onCreateEvento}
            onUpdateEvento={onUpdateEvento}
            onDeleteEvento={onDeleteEvento}
            onConfirmarPago={onConfirmarPago}
          />
        </div>
      </SheetContent>
    </Sheet>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir calendario"
          className={`fixed ${toastVisible ? "bottom-40" : "bottom-20"} right-4 z-20 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all`}
        >
          <CalendarIcon size={20} />
          {eventosMes > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {eventosMes}
            </span>
          )}
        </button>
        {sheet}
      </>
    );
  }

  return (
    <>
      <div className={`fixed ${toastVisible ? "bottom-32" : "bottom-4"} right-4 z-20 w-[280px] rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg transition-all`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Próximos eventos</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-0.5"
            aria-label="Abrir calendario completo"
          >
            Abrir
            <ChevronUp size={12} />
          </button>
        </div>
        <div className="p-2 space-y-1.5">
          {proximos.length === 0 ? (
            <div className="text-[11px] text-muted-foreground px-1 py-2 text-center">
              Sin eventos próximos
            </div>
          ) : (
            proximos.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setOpen(true)}
                className="w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
              >
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums mt-0.5 shrink-0 w-12">
                  {fmtFecha(ev.fecha)}
                </span>
                <span className="text-xs text-foreground truncate flex-1">{ev.titulo}</span>
                {ev.tipo && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    {ev.tipo}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>
      {sheet}
    </>
  );
};

export default CalendarioMiniWidget;