import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  CalendarDays, Plus, Euro, Wrench, Users, Droplets, Trash2, Clock, CheckCircle2, AlertTriangle, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { InquilinoEvento } from "@/hooks/useInquilinoEventos";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const tipoConfig: Record<string, { label: string; icon: any; color: string }> = {
  recordatorio: { label: "Recordatorio", icon: Clock, color: "bg-amber-500/15 text-amber-600" },
  visita_tecnico: { label: "Visita técnico", icon: Wrench, color: "bg-blue-500/15 text-blue-600" },
  comunidad: { label: "Comunidad", icon: Users, color: "bg-purple-500/15 text-purple-600" },
  suministro: { label: "Suministro", icon: Droplets, color: "bg-cyan-500/15 text-cyan-600" },
  citacion: { label: "Citación", icon: CalendarDays, color: "bg-emerald-500/15 text-emerald-600" },
};

const mesesNombres = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  eventos: InquilinoEvento[];
  onCreateEvento: (data: { titulo: string; descripcion?: string; fecha: string; hora?: string; tipo: string }) => Promise<void>;
  onUpdateEvento: (id: string, data: { titulo?: string; descripcion?: string | null; fecha?: string; hora?: string | null; tipo?: string }) => Promise<void>;
  onDeleteEvento: (id: string) => Promise<void>;
  rentaMensual?: number | null;
  pagoActual?: PagoRenta | null;
  onNotificarPago?: () => Promise<void>;
  numberOfMonths?: number;
}

const CalendarioSection = ({ eventos, onCreateEvento, onUpdateEvento, onDeleteEvento, rentaMensual, pagoActual, onNotificarPago, numberOfMonths = 1 }: Props) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const startMonth = numberOfMonths >= 3 ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) : new Date();
  const [month, setMonth] = useState<Date>(startMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<InquilinoEvento | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [form, setForm] = useState({ titulo: "", descripcion: "", hora: "", tipo: "recordatorio" });

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const isPaid = !!pagoActual?.propietario_confirmado;
  const isNotified = !!pagoActual?.inquilino_notificado;
  const pastPaymentWindow = today.getDate() > 5;

  // Days 1-5: yellow for current month (if still in window) AND always for next month (upcoming payment)
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const paymentWindowMatcher = (date: Date) => {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    if (d < 1 || d > 5) return false;

    // Current month: only if not paid and still within days 1-5
    if (m === currentMonth && y === currentYear && !isPaid && !pastPaymentWindow) return true;

    // Next month: always show as upcoming payment window
    if (m === nextMonth && y === nextMonthYear) return true;

    return false;
  };

  // Dates with events
  const eventDates = useMemo(() => {
    const map = new Map<string, InquilinoEvento[]>();
    eventos.forEach(ev => {
      const key = ev.fecha;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [eventos]);

  const eventDayMatcher = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return eventDates.has(key);
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedEvents = selectedDateStr ? (eventDates.get(selectedDateStr) || []) : [];
  const isCurrentMonthDay = selectedDate
    ? selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear
    : false;

  // Rent status: green=paid, orange=notified pending confirmation, red=unpaid past window, yellow=in payment window
  const rentDisplayStatus = isPaid ? "green" : isNotified ? "orange" : pastPaymentWindow ? "red" : "yellow";

  const openCreateDialog = () => {
    setEditingEvent(null);
    setForm({ titulo: "", descripcion: "", hora: "", tipo: "recordatorio" });
    setDialogOpen(true);
  };

  const openEditDialog = (ev: InquilinoEvento) => {
    setEditingEvent(ev);
    setForm({
      titulo: ev.titulo,
      descripcion: ev.descripcion || "",
      hora: ev.hora?.slice(0, 5) || "",
      tipo: ev.tipo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      if (editingEvent) {
        await onUpdateEvento(editingEvent.id, {
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          hora: form.hora || null,
          tipo: form.tipo,
        });
      } else if (selectedDate) {
        await onCreateEvento({
          titulo: form.titulo,
          descripcion: form.descripcion || undefined,
          fecha: format(selectedDate, "yyyy-MM-dd"),
          hora: form.hora || undefined,
          tipo: form.tipo,
        });
      }
      setForm({ titulo: "", descripcion: "", hora: "", tipo: "recordatorio" });
      setEditingEvent(null);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleNotificar = async () => {
    if (!onNotificarPago) return;
    setNotifying(true);
    try {
      await onNotificarPago();
    } finally {
      setNotifying(false);
    }
  };

  // Month status bar: determine color for visible months
  const getMonthStatus = (monthIndex: number, year: number) => {
    if (monthIndex === currentMonth && year === currentYear) {
      return rentDisplayStatus;
    }
    // Past months: would need pagos data for those months — for now, neutral
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Calendario</h3>
            <p className="text-xs text-muted-foreground">Eventos, visitas y recordatorios</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Calendar with month status bars */}
        <div>
          {/* Month status bar for current month */}
          <div className="flex gap-1 mb-2">
            {Array.from({ length: numberOfMonths }).map((_, i) => {
              const m = new Date(month.getFullYear(), month.getMonth() + i, 1);
              const status = getMonthStatus(m.getMonth(), m.getFullYear());
              return (
                <div key={i} className="flex-1 text-center">
                  {status && (
                    <div className={cn(
                      "h-2 rounded-full mx-1",
                      status === "green" && "bg-emerald-500",
                      status === "orange" && "bg-orange-500",
                      status === "yellow" && "bg-amber-400",
                      status === "red" && "bg-red-500",
                    )} title={
                      status === "green" ? "Renta pagada"
                        : status === "orange" ? "Pendiente de confirmación"
                        : status === "red" ? "Renta impagada"
                        : "Pendiente de pago"
                    } />
                  )}
                </div>
              );
            })}
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={es}
            numberOfMonths={numberOfMonths}
            month={month}
            onMonthChange={setMonth}
            className="p-3 pointer-events-auto rounded-xl border border-border"
            modifiers={{
              paymentWindow: paymentWindowMatcher,
              eventDay: eventDayMatcher,
            }}
            modifiersClassNames={{
              paymentWindow: "!bg-amber-400/20 !text-amber-700 font-semibold",
              eventDay: "ring-2 ring-primary/40 ring-offset-1",
            }}
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-2 rounded-full bg-emerald-500" />
              Pagado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-2 rounded-full bg-orange-500" />
              Pendiente confirmación
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-2 rounded-full bg-amber-400" />
              Plazo de pago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-2 rounded-full bg-red-500" />
              Impago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full ring-2 ring-primary/40" />
              Con eventos
            </span>
          </div>
        </div>

        {/* Selected day detail */}
        <div className="min-w-0">
          {selectedDate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground capitalize">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h4>
                <Button size="sm" variant="outline" onClick={openCreateDialog}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Añadir evento
                </Button>
              </div>

              {/* Event dialog (create/edit) */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent ? "Editar evento" : `Nuevo evento — ${format(selectedDate, "d MMM yyyy", { locale: es })}`}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Título *</label>
                      <Input
                        placeholder="Ej: Visita fontanero"
                        value={form.titulo}
                        onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                      <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(tipoConfig).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Hora (opcional)</label>
                      <Input type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
                      <Textarea
                        placeholder="Detalles adicionales..."
                        value={form.descripcion}
                        onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={saving || !form.titulo.trim()}>
                      {saving ? "Guardando..." : editingEvent ? "Guardar cambios" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Rent status card — show when a current-month day is selected */}
              {isCurrentMonthDay && (
                <div className={cn(
                  "rounded-xl border p-3 mb-3 flex items-start gap-3",
                  rentDisplayStatus === "green" && "bg-emerald-500/10 border-emerald-500/20",
                  rentDisplayStatus === "orange" && "bg-orange-500/10 border-orange-500/20",
                  rentDisplayStatus === "yellow" && "bg-amber-400/10 border-amber-400/20",
                  rentDisplayStatus === "red" && "bg-red-500/10 border-red-500/20",
                )}>
                  {rentDisplayStatus === "green" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : rentDisplayStatus === "orange" ? (
                    <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  ) : rentDisplayStatus === "yellow" ? (
                    <Euro className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      rentDisplayStatus === "green" && "text-emerald-700",
                      rentDisplayStatus === "orange" && "text-orange-700",
                      rentDisplayStatus === "yellow" && "text-amber-700",
                      rentDisplayStatus === "red" && "text-red-700",
                    )}>
                      {isPaid
                        ? "Renta pagada y confirmada ✓"
                        : isNotified
                          ? "Renta pendiente de confirmación"
                          : pastPaymentWindow
                            ? "Fuera de plazo — renta sin confirmar"
                            : "Plazo de pago de renta (días 1-5)"}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5",
                      rentDisplayStatus === "green" && "text-emerald-600/80",
                      rentDisplayStatus === "orange" && "text-orange-600/80",
                      rentDisplayStatus === "yellow" && "text-amber-600/80",
                      rentDisplayStatus === "red" && "text-red-600/80",
                    )}>
                      {rentaMensual ? `${rentaMensual} €/mes — ` : ""}
                      {isPaid
                        ? "Confirmado por el propietario"
                        : isNotified
                          ? "Has notificado el pago. El propietario debe ratificarlo."
                          : "Recuerda realizar el ingreso antes del día 5"}
                    </p>
                    {!isPaid && !isNotified && onNotificarPago && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 text-xs"
                        onClick={handleNotificar}
                        disabled={notifying}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {notifying ? "Notificando..." : "Ya he pagado"}
                      </Button>
                    )}
                    {!isPaid && isNotified && (
                      <Badge className="mt-2 bg-orange-100 text-orange-700 text-[10px]">
                        Pendiente de confirmación del propietario
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Events list */}
              {selectedEvents.length === 0 && !isCurrentMonthDay && (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin eventos para este día</p>
              )}
              {selectedEvents.length > 0 && (
                <div className="space-y-2">
                  {selectedEvents.map(ev => {
                    const cfg = tipoConfig[ev.tipo] || tipoConfig.recordatorio;
                    const Icon = cfg.icon;
                    return (
                      <div key={ev.id} className="rounded-xl border border-border p-3 flex items-start gap-3 group hover:bg-muted/30 transition-colors">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{ev.titulo}</p>
                          {ev.hora && <p className="text-xs text-muted-foreground">{ev.hora.slice(0, 5)}</p>}
                          {ev.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{ev.descripcion}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(ev)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => onDeleteEvento(ev.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CalendarioSection;
