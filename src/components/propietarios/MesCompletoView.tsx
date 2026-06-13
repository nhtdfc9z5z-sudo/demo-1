import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Euro, FileText, AlertTriangle, Users, Home, Wrench, Calendar as CalendarIcon, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { Contrato } from "@/hooks/useContratos";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type EventFilter = "todos" | "cobros" | "gastos" | "contratos" | "incidencias" | "citas";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  renta: <Euro size={16} className="text-sky-600" />,
  impuesto: <FileText size={16} className="text-amber-600" />,
  seguro: <AlertTriangle size={16} className="text-violet-600" />,
  contrato: <Users size={16} className="text-emerald-600" />,
  comunidad: <Home size={16} className="text-indigo-600" />,
  derrama: <Euro size={16} className="text-orange-600" />,
  evento: <CalendarIcon size={16} className="text-pink-600" />,
  suministro: <Wrench size={16} className="text-teal-600" />,
  vencimiento: <Clock size={16} className="text-red-600" />,
  cita: <Wrench size={16} className="text-cyan-600" />,
  incidencia: <AlertTriangle size={16} className="text-rose-600" />,
  revision_renta_anualidad: <Euro size={16} className="text-amber-600" />,
  renovacion_sugerida: <Clock size={16} className="text-orange-600" />,
};

const EVENT_BG: Record<string, string> = {
  renta: "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800",
  impuesto: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
  seguro: "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800",
  contrato: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
  comunidad: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800",
  derrama: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
  evento: "bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800",
  suministro: "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800",
  vencimiento: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
  cita: "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800",
  incidencia: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800",
  revision_renta_anualidad: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
  renovacion_sugerida: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
};

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  type: string;
  status?: string;
  importe?: number | null;
  flow?: "income" | "expense";
  propertyName?: string;
  propertyId?: string;
}

interface MesCompletoViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: CalendarEvent[];
  initialMonth: number;
  initialYear: number;
  properties: Property[];
  selectedPropertyIds: string[];
  typeFilter: EventFilter;
  onTypeFilterChange: (f: EventFilter) => void;
  onPropertyFilterChange: (ids: string[]) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "cobros", label: "Cobros" },
  { value: "gastos", label: "Gastos" },
  { value: "contratos", label: "Vencimientos" },
  { value: "incidencias", label: "Incidencias" },
  { value: "citas", label: "Citas" },
];

const MesCompletoView = ({
  open,
  onOpenChange,
  events,
  initialMonth,
  initialYear,
  properties,
  selectedPropertyIds,
  typeFilter,
  onTypeFilterChange,
  onPropertyFilterChange,
  onEventClick,
}: MesCompletoViewProps) => {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // Sync when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setMonth(initialMonth);
      setYear(initialYear);
    }
  }, [open, initialMonth, initialYear]);

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goForward = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday start

  // Group events by day
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    if (ev.date.getMonth() === month && ev.date.getFullYear() === year) {
      const day = ev.date.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  }

  // Summary
  const totalIncome = events.filter(e => e.flow === "income" && e.date.getMonth() === month && e.date.getFullYear() === year && e.importe).reduce((s, e) => s + (e.importe || 0), 0);
  const totalExpense = events.filter(e => e.flow === "expense" && e.date.getMonth() === month && e.date.getFullYear() === year && e.importe).reduce((s, e) => s + (e.importe || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon size={20} className="text-primary" />
              Vista mensual completa
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Month navigator */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ChevronLeft size={18} />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{MESES[month]} {year}</span>
              {month === new Date().getMonth() && year === new Date().getFullYear() && (
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              {month !== new Date().getMonth() || year !== new Date().getFullYear() ? (
                <button
                  onClick={() => { setMonth(new Date().getMonth()); setYear(new Date().getFullYear()); }}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                >
                  Hoy
                </button>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={goForward}>
              <ChevronRight size={18} />
            </Button>
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => onTypeFilterChange(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                  typeFilter === f.value
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Property filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onPropertyFilterChange([])}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                selectedPropertyIds.length === 0
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              Todas
            </button>
            {properties.map(p => {
              const isSelected = selectedPropertyIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (isSelected) onPropertyFilterChange(selectedPropertyIds.filter(id => id !== p.id));
                    else onPropertyFilterChange([...selectedPropertyIds, p.id]);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Home size={10} />
                  {p.nombre_interno}
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-4 bg-secondary/50 rounded-xl p-3 text-sm">
            <span className="text-emerald-600 font-semibold">+{formatImporte(totalIncome)}€</span>
            <span className="text-destructive font-semibold">−{formatImporte(totalExpense)}€</span>
            <span className="text-muted-foreground">|</span>
            <span className={`font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              Balance: {totalIncome - totalExpense >= 0 ? "+" : ""}{formatImporte(totalIncome - totalExpense)}€
            </span>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
            {/* Week day headers */}
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} className="bg-secondary/50 text-center text-[11px] font-semibold text-muted-foreground py-2">
                {d}
              </div>
            ))}

            {/* Empty cells for first week */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-card min-h-[80px]" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay[day] || [];
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

              return (
                <div key={day} className={`bg-card min-h-[80px] p-1.5 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
                  <span className={`text-[11px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div
                        key={ev.id}
                        className={`text-[9px] px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${EVENT_BG[ev.type] || EVENT_BG.evento} ${onEventClick ? "cursor-pointer hover:opacity-80" : ""}`}
                        title={ev.title}
                        onClick={onEventClick ? () => { onEventClick(ev as any); onOpenChange(false); } : undefined}
                      >
                        {EVENT_ICONS[ev.type] ? <span className="shrink-0 [&>svg]:w-3 [&>svg]:h-3">{EVENT_ICONS[ev.type]}</span> : null}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-muted-foreground font-medium pl-1">
                        +{dayEvents.length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Event list for the month */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Todos los eventos del mes</h4>
            {events.filter(e => e.date.getMonth() === month && e.date.getFullYear() === year).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin eventos este mes</p>
            ) : (
              <div className="space-y-1.5">
                {events
                  .filter(e => e.date.getMonth() === month && e.date.getFullYear() === year)
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map(ev => (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 ${EVENT_BG[ev.type] || EVENT_BG.evento} ${onEventClick ? "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" : ""}`}
                      onClick={onEventClick ? () => { onEventClick(ev as any); onOpenChange(false); } : undefined}
                    >
                      <div className="shrink-0">{EVENT_ICONS[ev.type] || EVENT_ICONS.evento}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ev.date.getDate()} {MESES[ev.date.getMonth()]} · {ev.propertyName || "General"}
                        </p>
                      </div>
                      {ev.importe != null && (
                        <span className={`text-sm font-semibold tabular-nums ${
                          ev.flow === "income" ? "text-emerald-600" : "text-destructive"
                        }`}>
                          {ev.flow === "income" ? "+" : "−"}{formatImporte(ev.importe)}€
                        </span>
                      )}
                      {ev.status && (
                        <Badge variant="outline" className="text-[10px]">{ev.status}</Badge>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MesCompletoView;
