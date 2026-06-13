import { useState, useMemo } from "react";
import { CheckCircle2, Euro, AlertTriangle, XCircle, Pencil, Trash2, ArrowLeft, Plus, TrendingUp, CheckSquare, Square, ListChecks, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import { useRentaActualizaciones, type RentaActualizacion } from "@/hooks/useRentaActualizaciones";
import { calcularImporteEsperado, calcularDeudaReal } from "@/lib/rentaUtils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_PAGO_OPTIONS = [
  { value: "total", label: "Pago total del mes" },
  { value: "parcial", label: "Pago parcial" },
  { value: "deuda_antigua", label: "Pago de deuda antigua" },
  { value: "adelanto", label: "Adelanto de renta" },
  { value: "acuerdo", label: "Acuerdo especial" },
];

const TIPO_PAGO_LABELS: Record<string, string> = Object.fromEntries(TIPO_PAGO_OPTIONS.map(o => [o.value, o.label]));

interface Props {
  pagos: PagoRenta[];
  rentaMensual?: number | null;
  onBack: () => void;
  propertyName: string;
  propertyId: string;
  inquilinoId?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  /** [H2.9] Fecha desde la que CapitalRent controla pagos. Periodos anteriores quedan fuera del alcance. */
  fechaInicioControl?: string | null;
  userId: string;
  onUpdatePago: (pagoId: string, datos: { importe_pagado?: number; tipo_pago?: string; notas_acuerdo?: string | null; propietario_confirmado?: boolean }) => Promise<void>;
  onDeletePago: (pagoId: string) => Promise<void>;
  onConfirmarPago: (propertyId: string, inquilinoId: string, mes: number, anio: number, datos: any, ownerId: string) => Promise<void>;
  onImportHistorical?: () => void;
}

type MonthKey = `${number}-${number}`;
const toKey = (mes: number, anio: number): MonthKey => `${mes}-${anio}`;

const PagosHistorial = ({ pagos, rentaMensual, onBack, propertyName, propertyId, inquilinoId, fechaInicio, fechaFin, fechaInicioControl, userId, onUpdatePago, onDeletePago, onConfirmarPago, onImportHistorical }: Props) => {
  const [editingPago, setEditingPago] = useState<PagoRenta | null>(null);
  const [addingMonth, setAddingMonth] = useState<{ mes: number; anio: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ importe: "", tipo_pago: "total", notas: "" });

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<MonthKey>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"pay" | "edit">("pay");
  const [bulkForm, setBulkForm] = useState({ importe: "", tipo_pago: "total", notas: "" });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const { actualizaciones } = useRentaActualizaciones(propertyId);

  const getRentForMonth = (mes: number, anio: number): number | null => {
    const date = new Date(anio, mes - 1, 15);
    let rent: number | null = rentaMensual ?? null;
    for (const act of actualizaciones) {
      if (new Date(act.fecha_efectiva) <= date) {
        rent = act.importe_nuevo;
      }
    }
    return rent;
  };

  const grouped = useMemo(() => {
    const map = new Map<number, PagoRenta[]>();
    pagos.forEach(p => {
      if (!map.has(p.anio)) map.set(p.anio, []);
      map.get(p.anio)!.push(p);
    });
    map.forEach((entries) => entries.sort((a, b) => a.mes - b.mes));
    if (fechaInicio) {
      const startYear = new Date(fechaInicio).getFullYear();
      const now = new Date();
      for (let y = startYear; y <= now.getFullYear(); y++) {
        if (!map.has(y)) map.set(y, []);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }, [pagos, fechaInicio]);

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const startMonth = fechaInicio ? new Date(fechaInicio).getMonth() + 1 : 1;
  const startYear = fechaInicio ? new Date(fechaInicio).getFullYear() : anioActual;

  // Get valid (non-future, non-before-start) months for a year
  const getValidMonthsForYear = (anio: number): number[] => {
    const months: number[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      const isFuture = anio > anioActual || (anio === anioActual && mes > mesActual);
      const isBeforeStart = anio < startYear || (anio === startYear && mes < startMonth);
      if (!isFuture && !isBeforeStart) months.push(mes);
    }
    return months;
  };

  const toggleSelect = (key: MonthKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleYear = (anio: number) => {
    const validMonths = getValidMonthsForYear(anio);
    const keys = validMonths.map(m => toKey(m, anio));
    const allSelected = keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const openEdit = (pago: PagoRenta) => {
    setEditingPago(pago);
    setForm({
      importe: pago.importe_pagado?.toString() || getRentForMonth(pago.mes, pago.anio)?.toString() || "",
      tipo_pago: pago.tipo_pago || "total",
      notas: pago.notas_acuerdo || "",
    });
  };

  const openAdd = (mes: number, anio: number) => {
    const rent = getRentForMonth(mes, anio);
    const esperado = rent ? calcularImporteEsperado(rent, mes, anio, fechaInicio, fechaFin, undefined, fechaInicioControl) : null;
    setAddingMonth({ mes, anio });
    setForm({
      importe: (esperado?.importe ?? rent ?? rentaMensual)?.toString() || "",
      tipo_pago: "total",
      notas: "",
    });
  };

  const handleSave = async () => {
    if (!editingPago) return;
    const importe = parseFloat(form.importe);
    if (isNaN(importe) || importe <= 0) return;
    setSaving(true);
    try {
      await onUpdatePago(editingPago.id, {
        importe_pagado: importe,
        tipo_pago: form.tipo_pago,
        notas_acuerdo: form.notas || null,
        propietario_confirmado: true,
      });
      setEditingPago(null);
    } finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!addingMonth || !inquilinoId) return;
    const importe = parseFloat(form.importe);
    if (isNaN(importe) || importe <= 0) return;
    setSaving(true);
    try {
      await onConfirmarPago(propertyId, inquilinoId, addingMonth.mes, addingMonth.anio, {
        importe_pagado: importe,
        tipo_pago: form.tipo_pago,
        notas_acuerdo: form.notas || undefined,
      }, userId);
      setAddingMonth(null);
    } finally { setSaving(false); }
  };

  // Bulk actions
  const openBulkPay = () => {
    setBulkAction("pay");
    setBulkForm({ importe: "", tipo_pago: "total", notas: "" });
    setBulkDialogOpen(true);
  };

  const openBulkEdit = () => {
    setBulkAction("edit");
    setBulkForm({ importe: "", tipo_pago: "total", notas: "" });
    setBulkDialogOpen(true);
  };

  const handleBulkSave = async () => {
    if (!inquilinoId) return;
    setSaving(true);
    try {
      for (const key of selected) {
        const [mesStr, anioStr] = key.split("-");
        const mes = parseInt(mesStr);
        const anio = parseInt(anioStr);
        const pago = pagos.find(p => p.mes === mes && p.anio === anio);

        const rent = getRentForMonth(mes, anio);
        const esperado = rent ? calcularImporteEsperado(rent, mes, anio, fechaInicio, fechaFin, undefined, fechaInicioControl) : null;

        const importe = bulkForm.importe
          ? parseFloat(bulkForm.importe)
          : (esperado?.importe || rent || rentaMensual || 0);

        if (pago) {
          // Update existing
          await onUpdatePago(pago.id, {
            importe_pagado: importe,
            tipo_pago: bulkForm.tipo_pago,
            notas_acuerdo: bulkForm.notas || null,
            propietario_confirmado: true,
          });
        } else {
          // Create new
          await onConfirmarPago(propertyId, inquilinoId, mes, anio, {
            importe_pagado: importe,
            tipo_pago: bulkForm.tipo_pago,
            notas_acuerdo: bulkForm.notas || undefined,
          }, userId);
        }
      }
      setBulkDialogOpen(false);
      exitSelectMode();
    } finally { setSaving(false); }
  };

  const handleBulkDelete = async () => {
    setSaving(true);
    try {
      for (const key of selected) {
        const [mesStr, anioStr] = key.split("-");
        const mes = parseInt(mesStr);
        const anio = parseInt(anioStr);
        const pago = pagos.find(p => p.mes === mes && p.anio === anio);
        if (pago) await onDeletePago(pago.id);
      }
      setBulkDeleteConfirm(false);
      exitSelectMode();
    } finally { setSaving(false); }
  };

  const selectedWithPagos = Array.from(selected).filter(key => {
    const [m, a] = key.split("-");
    return pagos.some(p => p.mes === parseInt(m) && p.anio === parseInt(a));
  });

  return (
    <div>
      <div className="mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {propertyName} — Historial de rentas
            </h2>
            {rentaMensual && (
              <p className="text-sm text-muted-foreground mt-1">
                Renta mensual: {rentaMensual} €
                {actualizaciones.length > 0 && (
                  <span className="ml-2 text-primary">
                    (actual: {actualizaciones[actualizaciones.length - 1].importe_nuevo}€)
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exitSelectMode}>
                Cancelar selección
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectMode(true)}>
                <ListChecks size={14} /> Seleccionar
              </Button>
            )}
            {onImportHistorical && inquilinoId && fechaInicio && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onImportHistorical}>
                <TrendingUp size={14} /> Importar historial
              </Button>
            )}
          </div>
        </div>

        {/* Rent updates timeline */}
        {actualizaciones.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actualizaciones.map(act => (
              <div key={act.id} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary">
                <TrendingUp size={10} />
                {new Date(act.fecha_efectiva).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}:
                {act.importe_anterior}€ → {act.importe_nuevo}€
                <span className="text-muted-foreground capitalize">({act.motivo})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="sticky top-[var(--nav-height)] z-20 mb-4 bg-card border border-primary/30 rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {selected.size} mes{selected.size > 1 ? "es" : ""} seleccionado{selected.size > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={openBulkPay}>
              <CheckCircle2 size={14} /> Marcar pagados
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openBulkEdit}>
              <Pencil size={14} /> Editar
            </Button>
            {selectedWithPagos.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No hay registros de pagos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([anio, entries]) => {
            const validMonths = getValidMonthsForYear(anio);
            const yearKeys = validMonths.map(m => toKey(m, anio));
            const allYearSelected = yearKeys.length > 0 && yearKeys.every(k => selected.has(k));
            const someYearSelected = yearKeys.some(k => selected.has(k));

            return (
              <div key={anio} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">{anio}</h3>
                  {selectMode && validMonths.length > 0 && (
                    <button
                      onClick={() => toggleYear(anio)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {allYearSelected ? (
                        <CheckSquare size={14} className="text-primary" />
                      ) : (
                        <Square size={14} className={someYearSelected ? "text-primary/50" : ""} />
                      )}
                      Seleccionar año
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {MESES.map((mesName, idx) => {
                    const mes = idx + 1;
                    const pago = entries.find(e => e.mes === mes);
                    const isFuture = anio > anioActual || (anio === anioActual && mes > mesActual);
                    const isCurrent = anio === anioActual && mes === mesActual;
                    const isBeforeStart = anio < startYear || (anio === startYear && mes < startMonth);
                    // [H2.9] Mes anterior a fecha_inicio_control → fuera del alcance de CapitalRent.
                    let isFueraDeControl = false;
                    if (fechaInicioControl) {
                      const fc = new Date(fechaInicioControl);
                      const ctrlYM = fc.getFullYear() * 12 + fc.getMonth();
                      const thisYM = anio * 12 + (mes - 1);
                      if (thisYM < ctrlYM) isFueraDeControl = true;
                    }
                    const effectiveRent = getRentForMonth(mes, anio);
                    const key = toKey(mes, anio);
                    const isSelected = selected.has(key);
                    const esperado = effectiveRent
                      ? calcularImporteEsperado(effectiveRent, mes, anio, fechaInicio, fechaFin, undefined, fechaInicioControl)
                      : null;
                    const importeEsperadoMes = esperado?.importe ?? 0;

                    if (isFuture || isBeforeStart) {
                      return (
                        <div key={mes} className="rounded-xl border border-border/50 p-3 opacity-40">
                          <p className="text-xs font-medium text-muted-foreground">{mesName}</p>
                        </div>
                      );
                    }

                    // [H2.9] Periodos fuera del control: sin color, sin importe, sin estado.
                    if (isFueraDeControl) {
                      return (
                        <div
                          key={mes}
                          className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-3"
                          title="Periodo no gestionado por CapitalRent"
                        >
                          <p className="text-xs font-medium text-muted-foreground">{mesName}</p>
                          <p className="text-[10px] text-muted-foreground/70 italic">No gestionado</p>
                        </div>
                      );
                    }

                    // Outside contract range
                    if (importeEsperadoMes === 0 && esperado?.esProrrata) {
                      return (
                        <div key={mes} className="rounded-xl border border-border/50 p-3 opacity-50">
                          <p className="text-xs font-medium text-muted-foreground">{mesName}</p>
                          <p className="text-[10px] text-muted-foreground">Sin contrato</p>
                        </div>
                      );
                    }

                    const confirmed = pago?.propietario_confirmado;
                    const tenantNotified = pago?.inquilino_notificado;
                    const importePagado = confirmed ? Number(pago?.importe_pagado || 0) : 0;

                    // Proration-aware debt calculation
                    const deudaInfo = confirmed && importeEsperadoMes > 0
                      ? calcularDeudaReal(importeEsperadoMes, importePagado)
                      : null;
                    const isPartial = deudaInfo?.estado === "parcial";
                    const isExcess = deudaInfo?.estado === "exceso";
                    const deudaMes = deudaInfo?.deuda ?? (!confirmed && importeEsperadoMes ? importeEsperadoMes : 0);

                    let statusColor = "border-red-500/30 bg-red-500/5";
                    let statusIcon = <XCircle className="w-4 h-4 text-red-500" />;
                    let statusLabel = "Sin pago";

                    if (confirmed && !isPartial) {
                      statusColor = "border-emerald-500/30 bg-emerald-500/5";
                      statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                      statusLabel = isExcess ? `Pagado (+${deudaInfo!.exceso}€)` : "Pagado";
                    } else if (isPartial) {
                      statusColor = "border-yellow-500/30 bg-yellow-500/5";
                      statusIcon = <AlertTriangle className="w-4 h-4 text-yellow-600" />;
                      statusLabel = `Parcial — deuda ${deudaMes.toLocaleString("es-ES")}€`;
                    } else if (isCurrent && now.getDate() <= 10) {
                      statusColor = "border-amber-400/30 bg-amber-400/5";
                      statusIcon = <Euro className="w-4 h-4 text-amber-600" />;
                      statusLabel = "Pendiente";
                    } else if (tenantNotified) {
                      statusColor = "border-amber-400/30 bg-amber-400/5";
                      statusIcon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
                      statusLabel = "Por confirmar";
                    }

                    const handleClick = () => {
                      if (selectMode) {
                        toggleSelect(key);
                      } else {
                        if (pago) openEdit(pago);
                        else if (inquilinoId) openAdd(mes, anio);
                      }
                    };

                    return (
                      <div
                        key={mes}
                        className={cn(
                          "rounded-xl border p-3 transition-all group relative cursor-pointer",
                          statusColor,
                          isCurrent && !selectMode && "ring-2 ring-primary/20",
                          isSelected && "ring-2 ring-primary shadow-md"
                        )}
                        onClick={handleClick}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            {selectMode && (
                              isSelected
                                ? <CheckSquare size={14} className="text-primary shrink-0" />
                                : <Square size={14} className="text-muted-foreground shrink-0" />
                            )}
                            <p className="text-xs font-medium text-foreground">{mesName}</p>
                          </div>
                          {!selectMode && (
                            <div className="flex items-center gap-1">
                              {pago && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); openEdit(pago); }}
                                  >
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar registro de pago?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Se eliminará el registro de {mesName} {anio}. Podrás volver a confirmarlo después.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeletePago(pago.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              {!pago && (
                                <div className="flex items-center gap-1">
                                  {statusIcon}
                                  {inquilinoId && (
                                    <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <p className={cn(
                          "text-[10px] font-medium",
                          confirmed && !isPartial ? "text-emerald-600" : isPartial ? "text-yellow-600" : tenantNotified ? "text-amber-600" : "text-red-500"
                        )}>
                          {statusLabel}
                        </p>
                        {confirmed && pago?.importe_pagado && (
                          <p className="text-xs text-foreground font-medium mt-1">{pago.importe_pagado} €</p>
                        )}
                        {!pago && importeEsperadoMes > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {esperado?.esProrrata
                              ? `Prorrata: ${importeEsperadoMes}€ (${esperado.diasOcupados}d)`
                              : `Renta: ${importeEsperadoMes}€`
                            }
                          </p>
                        )}
                        {confirmed && pago?.tipo_pago && (
                          <p className="text-[10px] text-muted-foreground">
                            {TIPO_PAGO_LABELS[pago.tipo_pago] || pago.tipo_pago}
                          </p>
                        )}
                        {pago?.notas_acuerdo && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={pago.notas_acuerdo}>
                            {pago.notas_acuerdo}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single edit dialog */}
      <Dialog open={!!editingPago} onOpenChange={(open) => { if (!open) setEditingPago(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Editar pago — {editingPago ? `${MESES[editingPago.mes - 1]} ${editingPago.anio}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Importe pagado (€) *</label>
              <Input type="number" step="0.01" value={form.importe} onChange={e => setForm(p => ({ ...p, importe: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de pago</label>
              <Select value={form.tipo_pago} onValueChange={v => setForm(p => ({ ...p, tipo_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_PAGO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
              <Textarea placeholder="Notas adicionales..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.importe}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single add dialog */}
      <Dialog open={!!addingMonth} onOpenChange={(open) => { if (!open) setAddingMonth(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Registrar pago — {addingMonth ? `${MESES[addingMonth.mes - 1]} ${addingMonth.anio}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Importe pagado (€) *</label>
              <Input type="number" step="0.01" value={form.importe} onChange={e => setForm(p => ({ ...p, importe: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de pago</label>
              <Select value={form.tipo_pago} onValueChange={v => setForm(p => ({ ...p, tipo_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_PAGO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
              <Textarea placeholder="Notas adicionales..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleAdd} disabled={saving || !form.importe}>{saving ? "Guardando..." : "Registrar pago"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit/pay dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "pay" ? "Marcar como pagados" : "Editar selección"} — {selected.size} mes{selected.size > 1 ? "es" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {bulkAction === "pay"
                ? "Se registrarán como pagados. Si dejas el importe vacío, se usará la renta vigente de cada mes."
                : "Los cambios se aplicarán a todos los meses seleccionados."
              }
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Importe (€) {bulkAction === "pay" && <span className="italic">· vacío = renta vigente</span>}</label>
              <Input type="number" step="0.01" value={bulkForm.importe} onChange={e => setBulkForm(p => ({ ...p, importe: e.target.value }))} placeholder={rentaMensual ? `${rentaMensual}` : ""} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de pago</label>
              <Select value={bulkForm.tipo_pago} onValueChange={v => setBulkForm(p => ({ ...p, tipo_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_PAGO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
              <Textarea placeholder="Notas adicionales..." value={bulkForm.notas} onChange={e => setBulkForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleBulkSave} disabled={saving}>
              {saving ? "Aplicando..." : `Aplicar a ${selected.size} mes${selected.size > 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedWithPagos.length} registro(s) de pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los registros de pago de los meses seleccionados que ya tienen datos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PagosHistorial;
