import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Euro, Home, Check, Clock, AlertTriangle, X, ChevronRight, ShieldCheck } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";
import { resolveRentaEsperada, calcularImporteEsperado, resolveFechasContrato, isPagoRealEffective, isPagoHistorico, calcularEstadoMesCalendario } from "@/lib/rentaUtils";
import { getEstadoMesContrato, isContratoActivoEnMes } from "@/lib/estadoMesContrato";
import { usePagoCompensaciones } from "@/hooks/usePagoCompensaciones";
import { useAuth } from "@/hooks/useAuth";
import ContactoSeguroImpagoDialog from "./ContactoSeguroImpagoDialog";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface RentaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
  contratos?: Contrato[];
  onPropertyClick?: (propertyId: string) => void;
  onPropertyRentClick?: (propertyId: string) => void;
  onRegistrarCobro?: (propertyId: string, inquilinoId: string, mes: number, anio: number) => void;
}

export default function RentaDetailDialog({ open, onOpenChange, mes, anio, properties, inquilinos, pagos, contratos, onPropertyClick, onPropertyRentClick, onRegistrarCobro }: RentaDetailDialogProps) {
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const thisMonth = anio * 12 + mes;
  const [seguroDialogProperty, setSeguroDialogProperty] = useState<Property | null>(null);
  const { user } = useAuth();
  const { compensadoEnMes, compensacionesEnMes } = usePagoCompensaciones({ userId: user?.id, asOwner: true });

  const MOTIVO_LABELS: Record<string, string> = {
    reparacion: "Reparación",
    mantenimiento: "Mantenimiento",
    suministros: "Suministros",
    acuerdo: "Acuerdo",
    descuento: "Descuento",
    otro: "Otro",
  };

  const propertyData = properties
    .filter(prop => {
      const propInquilinos = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      const hasActive = propInquilinos.some(inq => {
        const entrada = inq.fecha_entrada ? new Date(inq.fecha_entrada) : null;
        if (entrada && anio * 12 + mes < entrada.getFullYear() * 12 + entrada.getMonth()) return false;
        const salida = inq.fecha_salida ? new Date(inq.fecha_salida) : null;
        if (salida && anio * 12 + mes > salida.getFullYear() * 12 + salida.getMonth()) return false;
        return true;
      });
      return hasActive || prop.estado === "alquilada";
    })
    .map(prop => {
      const propInquilinos = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");
      const propertyPagos = pagos.filter(p => p.property_id === prop.id && p.mes === mes + 1 && p.anio === anio);
      const confirmedAll = propertyPagos.filter(p => p.propietario_confirmado);
      const confirmedReales = confirmedAll.filter(p => isPagoRealEffective(p));
      const confirmedHistoricos = confirmedAll.filter(p => isPagoHistorico(p));
      const notified = propertyPagos.filter(p => p.inquilino_notificado && !p.propietario_confirmado);
      const totalCobradoReal = confirmedReales.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
      const totalHistorico = confirmedHistoricos.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);
      const rentaMensualProp = resolveRentaEsperada(prop.id, inquilinos, contratos || []);

      // Use proration-aware expected amount
      const fechas = resolveFechasContrato(prop.id, inquilinos, contratos || []);
      const esperado = rentaMensualProp
        ? calcularImporteEsperado(rentaMensualProp, mes + 1, anio, fechas.fechaInicio, fechas.fechaFin)
        : null;
      const rentaEsperada = esperado?.importe ?? rentaMensualProp;

      type RentaStatus = "pagado" | "parcial" | "notificado" | "pendiente" | "impago" | "historico" | "no_gestionado";
      let status: RentaStatus = "pendiente";
      let deuda = 0;
      let inconsistente = false;
      // Sprint 3.8 — Estado económico por CONTRATO. Si hay contratos
      // activos para el activo en (mes, año), iteramos por contrato y
      // agregamos para presentación. Si no, fallback legacy por activo.
      const activeContratosProp = (contratos || []).filter(
        c => c.property_id === prop.id && isContratoActivoEnMes(c, mes + 1, anio),
      );
      const priority: Record<string, number> = {
        impago: 6, pendiente: 5, parcial: 4, notificado: 3, historico: 2, pagado: 1, no_gestionado: 0,
      };
      if (activeContratosProp.length > 0) {
        let worst: RentaStatus = "pagado";
        let allFueraControl = true;
        for (const c of activeContratosProp) {
          const pagosVirtuales = propertyPagos
            .filter(p =>
              p.contrato_id === c.id ||
              (p.contrato_id == null && activeContratosProp.length === 1),
            )
            .map(p => (p.contrato_id ? p : { ...p, contrato_id: c.id }));
          const est = getEstadoMesContrato({
            contrato: c,
            mes: mes + 1,
            anio,
            pagos: pagosVirtuales,
            compensado: compensadoEnMes(prop.id, mes + 1, anio),
            today: now,
          });
          if (!est.fueraDeControl) allFueraControl = false;
          if (est.inconsistente) inconsistente = true;
          if (est.status === "parcial") deuda += est.deuda;
          if (
            est.status &&
            (priority[est.status] ?? -1) > (priority[worst] ?? -1)
          ) {
            worst = est.status as RentaStatus;
          }
        }
        status = allFueraControl ? "no_gestionado" : worst;
      } else {
        const estadoCalendario = calcularEstadoMesCalendario({
          contrato: null,
          mes: mes + 1,
          anio,
          rentaEsperada: rentaEsperada ?? null,
          cobradoReal: totalCobradoReal,
          cobradoHistorico: totalHistorico,
          hasReal: confirmedReales.length > 0,
          hasHistorico: confirmedHistoricos.length > 0,
          hasNotificado: notified.length > 0,
          compensado: compensadoEnMes(prop.id, mes + 1, anio),
          today: now,
        });
        status = estadoCalendario.status ?? "pendiente";
        deuda = estadoCalendario.deuda;
        inconsistente = estadoCalendario.inconsistente;
      }

      return {
        property: prop,
        inquilinos: propInquilinos,
        pagos: propertyPagos,
        totalCobrado: totalCobradoReal,
        totalHistorico,
        rentaEsperada: status === "no_gestionado" ? 0 : rentaEsperada,
        status,
        confirmed: confirmedReales,
        historicos: confirmedHistoricos,
        notified,
        deuda,
        inconsistente,
        esProrrata: esperado?.esProrrata,
        diasOcupados: esperado?.diasOcupados,
        diasMes: esperado?.diasMes,
        rentaMensualCompleta: rentaMensualProp,
      };
    });

  const totalCobrado = propertyData.reduce((s, d) => s + d.totalCobrado, 0);
  const totalEsperado = propertyData.reduce((s, d) => s + (d.rentaEsperada || 0), 0);

  const statusConfig = {
    pagado: { icon: <Check size={14} />, label: "Cobrado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    parcial: { icon: <AlertTriangle size={14} />, label: "Pago parcial", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
    notificado: { icon: <Clock size={14} />, label: "Notificado", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    pendiente: { icon: <AlertTriangle size={14} />, label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    impago: { icon: <X size={14} />, label: "Impago", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    historico: { icon: <Clock size={14} />, label: "Histórico", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    no_gestionado: { icon: <Clock size={14} />, label: "No gestionado", color: "bg-muted text-muted-foreground" },
  };

  const handlePropertyAction = (propertyId: string) => {
    onOpenChange(false);
    if (onPropertyRentClick) {
      onPropertyRentClick(propertyId);
    } else {
      onPropertyClick?.(propertyId);
    }
  };

  const handleRegistrarCobro = (propertyId: string, inquilinoId: string) => {
    onOpenChange(false);
    onRegistrarCobro?.(propertyId, inquilinoId, mes, anio);
  };

  // Split into paid and unpaid
   const managedItems = propertyData.filter(d => d.status !== "no_gestionado");
   const paidItems = managedItems.filter(d => d.status === "pagado" || d.status === "historico");
   const unpaidItems = managedItems.filter(d => d.status !== "pagado" && d.status !== "historico");

  const renderPropertyHeader = (property: Property, inqs: Inquilino[], sc: typeof statusConfig["pagado"]) => (
    <div className="flex items-center justify-between w-full overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Home size={14} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold block truncate max-w-full">{property.nombre_interno}</span>
          {property.direccion_completa && (
            <span className="text-[11px] text-muted-foreground block truncate max-w-full">{property.direccion_completa}</span>
          )}
          <span className="text-[11px] text-muted-foreground block truncate max-w-full">
            {inqs.map(i => [i.nombre, i.apellidos].filter(Boolean).join(" ")).join(", ") || "—"}
          </span>
        </div>
      </div>
      <Badge className={`text-[10px] gap-1 shrink-0 ml-2 ${sc.color}`}>
        {sc.icon} {sc.label}
      </Badge>
    </div>
  );

  const renderPropertyDetails = (data: typeof propertyData[0]) => {
    const { property, inquilinos: inqs, rentaEsperada, status, confirmed, historicos, notified, deuda, totalCobrado, totalHistorico, inconsistente } = data;
    const mainInquilino = inqs[0];
    const compsMes = compensacionesEnMes(property.id, mes + 1, anio);
    const renderCompensaciones = () => {
      if (compsMes.length === 0) return null;
      return (
        <div className="mt-1 space-y-1">
          {compsMes.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-[11px] bg-background/60 rounded-md px-2 py-1 border border-border/50">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">
                  Compensado · {MOTIVO_LABELS[c.motivo] || c.motivo}
                </span>
                {c.descripcion && (
                  <p className="text-muted-foreground truncate">{c.descripcion}</p>
                )}
              </div>
              <span className="font-medium text-foreground shrink-0">
                {formatImporte(Number(c.importe || 0))}€
              </span>
            </div>
          ))}
        </div>
      );
    };
    return (
      <>
        {inconsistente && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-md px-2 py-1">
            <AlertTriangle size={12} /> Datos mezclados: hay cobro real e histórico para este mes. Revisa los registros.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Renta: </span>
            <span className="font-medium">{rentaEsperada ? `${formatImporte(rentaEsperada)}€` : "—"}</span>
            {data.esProrrata && data.diasOcupados != null && (
              <span className="ml-1 text-primary text-[10px]">({data.diasOcupados}d prorrata)</span>
            )}
          </div>
          {status === "parcial" && deuda > 0 && (
            <div>
              <span className="text-muted-foreground">Deuda: </span>
              <span className="font-medium text-yellow-700 dark:text-yellow-300">{formatImporte(deuda)}€</span>
            </div>
          )}
        </div>

        {/* Parcial: paid something but not full rent */}
        {status === "parcial" && confirmed.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-2 space-y-1">
            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium mb-1">
              Cobrado {formatImporte(totalCobrado)}€ de {rentaEsperada ? `${formatImporte(rentaEsperada)}€` : "—"} — faltan {deuda > 0 ? `${formatImporte(deuda)}€` : "—"}
            </p>
            {confirmed.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-yellow-700 dark:text-yellow-300 font-medium">
                  {p.importe_pagado ? `${formatImporte(Number(p.importe_pagado))}€` : "Confirmado"}
                </span>
                <span className="text-muted-foreground">
                  {p.tipo_pago || "—"} · {p.propietario_confirmado_at ? new Date(p.propietario_confirmado_at).toLocaleDateString("es-ES") : ""}
                </span>
              </div>
            ))}
            {confirmed[0]?.notas_acuerdo && (
              <p className="text-[11px] text-muted-foreground italic mt-1">📝 {confirmed[0].notas_acuerdo}</p>
            )}
            {renderCompensaciones()}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs gap-1 w-full border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              onClick={(e) => {
                e.stopPropagation();
                if (mainInquilino) handleRegistrarCobro(property.id, mainInquilino.id);
                else handlePropertyAction(property.id);
              }}
            >
              <Euro size={12} /> Registrar cobro restante
            </Button>
          </div>
        )}

        {status === "pagado" && confirmed.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 space-y-1">
            {confirmed.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  {p.importe_pagado ? `${formatImporte(Number(p.importe_pagado))}€` : "Confirmado"}
                </span>
                <span className="text-muted-foreground">
                  {p.tipo_pago || "—"} · {p.propietario_confirmado_at ? new Date(p.propietario_confirmado_at).toLocaleDateString("es-ES") : ""}
                </span>
              </div>
            ))}
            {confirmed[0]?.notas_acuerdo && (
              <p className="text-[11px] text-muted-foreground italic mt-1">📝 {confirmed[0].notas_acuerdo}</p>
            )}
            {renderCompensaciones()}
          </div>
        )}

        {status === "historico" && historicos.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 space-y-1">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              Mes cubierto por histórico reconstruido — no es un cobro real gestionado por CapitalRent.
            </p>
            {historicos.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {p.importe_pagado ? `${formatImporte(Number(p.importe_pagado))}€` : "Regularizado"}
                </span>
                <span className="text-muted-foreground">histórico</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Total histórico: {formatImporte(totalHistorico)}€</p>
          </div>
        )}

        {status === "notificado" && notified.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2 text-xs text-orange-700 dark:text-orange-300">
            <p>Inquilino notificó el pago — pendiente de ratificación</p>
            {notified[0]?.importe_pagado && (
              <span className="font-medium">({formatImporte(Number(notified[0].importe_pagado))}€)</span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs gap-1 w-full border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={(e) => {
                e.stopPropagation();
                if (mainInquilino) handleRegistrarCobro(property.id, mainInquilino.id);
                else handlePropertyAction(property.id);
              }}
            >
              <Check size={12} /> Ratificar pago
            </Button>
          </div>
        )}

        {(status === "pendiente" || status === "impago") && (
          <div className={`rounded-lg p-2 text-xs ${status === "impago" ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"}`}>
            <p className="mb-2">{status === "impago" ? "No se ha registrado ningún cobro para este mes" : "Aún no se ha registrado el cobro"}</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`text-xs gap-1 w-full ${status === "impago" ? "border-red-300 text-red-700 hover:bg-red-100" : "border-amber-300 text-amber-700 hover:bg-amber-100"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mainInquilino) handleRegistrarCobro(property.id, mainInquilino.id);
                  else handlePropertyAction(property.id);
                }}
              >
                <Euro size={12} /> Registrar cobro
              </Button>
              {status === "impago" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 w-full border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSeguroDialogProperty(property);
                  }}
                >
                  <ShieldCheck size={12} /> Contactar seguro de impago
                </Button>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro size={18} className="text-primary" />
            Rentas — {MESES[mes]} {anio}
          </DialogTitle>
          <DialogDescription>
            Pulsa sobre un activo para ver sus rentas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Cobrado: </span>
              <span className="font-bold text-emerald-600">{formatImporte(totalCobrado)}€</span>
            </div>
            {totalEsperado > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Esperado: </span>
                <span className="font-semibold">{formatImporte(totalEsperado)}€</span>
              </div>
            )}
          </div>

          {propertyData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay activos alquilados este mes.</p>
          ) : (
            <div className="space-y-3">
              {/* Unpaid items – always expanded */}
              {unpaidItems.map((data) => {
                const sc = statusConfig[data.status];
                return (
                  <div
                    key={data.property.id}
                    className="border border-border rounded-xl p-3 space-y-2 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                    onClick={() => handlePropertyAction(data.property.id)}
                  >
                    <div className="flex items-center justify-between">
                      {renderPropertyHeader(data.property, data.inquilinos, sc)}
                      <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-1" />
                    </div>
                    {renderPropertyDetails(data)}
                  </div>
                );
              })}

              {/* Paid items – collapsible accordion */}
              {paidItems.length > 0 && (
                <Accordion type="multiple" className="space-y-2">
                  {paidItems.map((data) => {
                    const sc = statusConfig.pagado;
                    return (
                      <AccordionItem key={data.property.id} value={data.property.id} className="border border-border rounded-xl overflow-hidden [&[data-state=open]]:shadow-md transition-all">
                        <div className="flex items-center">
                          <div
                            className="flex-1 min-w-0 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                            onClick={() => handlePropertyAction(data.property.id)}
                          >
                            {renderPropertyHeader(data.property, data.inquilinos, sc)}
                          </div>
                          <AccordionTrigger className="p-3 pl-0 [&>svg]:h-3.5 [&>svg]:w-3.5 hover:no-underline" />
                        </div>
                        <AccordionContent className="px-3 pb-3">
                          <div className="space-y-2">
                            {renderPropertyDetails(data)}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Insurance contact dialog */}
    {seguroDialogProperty && (
      <ContactoSeguroImpagoDialog
        open={!!seguroDialogProperty}
        onOpenChange={(open) => { if (!open) setSeguroDialogProperty(null); }}
        property={seguroDialogProperty}
        inquilinos={inquilinos}
        pagos={pagos}
        contratos={contratos}
        anio={anio}
      />
    )}
    </>
  );
}
