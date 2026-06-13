import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp, AlertTriangle, Home, Sparkles } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAltaAlquiler } from "./AltaAlquilerContext";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { useAllRentaActualizaciones } from "@/hooks/useAllRentaActualizaciones";
import InmuebleCardCompact, { type OtroInmueble } from "./InmuebleCardCompact";
import DashboardStatusHero from "./DashboardStatusHero";
import DashboardMoneyBlock from "./DashboardMoneyBlock";
import AgendaProxima from "./AgendaProxima";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import PropertyCardCompact from "./PropertyCardCompact";
import PropertyCard from "./PropertyCard";
import CalendarioHorizontal from "./CalendarioHorizontal";
import GraficaAnual from "./GraficaAnual";
import DeudaDetalleDialog from "./DeudaDetalleDialog";
import ContratoRenewalDialog from "./ContratoRenewalDialog";
import { useProfile } from "@/hooks/useProfile";
import { useContratos } from "@/hooks/useContratos";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { Contrato } from "@/hooks/useContratos";

export type PropertyStatus = "reformas" | "libre" | "alquilada" | "okupada" | "sin uso" | "uso propio" | "inqui-okupada";
export type IncomeHealth = "green" | "yellow" | "red";

interface PropertiesSectionProps {
  properties: Property[];
  inquilinos: Inquilino[];
  incidencias: Incidencia[];
  loading: boolean;
  onAdd: () => void;
  onAddInmueble?: (tipo: string) => void;
  onView: (property: Property) => void;
  onDelete: (property: Property) => void;
  onAddInquilino: (property: Property) => void;
  onEditInquilino: (inquilino: Inquilino) => void;
  onDeleteInquilino: (inquilino: Inquilino) => void;
  onViewInquilino: (inquilino: Inquilino) => void;
  onUpdateTipoAlquiler: (propertyId: string, tipo: string | null) => void;
  onMarkAlDia: (propertyId: string) => void;
  onIncidencias: (property: Property) => void;
  onHistorial: (property: Property) => void;
  pagos: PagoRenta[];
  onConfirmarPago: (propertyId: string, inquilinoId: string, datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }) => Promise<void>;
  onPagosHistorial: (property: Property) => void;
  eventos: PropertyEvento[];
  onCreateEvento: (data: any) => Promise<any>;
  onUpdateEvento: (id: string, data: any) => Promise<void>;
  onDeleteEvento: (id: string) => Promise<void>;
  contratos?: Contrato[];
  onCalendarConfirmarPago?: (propertyId: string, inquilinoId: string, datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }, mes: number, anio: number) => Promise<void>;
  onViewContrato?: (property: Property) => void;
  onViewDocumentacion?: (property: Property) => void;
  onUpdateProperty?: (id: string, data: Partial<Property>) => Promise<void>;
  onReorderInquilinos?: (orderedIds: string[]) => Promise<void>;
  onNavigateToNewContract?: (data: { propertyId: string; inquilinoId?: string; renta?: string; fianza?: string; duracion?: string }) => void;
  onCalendarEventClick?: (event: any) => void;
  onIncidenciaClick?: (incidenciaId: string) => void;
  otrosInmuebles?: OtroInmueble[];
  onClickOtroInmueble?: (inmueble: OtroInmueble) => void;
  onAbrirFicha?: (property: Property) => void;
  /**
   * Modo embebido en el nuevo dashboard. Oculta los bloques de resumen
   * (StatusHero, MoneyBlock, grid "Mis activos" y colapsable de actividad)
   * porque ya están representados arriba por el dashboard. Mantiene montados
   * los diálogos para no romper interacciones.
   */
  hideSummaryBlocks?: boolean;
}

const PropertiesSection = ({ properties, inquilinos, incidencias, loading, onAdd, onAddInmueble, onView, onDelete, onAddInquilino, onEditInquilino, onDeleteInquilino, onViewInquilino, onUpdateTipoAlquiler, onMarkAlDia, onIncidencias, onHistorial, pagos, onConfirmarPago, onPagosHistorial, eventos, onCreateEvento, onUpdateEvento, onDeleteEvento, contratos, onCalendarConfirmarPago, onViewContrato, onViewDocumentacion, onUpdateProperty, onReorderInquilinos, onNavigateToNewContract, onCalendarEventClick, onIncidenciaClick, otrosInmuebles, onClickOtroInmueble, onAbrirFicha, hideSummaryBlocks }: PropertiesSectionProps) => {
  const isMobile = useIsMobile();
  const [summaryOpen, setSummaryOpen] = useState(true);
  const alta = useAltaAlquiler();
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const { profile } = useProfile();
  const { updateContratoWithHistory } = useContratos();
  const { byProperty: tramosByProperty } = useAllRentaActualizaciones();

  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalContratoId, setRenewalContratoId] = useState<string | null>(null);
  const anioActual = now.getFullYear();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [generalFilterId, setGeneralFilterId] = useState<string | null>(null);
  const [deudaDialogOpen, setDeudaDialogOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const selectedProperty = selectedPropertyId ? properties.find(p => p.id === selectedPropertyId) : null;


  const activeFilterId = generalFilterId || null;

  // Calculate debts per property for display next to "Mis propiedades"
  const deudas = useMemo(() => {
    const currentMonth = now.getFullYear() * 12 + now.getMonth();
    const byProperty: Record<string, { propertyName: string; propertyId: string; meses: { mes: number; anio: number; importe: number }[]; total: number }> = {};

    for (const prop of properties) {
      const propInquilinos = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      if (propInquilinos.length === 0) continue;

      // H2.5 — usar tramos por periodo para evitar deuda fantasma cuando
      // la renta actual del contrato es mayor que la renta vigente en meses pasados.
      const tramosProp = tramosByProperty.get(prop.id);
      const rentaActualEsperada = resolveRentaEsperada(prop.id, inquilinos, contratos || []);
      if (!rentaActualEsperada) continue;

      // Check past months for unpaid/partial
      for (let offset = -36; offset < 0; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const monthNum = y * 12 + (m - 1);

        // Skip months before any inquilino was active
        const anyActiveInMonth = propInquilinos.some(inq => {
          const entrada = inq.fecha_entrada ? new Date(inq.fecha_entrada) : null;
          if (entrada && (entrada.getFullYear() * 12 + entrada.getMonth()) > monthNum) return false;
          const salida = inq.fecha_salida ? new Date(inq.fecha_salida) : null;
          if (salida && (salida.getFullYear() * 12 + salida.getMonth()) < monthNum) return false;
          return true;
        });
        if (!anyActiveInMonth) continue;

        // Check all payments for this property+month (regardless of inquilino)
        const propertyPagos = pagos.filter(p => p.property_id === prop.id && p.mes === m && p.anio === y);
        const totalCobrado = propertyPagos
          .filter(p => p.propietario_confirmado)
          .reduce((sum, p) => sum + Number(p.importe_pagado || 0), 0);

        const rentaMes = resolveRentaEsperada(prop.id, inquilinos, contratos || [], {
          actualizaciones: tramosProp,
          mes: m,
          anio: y,
        }) || 0;
        if (rentaMes > 0 && totalCobrado < rentaMes) {
          const deudaMes = rentaMes - totalCobrado;
          if (!byProperty[prop.id]) {
            byProperty[prop.id] = { propertyName: prop.nombre_interno, propertyId: prop.id, meses: [], total: 0 };
          }
          byProperty[prop.id].meses.push({ mes: m, anio: y, importe: deudaMes });
          byProperty[prop.id].total += deudaMes;
        }
      }
    }
    return Object.values(byProperty);
  }, [properties, inquilinos, pagos, contratos, tramosByProperty, now]);

  const totalDeuda = deudas.reduce((s, d) => s + d.total, 0);

  return (
    <section className="space-y-6">
      {/* 1. Status Hero — dominant, first thing user sees */}
      {!hideSummaryBlocks && !loading && properties.length > 0 && (
        <DashboardStatusHero
          properties={properties}
          inquilinos={inquilinos}
          pagos={pagos}
          contratos={contratos || []}
          incidencias={incidencias}
        />
      )}

      {/* 2. Money block — simplified 3 metrics */}
      {!hideSummaryBlocks && !loading && properties.length > 0 && (
        <DashboardMoneyBlock
          properties={properties}
          inquilinos={inquilinos}
          pagos={pagos}
          contratos={contratos || []}
          onPendientesClick={() => setDeudaDialogOpen(true)}
        />
      )}

      {/* 3. Assets grid — control list */}
      {!hideSummaryBlocks && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-foreground">Mis activos</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => alta.openPicker()}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              title="Dar de alta un activo, alquiler o contrato"
            >
              <Sparkles size={14} /> Dar de alta
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={properties.length >= 10}
                className="rounded-xl gap-1.5"
              >
                <Plus size={16} />
                Otro tipo
                <ChevronDown size={14} className="ml-0.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {[
                { label: "Vivienda", key: "vivienda" },
                { label: "Habitación", key: "habitacion" },
                { label: "Garaje", key: "garaje" },
                { label: "Trastero", key: "trastero" },
                { label: "Oficina", key: "oficina" },
                { label: "Local o nave", key: "local_nave" },
                { label: "Terreno", key: "terreno" },
                { label: "Edificio", key: "edificio" },
                { label: "Barco", key: "barco" },
                { label: "Caravana o camper", key: "caravana_camper" },
                { label: "Vacacional", key: "vacacional" },
                { label: "Finca para eventos", key: "finca_eventos" },
              ].map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => item.key === "vivienda" ? onAdd() : onAddInmueble?.(item.key)}
                  className="cursor-pointer text-sm"
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border shadow-sm animate-pulse h-32" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <p className="text-muted-foreground text-sm">No tienes inmuebles registrados aún.</p>
            <Button
              size="sm"
              onClick={onAdd}
              className="mt-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <Plus size={16} />
              Añadir tu primer inmueble
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {properties.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedPropertyId(null);
                    setGeneralFilterId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed text-left transition-all duration-200 ${
                    selectedPropertyId === null
                      ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                      : "border-border/60 bg-muted/30 hover:bg-muted/50 hover:border-border"
                  }`}
                >
                  <Home size={18} strokeWidth={2} className={selectedPropertyId === null ? "text-primary" : "text-muted-foreground"} />
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-medium ${selectedPropertyId === null ? "text-primary" : "text-muted-foreground"}`}>
                      Todos mis activos
                    </span>
                    <span className="text-xs text-muted-foreground">{properties.length}</span>
                  </div>
                </button>
              )}
              {properties.map((property) => (
                <PropertyCardCompact
                  key={property.id}
                  property={property}
                  inquilinos={inquilinos}
                  incidencias={incidencias}
                  allPagos={pagos}
                  contratos={contratos}
                  onClick={() => {
                    const newId = selectedPropertyId === property.id ? null : property.id;
                    setSelectedPropertyId(newId);
                    if (newId) {
                      setTimeout(() => {
                        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 100);
                    }
                  }}
                  onMarcarCobrado={async (propertyId, inquilinoId) => {
                    const renta = resolveRentaEsperada(propertyId, inquilinos, contratos || []);
                    await onConfirmarPago(propertyId, inquilinoId, {
                      importe_pagado: renta || 0,
                      tipo_pago: "transferencia",
                    });
                  }}
                  onViewContrato={onViewContrato ? (propertyId) => {
                    const prop = properties.find(p => p.id === propertyId);
                    if (prop) onViewContrato(prop);
                  } : undefined}
                  isSelected={selectedPropertyId === property.id}
                />
              ))}
              {otrosInmuebles && otrosInmuebles.map((inmueble) => (
                <InmuebleCardCompact
                  key={`${inmueble.tipo}-${inmueble.id}`}
                  inmueble={inmueble}
                  onClick={() => onClickOtroInmueble?.(inmueble)}
                />
              ))}
            </div>

            {selectedProperty && (
              <div className="mt-4" ref={detailRef}>
                <PropertyCard
                  property={selectedProperty}
                  inquilinos={inquilinos}
                  incidenciasCount={incidencias.filter(i => i.property_id === selectedProperty.id).length}
                  onView={() => onView(selectedProperty)}
                  onDelete={() => onDelete(selectedProperty)}
                  onAddInquilino={() => onAddInquilino(selectedProperty)}
                  onEditInquilino={onEditInquilino}
                  onDeleteInquilino={onDeleteInquilino}
                  onViewInquilino={onViewInquilino}
                  onUpdateTipoAlquiler={onUpdateTipoAlquiler}
                  onIncidencias={() => onIncidencias(selectedProperty)}
                  onHistorial={() => onHistorial(selectedProperty)}
                  pagoActual={pagos.find(p => p.property_id === selectedProperty.id && p.mes === mesActual && p.anio === anioActual)}
                  onConfirmarPago={async (datos) => {
                    const tenant = inquilinos.find(i => i.property_id === selectedProperty.id && i.rol_inquilino !== "avalista");
                    if (tenant) await onConfirmarPago(selectedProperty.id, tenant.id, datos);
                  }}
                  onPagosHistorial={() => onPagosHistorial(selectedProperty)}
                  onMarkAlDia={() => onMarkAlDia(selectedProperty.id)}
                  allInquilinos={inquilinos}
                  allPagos={pagos}
                  eventos={eventos}
                  onCreateEvento={onCreateEvento}
                  onUpdateEvento={onUpdateEvento}
                  onDeleteEvento={onDeleteEvento}
                  contratos={contratos?.filter(c => c.property_id === selectedProperty.id)}
                  onViewContrato={onViewContrato}
                  onViewDocumentacion={onViewDocumentacion}
                  onUpdateProperty={onUpdateProperty}
                  onReorderInquilinos={onReorderInquilinos}
                  onAbrirFicha={onAbrirFicha}
                />
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* 4. Collapsible: Activity → Analytics → Tools */}
      {!hideSummaryBlocks && !loading && properties.length > 0 && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1.5">
            {summaryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {summaryOpen ? "Ocultar actividad y gráficos" : "Ver actividad y gráficos"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-6">
            <AgendaProxima
              properties={properties}
              inquilinos={inquilinos}
              pagos={pagos}
              contratos={contratos || []}
              incidencias={incidencias}
              eventos={eventos}
            />
            <GraficaAnual
              properties={properties}
              inquilinos={inquilinos}
              pagos={pagos}
              filterPropertyId={activeFilterId}
              contratos={contratos}
              title={activeFilterId
                ? `Resumen económico — ${properties.find(p => p.id === activeFilterId)?.nombre_interno || ""}`
                : "Resumen económico general"
              }
            />
            <CalendarioHorizontal
              properties={properties}
              inquilinos={inquilinos}
              pagos={pagos}
              eventos={eventos}
              incidencias={incidencias}
              filterPropertyId={activeFilterId}
              onCreateEvento={onCreateEvento}
              onUpdateEvento={onUpdateEvento}
              onDeleteEvento={onDeleteEvento}
              onConfirmarPago={onCalendarConfirmarPago}
              contratos={contratos}
              onContratoVencimientoClick={(contratoId) => {
                setRenewalContratoId(contratoId);
                setRenewalDialogOpen(true);
              }}
              onEventClick={onCalendarEventClick}
              onIncidenciaClick={onIncidenciaClick}
              onPropertyClick={(propertyId) => {
                const prop = properties.find(p => p.id === propertyId);
                if (prop) onPagosHistorial(prop);
              }}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      <DeudaDetalleDialog
        open={deudaDialogOpen}
        onOpenChange={setDeudaDialogOpen}
        deudas={deudas}
        onPropertyClick={(propertyId) => {
          const prop = properties.find(p => p.id === propertyId);
          if (prop) onPagosHistorial(prop);
        }}
      />

      {/* Contrato Renewal Dialog */}
      {(() => {
        const selectedContrato = renewalContratoId ? contratos?.find(c => c.id === renewalContratoId) || null : null;
        const selectedProperty = selectedContrato ? properties.find(p => p.id === selectedContrato.property_id) || null : null;
        const selectedInquilino = selectedContrato?.inquilino_id ? inquilinos.find(i => i.id === selectedContrato.inquilino_id) || null : null;
        return (
          <ContratoRenewalDialog
            open={renewalDialogOpen}
            onOpenChange={(open) => { setRenewalDialogOpen(open); if (!open) setRenewalContratoId(null); }}
            contrato={selectedContrato}
            property={selectedProperty}
            inquilino={selectedInquilino}
            profile={profile || null}
            onIpcApplied={async (contratoId, newRenta, pct) => {
              const c = contratos?.find(ct => ct.id === contratoId);
              if (c) {
                await updateContratoWithHistory(c, { renta_mensual: newRenta }, `Actualización IPC: ${pct > 0 ? "+" : ""}${pct}%`, `Renta actualizada a ${newRenta} €/mes (IPC ${pct}%)`, `${c.renta_mensual} €/mes`, `${newRenta} €/mes`);
              }
            }}
            onNavigateToNewContract={onNavigateToNewContract}
            onCreateReminder={async (fecha, titulo, descripcion, propertyId) => {
              await onCreateEvento({
                titulo,
                descripcion,
                fecha,
                tipo: "contrato",
                subtipo: "recordatorio_renovacion",
                property_id: propertyId,
                visible_para_inquilino: false,
                recurrente: false,
              });
            }}
          />
        );
      })()}
    </section>
  );
};

export default PropertiesSection;
