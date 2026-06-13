import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveFechasContrato, resolveRentaEsperada } from "@/lib/rentaUtils";
import { getContratoStatus, findActiveContrato } from "@/lib/contratoStatusUtils";
import { Euro, Eye, AlertTriangle, Users, Trash2, Plus, Pencil, MessageSquare, Receipt, Wallet, FolderOpen, Link2, ScrollText, CalendarDays, ChevronUp, ChevronDown, Star } from "lucide-react";
import InvitarDesdeViviendaDialog from "./InvitarDesdeViviendaDialog";
import GestorAdminSections from "./GestorAdminSections";
import FichaCompletitudBar from "./ficha/FichaCompletitudBar";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { Contrato } from "@/hooks/useContratos";
import RentPaymentWidget from "./RentPaymentWidget";
import { useAuth } from "@/hooks/useAuth";
import { usePagoCompensaciones } from "@/hooks/usePagoCompensaciones";

const TIPOS_ALQUILER = [
  { value: "larga_duracion", label: "Larga duración" },
  { value: "vacacional", label: "Vacacional" },
  { value: "explotacion", label: "Explotación" },
];

type PropertyStatus = "reformas" | "libre" | "alquilada" | "okupada" | "sin uso" | "uso propio" | "inqui-okupada";

const statusConfig: Record<string, { label: string; className: string }> = {
  reformas: { label: "Reformas", className: "bg-amber-100 text-amber-800" },
  libre: { label: "Libre", className: "bg-emerald-100 text-emerald-800" },
  alquilada: { label: "Alquilada", className: "bg-sky-100 text-sky-800" },
  okupada: { label: "Okupada", className: "bg-red-100 text-red-800" },
  "sin uso": { label: "Sin uso", className: "bg-zinc-100 text-zinc-600" },
  "uso propio": { label: "Uso propio", className: "bg-violet-100 text-violet-800" },
  "inqui-okupada": { label: "Inqui-okupada", className: "bg-orange-100 text-orange-800" },
};

interface PropertyCardProps {
  property: Property;
  inquilinos: Inquilino[];
  incidenciasCount: number;
  onView: () => void;
  onDelete: () => void;
  onAddInquilino: () => void;
  onEditInquilino: (inq: Inquilino) => void;
  onDeleteInquilino: (inq: Inquilino) => void;
  onViewInquilino: (inq: Inquilino) => void;
  onUpdateTipoAlquiler: (propertyId: string, tipo: string | null) => void;
  onIncidencias: () => void;
  onHistorial: () => void;
  pagoActual?: PagoRenta;
  onConfirmarPago?: (datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }) => Promise<void>;
  onPagosHistorial?: () => void;
  onMarkAlDia?: () => void;
  allInquilinos?: Inquilino[];
  allPagos?: PagoRenta[];
  eventos?: PropertyEvento[];
  onCreateEvento?: (data: any) => Promise<any>;
  onUpdateEvento?: (id: string, data: any) => Promise<void>;
  onDeleteEvento?: (id: string) => Promise<void>;
  contratos?: Contrato[];
  onViewContrato?: (property: Property) => void;
  onViewDocumentacion?: (property: Property) => void;
  onUpdateProperty?: (id: string, data: Partial<Property>) => Promise<void>;
  onReorderInquilinos?: (orderedIds: string[]) => Promise<void>;
  onAbrirFicha?: (property: Property) => void;
}

const PropertyCard = ({ property, inquilinos, incidenciasCount, onView, onDelete, onAddInquilino, onEditInquilino, onDeleteInquilino, onViewInquilino, onUpdateTipoAlquiler, onIncidencias, onHistorial, pagoActual, onConfirmarPago, onPagosHistorial, onMarkAlDia, allInquilinos, allPagos, eventos, onCreateEvento, onUpdateEvento, onDeleteEvento, contratos, onViewContrato, onViewDocumentacion, onUpdateProperty, onReorderInquilinos, onAbrirFicha }: PropertyCardProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { compensadoEnMes } = usePagoCompensaciones({ userId: user?.id, asOwner: true });
  const _now = new Date();
  const compensadoMesActual = compensadoEnMes(property.id, _now.getMonth() + 1, _now.getFullYear());
  const propertyInquilinos = inquilinos
    .filter((i) => i.property_id === property.id)
    .sort((a, b) => {
      const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
      const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const firstRealId = propertyInquilinos.find(i => i.rol_inquilino !== "avalista")?.id;
  const hasRealTenants = propertyInquilinos.some((i) => i.rol_inquilino !== "avalista");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteInquilino, setInviteInquilino] = useState<Inquilino | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(property.nombre_interno);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const saveName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== property.nombre_interno && onUpdateProperty) {
      onUpdateProperty(property.id, { nombre_interno: trimmed } as any);
    } else {
      setNameValue(property.nombre_interno);
    }
    setEditingName(false);
  };

  const effectiveEstado = hasRealTenants ? "alquilada" : (property.estado ?? "libre");
  const status = statusConfig[effectiveEstado] ?? statusConfig.libre;

  // Show "Al día" for properties < 90 days old with tenants who have older entry dates
  const showAlDia = useMemo(() => {
    if (!onMarkAlDia || !allPagos) return false;
    const propertyAge = (Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (propertyAge > 90) return false;
    return propertyInquilinos.some(i => {
      if (!i.fecha_entrada || i.rol_inquilino === "avalista") return false;
      const entryAge = (Date.now() - new Date(i.fecha_entrada).getTime()) / (1000 * 60 * 60 * 24);
      return entryAge > 60;
    });
  }, [onMarkAlDia, allPagos, property.created_at, propertyInquilinos]);

  // Check if there are unpaid months (simple debt check)
  const hasDebt = useMemo(() => {
    if (!hasRealTenants || !allPagos) return false;
    const now = new Date();
    const currentMonth = now.getFullYear() * 12 + now.getMonth();
    const realTenants = propertyInquilinos.filter(i => i.rol_inquilino !== "avalista");
    const rentaResuelta = resolveRentaEsperada(property.id, inquilinos, contratos || []);
    if (!rentaResuelta || realTenants.length === 0) return false;

    for (let m = currentMonth - 5; m <= currentMonth; m++) {
      const yr = Math.floor(m / 12);
      const mo = m % 12;
      const anyActive = realTenants.some(inq => {
        const entrada = inq.fecha_entrada ? new Date(inq.fecha_entrada) : null;
        if (!entrada) return false;
        const em = entrada.getFullYear() * 12 + entrada.getMonth();
        if (m < em) return false;
        const salida = inq.fecha_salida ? new Date(inq.fecha_salida) : null;
        if (salida && m > salida.getFullYear() * 12 + salida.getMonth()) return false;
        return true;
      });
      if (!anyActive) continue;
      const hasPago = allPagos.some(p => p.property_id === property.id && p.mes === mo + 1 && p.anio === yr && p.propietario_confirmado);
      if (!hasPago) return true;
    }
    return false;
  }, [hasRealTenants, allPagos, property.id, propertyInquilinos, inquilinos, contratos]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: Name + Status + Tipo alquiler */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameValue(property.nombre_interno); setEditingName(false); } }}
                className="text-base font-semibold text-foreground bg-transparent border-b-2 border-primary outline-none px-0 py-0 min-w-0 max-w-[200px]"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-foreground">
                  {property.nombre_interno}
                </h3>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  title="Renombrar activo"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
              {status.label}
            </span>
            {effectiveEstado !== (property.estado ?? "libre") && (
              <span className="text-xs text-muted-foreground italic" title="Estado calculado automáticamente por la presencia de inquilinos">
                (auto)
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {property.direccion_completa || "Sin dirección"}
          </p>
        </div>

        {/* Alerts summary */}
        <div className="flex items-center gap-2 shrink-0">
          {hasDebt && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
              Deuda
            </span>
          )}
          {incidenciasCount > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              {incidenciasCount} incidencia{incidenciasCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Tipo alquiler selector — only when tenants exist */}
      {hasRealTenants && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tipo de alquiler:</span>
          <Select
            value={(property as any).tipo_alquiler || ""}
            onValueChange={(val) => onUpdateTipoAlquiler(property.id, val || null)}
          >
            <SelectTrigger className="min-h-[44px] w-full sm:w-[180px] text-sm">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_ALQUILER.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Ficha completa del activo — acceso prominente */}
      {onAbrirFicha && (
        <div className="mt-4">
          <FichaCompletitudBar
            property={property}
            variant="compact"
            onClick={() => onAbrirFicha(property)}
          />
          <button
            type="button"
            onClick={() => onAbrirFicha(property)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline min-h-[32px]"
          >
            <Pencil size={13} />
            Ver ficha completa del activo
          </button>
        </div>
      )}

      {/* Gestor & Admin de fincas */}
      {onUpdateProperty && (
        <div className="mt-4 pt-4 border-t border-border">
          <GestorAdminSections
            property={property}
            onUpdate={onUpdateProperty}
            onInvite={(role) => { setInviteOpen(true); }}
          />
        </div>
      )}

      {/* Inquilinos */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm mb-2">
          <Users size={14} className="text-muted-foreground" />
          {propertyInquilinos.length > 0 ? (
            <span className="text-foreground font-medium">
              {propertyInquilinos.length} inquilino{propertyInquilinos.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">Sin inquilino</span>
          )}
        </div>

        {propertyInquilinos.length > 0 && (
          <div className="space-y-2 mb-2">
            {propertyInquilinos.map((inq, idx) => {
              const isAvalista = inq.rol_inquilino === "avalista";
              const isPrincipal = !isAvalista && inq.id === firstRealId;
              const move = async (dir: -1 | 1) => {
                if (!onReorderInquilinos) return;
                const arr = [...propertyInquilinos];
                const j = idx + dir;
                if (j < 0 || j >= arr.length) return;
                [arr[idx], arr[j]] = [arr[j], arr[idx]];
                await onReorderInquilinos(arr.map(x => x.id));
              };
              const setAsPrincipal = async () => {
                if (!onReorderInquilinos) return;
                const arr = [inq, ...propertyInquilinos.filter(x => x.id !== inq.id)];
                await onReorderInquilinos(arr.map(x => x.id));
              };
              return (
                <div key={inq.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-secondary/50 rounded-lg px-3 py-3 gap-2">
                  {onReorderInquilinos && propertyInquilinos.length > 1 && (
                    <div className="flex sm:flex-col gap-0.5 shrink-0 self-start">
                      <button type="button" disabled={idx === 0} onClick={move.bind(null, -1)} aria-label="Subir" title="Subir" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30">
                        <ChevronUp size={14} />
                      </button>
                      <button type="button" disabled={idx === propertyInquilinos.length - 1} onClick={move.bind(null, 1)} aria-label="Bajar" title="Bajar" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                  <button
                    className="flex items-center gap-2 min-w-0 text-left hover:text-primary transition-colors flex-1"
                    onClick={() => onViewInquilino(inq)}
                  >
                    <span className="text-sm text-foreground hover:text-primary">
                      {inq.nombre} {inq.apellidos || ""}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      isAvalista
                        ? "bg-amber-100 text-amber-800"
                        : isPrincipal
                          ? "bg-primary/15 text-primary inline-flex items-center gap-1"
                          : "bg-sky-100 text-sky-800"
                    }`}>
                      {isAvalista ? "Avalista" : isPrincipal ? (<><Star size={11} className="fill-current" /> Principal</>) : "Inquilino"}
                    </span>
                  </button>
                  <div className="flex gap-1.5 shrink-0 items-center self-end sm:self-auto">
                    {onReorderInquilinos && !isAvalista && !isPrincipal && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-primary"
                        onClick={setAsPrincipal}
                        title="Marcar como principal"
                        aria-label="Marcar como principal"
                      >
                        <Star size={15} />
                      </Button>
                    )}
                    {!inq.auth_user_id && !isAvalista && (
                      <button
                        onClick={() => { setInviteInquilino(inq); setInviteOpen(true); }}
                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Link2 size={14} />
                        Vincular
                      </button>
                    )}
                    {inq.auth_user_id && !isAvalista && (
                      <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        ✓ Vinculado
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-primary hover:text-primary/80"
                      onClick={() => onEditInquilino(inq)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive">
                          <Trash2 size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar a {inq.nombre}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará de este inmueble. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteInquilino(inq)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onAddInquilino}
          className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg gap-1.5"
        >
          <Plus size={13} />
          Añadir inquilino
        </Button>
      </div>

      {/* Active contract block */}
      {(() => {
        const activeContrato = findActiveContrato(contratos || [], property.id);
        if (!activeContrato) {
          // Only show CTA if property has tenants but no contract
          if (hasRealTenants && onViewContrato) {
            return (
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => onViewContrato(property)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ScrollText size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary">Añadir contrato</p>
                    <p className="text-xs text-muted-foreground">Sube o crea el contrato de arrendamiento</p>
                  </div>
                </button>
              </div>
            );
          }
          return null;
        }

        const statusInfo = getContratoStatus(activeContrato);
        const rentaFormatted = activeContrato.renta_mensual != null
          ? `${Number(activeContrato.renta_mensual).toLocaleString("es-ES")} €/mes`
          : "Sin renta";
        const fechaFinFormatted = activeContrato.fecha_fin
          ? new Date(activeContrato.fecha_fin).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
          : "Sin fecha fin";
        const needsAttention = statusInfo.status === "preaviso_activo" || statusInfo.status === "aviso_interno" || statusInfo.status === "requiere_atencion";

        return (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => onViewContrato?.(property)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left hover:shadow-sm ${
                needsAttention
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  : "border-border hover:border-primary/20 hover:bg-muted/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                needsAttention ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"
              }`}>
                <ScrollText size={16} className={needsAttention ? "text-amber-700 dark:text-amber-400" : "text-primary"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">Contrato activo</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    statusInfo.status === "preaviso_activo" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                    statusInfo.status === "aviso_interno" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" :
                    statusInfo.status === "requiere_atencion" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
                    statusInfo.status === "prorrogado" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" :
                    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  }`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-foreground font-medium flex items-center gap-1">
                    <Euro size={12} className="text-muted-foreground" />
                    {rentaFormatted}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays size={12} />
                    {statusInfo.isProrrogado ? "Prórroga auto." : `Fin: ${fechaFinFormatted}`}
                  </span>
                </div>
                {statusInfo.status === "preaviso_activo" && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                    Estás dentro del plazo de preaviso — gestiona la renovación
                  </p>
                )}
                {statusInfo.status === "aviso_interno" && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                    El plazo de preaviso comienza pronto — revisa el contrato
                  </p>
                )}
              </div>
            </button>
          </div>
        );
      })()}

      {/* Rent payment widget */}
      {hasRealTenants && onConfirmarPago && (
        <RentPaymentWidget
          pagoActual={pagoActual}
          rentaMensual={(() => {
            const activeContrato = (contratos || []).find(c => c.property_id === property.id && !c.archivado && c.estado !== "finalizado" && c.renta_mensual != null);
            return activeContrato?.renta_mensual != null ? Number(activeContrato.renta_mensual) : propertyInquilinos.find(i => i.rol_inquilino !== "avalista")?.renta_mensual;
          })()}
          tenantNotified={pagoActual?.inquilino_notificado || false}
          fechaInicio={resolveFechasContrato(property.id, inquilinos, contratos || []).fechaInicio}
          fechaFin={resolveFechasContrato(property.id, inquilinos, contratos || []).fechaFin}
          compensado={compensadoMesActual}
          onConfirmar={onConfirmarPago}
        />
      )}

      {/* Action buttons — mobile-friendly grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={onView} className="rounded-lg text-sm gap-1.5 min-h-[44px] justify-start">
          <Eye size={15} />
          Ver ficha
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`rounded-lg text-sm gap-1.5 min-h-[44px] justify-start ${
            incidenciasCount > 0
              ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              : ""
          }`}
          onClick={onIncidencias}
        >
          <AlertTriangle size={15} className={incidenciasCount > 0 ? "text-amber-600" : ""} />
          Incidencias {incidenciasCount > 0 && `(${incidenciasCount})`}
        </Button>
        {hasRealTenants && onPagosHistorial && (
          <Button variant="outline" size="sm" className="rounded-lg text-sm gap-1.5 min-h-[44px] justify-start" onClick={onPagosHistorial}>
            <Receipt size={15} />
            Rentas
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg text-sm gap-1.5 min-h-[44px] justify-start"
          onClick={() => navigate(`/finanzas?propertyId=${property.id}`)}
        >
          <Wallet size={15} />
          Cartera
        </Button>
        {onViewDocumentacion && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-sm gap-1.5 min-h-[44px] justify-start"
            onClick={() => onViewDocumentacion(property)}
          >
            <FolderOpen size={15} />
            Documentación
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-lg text-sm gap-1.5 min-h-[44px] justify-start text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30">
              <Trash2 size={15} />
              Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar "{property.nombre_interno}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán todos los datos de este inmueble. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <InvitarDesdeViviendaDialog
        open={inviteOpen}
        onOpenChange={(open) => { setInviteOpen(open); if (!open) setInviteInquilino(null); }}
        property={property}
        inquilinos={inquilinos}
        preselectedInquilino={inviteInquilino}
      />
    </div>
  );
};

export default PropertyCard;
