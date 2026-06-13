import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Home, FileText, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useContratos, type Contrato } from "@/hooks/useContratos";
import { useInquilinos } from "@/hooks/useInquilinos";
import { useRentaActualizaciones, type RentaActualizacion } from "@/hooks/useRentaActualizaciones";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { useAuth } from "@/hooks/useAuth";
import type { Property } from "@/hooks/useProperties";

interface FiscalHistorialRentasProps {
  properties: Property[];
  anio: number;
}

interface TimelineEntry {
  fecha: string;
  importe: number;
  importeAnterior: number | null;
  tipo: "contrato" | "actualizacion" | "fin";
  contratoTitulo?: string;
  motivo?: string | null;
  inquilinoNombre?: string | null;
  fechaFin?: string | null;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(d: string): string {
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

const motivoLabels: Record<string, string> = {
  ipc: "Actualización IPC",
  negociacion: "Renegociación",
  nuevo_contrato: "Nuevo contrato",
  otro: "Ajuste manual",
};

const FiscalHistorialRentas = ({ properties, anio }: FiscalHistorialRentasProps) => {
  const { user } = useAuth();
  const { contratos } = useContratos();
  const { inquilinos } = useInquilinos();
  const { pagos } = usePagosRenta({ asOwner: true, userId: user?.id });
  const [expandedProp, setExpandedProp] = useState<string | null>(null);

  // Build timeline per property
  const propertyTimelines = useMemo(() => {
    return properties.map(prop => {
      const entries: TimelineEntry[] = [];

      // Contratos for this property
      const propContratos = contratos
        .filter(c => c.property_id === prop.id)
        .sort((a, b) => (a.fecha_inicio || "").localeCompare(b.fecha_inicio || ""));

      const propInquilinos = inquilinos.filter(i => i.property_id === prop.id);

      for (const contrato of propContratos) {
        if (contrato.renta_mensual && contrato.fecha_inicio) {
          const inq = contrato.inquilino_id
            ? propInquilinos.find(i => i.id === contrato.inquilino_id)
            : null;
          entries.push({
            fecha: contrato.fecha_inicio,
            importe: Number(contrato.renta_mensual),
            importeAnterior: null,
            tipo: "contrato",
            contratoTitulo: contrato.titulo,
            inquilinoNombre: inq ? `${inq.nombre} ${inq.apellidos || ""}`.trim() : null,
            fechaFin: contrato.fecha_fin || undefined,
          });
        }

        if (contrato.fecha_fin && contrato.archivado) {
          entries.push({
            fecha: contrato.fecha_fin,
            importe: 0,
            importeAnterior: contrato.renta_mensual ? Number(contrato.renta_mensual) : null,
            tipo: "fin",
            contratoTitulo: contrato.titulo,
          });
        }
      }

      // Rent updates from renta_actualizaciones — fetch inline via supabase would be complex,
      // so we use the pagos to detect implicit rent changes
      // For now, detect rent changes from contratos sequence
      for (let i = 1; i < propContratos.length; i++) {
        const prev = propContratos[i - 1];
        const curr = propContratos[i];
        if (prev.renta_mensual && curr.renta_mensual && Number(prev.renta_mensual) !== Number(curr.renta_mensual)) {
          // Already captured in contrato entries above
        }
      }

      // Sort by date descending (most recent first)
      entries.sort((a, b) => b.fecha.localeCompare(a.fecha));

      // Calculate yearly income from pagos
      const yearPagos = pagos.filter(p => p.property_id === prop.id && p.anio === anio && p.propietario_confirmado);
      const yearIncome = yearPagos.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);

      // Current rent
      const activeContrato = propContratos.find(c => c.estado === "vigente" && !c.archivado);
      const currentRent = activeContrato?.renta_mensual ? Number(activeContrato.renta_mensual) : null;

      return {
        property: prop,
        entries,
        yearIncome,
        currentRent,
        mesesCobrados: yearPagos.length,
      };
    }).filter(pt => pt.entries.length > 0 || pt.yearIncome > 0);
  }, [properties, contratos, inquilinos, pagos, anio]);

  if (propertyTimelines.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 text-center">
        <Calendar size={24} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay datos de rentas para mostrar</p>
        <p className="text-xs text-muted-foreground mt-1">Los datos aparecerán automáticamente a partir de tus contratos e ingresos</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-foreground">Historial de rentas</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Evolución de los alquileres de tus activos</p>

      <div className="space-y-2">
        {propertyTimelines.map(pt => {
          const isExpanded = expandedProp === pt.property.id;

          return (
            <div key={pt.property.id}>
              <button
                onClick={() => setExpandedProp(isExpanded ? null : pt.property.id)}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <Home size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{pt.property.nombre_interno}</span>
                    <div className="flex items-center gap-2">
                      {pt.currentRent && (
                        <span className="text-sm font-semibold text-foreground">{formatImporte(pt.currentRent)}€/mes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{pt.entries.length} cambio(s)</span>
                    {pt.yearIncome > 0 && <span>· {formatImporte(pt.yearIncome)}€ cobrados en {anio}</span>}
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="ml-4 mr-4 mb-3">
                  {/* Year summary */}
                  {pt.yearIncome > 0 && (
                    <div className="flex items-center gap-3 text-xs py-2.5 px-3.5 rounded-xl bg-emerald-50 border border-emerald-100 mb-3">
                      <TrendingUp size={14} className="text-emerald-700 shrink-0" />
                      <span className="text-emerald-800">
                        En <strong>{anio}</strong> se cobraron <strong>{formatImporte(pt.yearIncome)}€</strong> ({pt.mesesCobrados} mes{pt.mesesCobrados !== 1 ? "es" : ""})
                      </span>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="relative">
                    {/* Vertical line */}
                    {pt.entries.length > 1 && (
                      <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />
                    )}

                    <div className="space-y-0">
                      {pt.entries.map((entry, idx) => {
                        const isUp = entry.importeAnterior !== null && entry.importe > entry.importeAnterior;
                        const isDown = entry.importeAnterior !== null && entry.importe < entry.importeAnterior;
                        const isFin = entry.tipo === "fin";

                        return (
                          <div key={idx} className="flex gap-3 py-2.5 relative">
                            {/* Dot */}
                            <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                              isFin
                                ? "border-muted-foreground/30 bg-card"
                                : isUp
                                  ? "border-amber-400 bg-amber-50"
                                  : isDown
                                    ? "border-emerald-400 bg-emerald-50"
                                    : "border-primary bg-primary/5"
                            }`}>
                              {isFin ? (
                                <Minus size={10} className="text-muted-foreground" />
                              ) : isUp ? (
                                <TrendingUp size={10} className="text-amber-600" />
                              ) : isDown ? (
                                <TrendingDown size={10} className="text-emerald-600" />
                              ) : (
                                <FileText size={10} className="text-primary" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{formatFecha(entry.fecha)}</span>
                                {!isFin && (
                                  <span className="text-sm font-semibold text-foreground">{formatImporte(entry.importe)}€/mes</span>
                                )}
                              </div>

                              <div className="mt-0.5">
                                {isFin ? (
                                  <span className="text-xs text-muted-foreground">Fin de contrato · {entry.contratoTitulo}</span>
                                ) : entry.tipo === "contrato" ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{entry.contratoTitulo}</Badge>
                                    {entry.inquilinoNombre && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <User size={10} /> {entry.inquilinoNombre}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{entry.motivo ? motivoLabels[entry.motivo] || entry.motivo : "Cambio de renta"}</span>
                                )}
                              </div>

                              {entry.importeAnterior !== null && !isFin && (
                                <div className={`text-[11px] mt-0.5 ${isUp ? "text-amber-600" : "text-emerald-600"}`}>
                                  {isUp ? "↑" : "↓"} Antes: {formatImporte(entry.importeAnterior)}€/mes
                                  ({isUp ? "+" : ""}{formatImporte(entry.importe - entry.importeAnterior)}€)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FiscalHistorialRentas;
