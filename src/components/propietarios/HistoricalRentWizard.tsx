import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays, TrendingUp, CheckCircle2, Euro } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagosRenta, type EstrategiaReconstruccion, type ConflictoHistoricoBuckets } from "@/hooks/usePagosRenta";
import ConflictosHistoricoDialog from "./ConflictosHistoricoDialog";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface RentUpdate {
  fecha: string;
  importe_anterior: number;
  importe_nuevo: number;
  motivo: string;
}

interface HistoricalRentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyName: string;
  propertyId: string;
  inquilinoId: string;
  rentaMensual: number;
  fechaInicio: string; // YYYY-MM-DD
  userId: string;
  onComplete: (data: {
    allPaid: boolean;
    rentUpdates: RentUpdate[];
    unpaidMonths: { mes: number; anio: number }[];
    /** Si es true, los pagos históricos contarán para informes fiscales del año de devengo */
    afectaFiscalidad: boolean;
    /** Estrategia anti-duplicidad elegida por el usuario tras el pre-chequeo. */
    estrategia: EstrategiaReconstruccion;
    /** Buckets de conflictos detectados antes de ejecutar la reconstrucción. */
    conflictos: ConflictoHistoricoBuckets;
  }) => Promise<void>;
}

type Step = "status" | "updates" | "unpaid" | "confirm";

const HistoricalRentWizard = ({
  open, onOpenChange, propertyName, propertyId, inquilinoId,
  rentaMensual, fechaInicio, userId, onComplete,
}: HistoricalRentWizardProps) => {
  const [step, setStep] = useState<Step>("status");
  const [allPaid, setAllPaid] = useState(true);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [rentUpdates, setRentUpdates] = useState<RentUpdate[]>([]);
  const [unpaidMonths, setUnpaidMonths] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [afectaFiscalidad, setAfectaFiscalidad] = useState(false);
  const [conflictosOpen, setConflictosOpen] = useState(false);
  const [conflictos, setConflictos] = useState<ConflictoHistoricoBuckets | null>(null);
  const { detectarConflictosHistorico } = usePagosRenta({ asOwner: true, userId });

  // New update form
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMotivo, setNewMotivo] = useState("ipc");

  const startDate = new Date(fechaInicio);
  const now = new Date();

  // Generate all months from fecha_inicio to now
  const allMonths: { mes: number; anio: number; label: string }[] = [];
  {
    let y = startDate.getFullYear();
    let m = startDate.getMonth() + 1;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
      allMonths.push({ mes: m, anio: y, label: `${MESES[m - 1]} ${y}` });
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  const toggleUnpaid = (key: string) => {
    const next = new Set(unpaidMonths);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setUnpaidMonths(next);
  };

  const addUpdate = () => {
    if (!newDate || !newAmount) return;
    const sorted = [...rentUpdates, {
      fecha: newDate,
      importe_anterior: rentUpdates.length > 0
        ? rentUpdates[rentUpdates.length - 1].importe_nuevo
        : rentaMensual,
      importe_nuevo: parseFloat(newAmount),
      motivo: newMotivo,
    }].sort((a, b) => a.fecha.localeCompare(b.fecha));
    // Recalculate importe_anterior chain
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].importe_anterior = i === 0 ? rentaMensual : sorted[i - 1].importe_nuevo;
    }
    setRentUpdates(sorted);
    setNewDate("");
    setNewAmount("");
  };

  const removeUpdate = (idx: number) => {
    const next = rentUpdates.filter((_, i) => i !== idx);
    for (let i = 0; i < next.length; i++) {
      next[i].importe_anterior = i === 0 ? rentaMensual : next[i - 1].importe_nuevo;
    }
    setRentUpdates(next);
  };

  const buildUnpaid = () =>
    !allPaid
      ? Array.from(unpaidMonths).map(k => {
          const [m, a] = k.split("-");
          return { mes: parseInt(m), anio: parseInt(a) };
        })
      : [];

  const runComplete = async (
    estrategia: EstrategiaReconstruccion,
    detectados: ConflictoHistoricoBuckets,
  ) => {
    setSaving(true);
    try {
      await onComplete({
        allPaid,
        rentUpdates: hasUpdates ? rentUpdates : [],
        unpaidMonths: buildUnpaid(),
        afectaFiscalidad,
        estrategia,
        conflictos: detectados,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const meses = allMonths.map(({ mes, anio }) => ({ mes, anio }));
      const detectados = await detectarConflictosHistorico(propertyId, inquilinoId, meses);
      const hayConflictos =
        detectados.pago_real.length +
        detectados.historico_reconstruido.length +
        detectados.regularizado.length +
        detectados.pendiente.length > 0;
      if (hayConflictos) {
        setConflictos(detectados);
        setConflictosOpen(true);
        setSaving(false);
        return;
      }
      await runComplete("omitir_pagos_reales", detectados);
    } catch (err) {
      console.error("pre-chequeo histórico:", err);
      setSaving(false);
    }
  };

  const currentRenta = rentUpdates.length > 0
    ? rentUpdates[rentUpdates.length - 1].importe_nuevo
    : rentaMensual;

  const totalMonths = allMonths.length;
  const paidMonths = allPaid ? totalMonths : totalMonths - unpaidMonths.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            Importar historial de rentas — {propertyName}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-2 mb-2">
          {(["status", "updates", "unpaid", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= ["status", "updates", "unpaid", "confirm"].indexOf(step)
                ? "bg-primary" : "bg-muted"
            )} />
          ))}
        </div>

        {step === "status" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              El contrato empezó el <strong>{new Date(fechaInicio).toLocaleDateString("es-ES")}</strong> con
              una renta de <strong>{rentaMensual}€/mes</strong>. Son <strong>{totalMonths} meses</strong> hasta hoy.
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              <strong className="text-foreground">Fecha de registro ≠ fecha de cobro.</strong> Los meses que
              marques como pagados se guardarán como <em>histórico reconstruido</em>: no contarán como
              ingresos actuales ni movimientos bancarios de hoy.
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div>
                <p className="text-sm font-medium">¿Están todas las rentas al día?</p>
                <p className="text-xs text-muted-foreground">Si hay meses impagados podrás marcarlos después</p>
              </div>
              <Switch checked={allPaid} onCheckedChange={setAllPaid} />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div>
                <p className="text-sm font-medium">¿Ha habido actualizaciones de renta?</p>
                <p className="text-xs text-muted-foreground">Subidas por IPC, renegociaciones, etc.</p>
              </div>
              <Switch checked={hasUpdates} onCheckedChange={setHasUpdates} />
            </div>
          </div>
        )}

        {step === "updates" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Renta inicial: <strong>{rentaMensual}€</strong>
              {rentUpdates.length > 0 && (
                <> → Renta actual: <strong>{currentRenta}€</strong></>
              )}
            </p>

            {rentUpdates.length > 0 && (
              <div className="space-y-2">
                {rentUpdates.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    <TrendingUp size={14} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {new Date(u.fecha).toLocaleDateString("es-ES")} —{" "}
                        {u.importe_anterior}€ → {u.importe_nuevo}€
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{u.motivo}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeUpdate(i)}>
                      <Trash2 size={12} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Fecha de cambio</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  min={fechaInicio}
                  max={now.toISOString().split("T")[0]}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nueva renta (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder={String(currentRenta)}
                  className="mt-1 w-28"
                />
              </div>
              <div>
                <Label className="text-xs">Motivo</Label>
                <Select value={newMotivo} onValueChange={setNewMotivo}>
                  <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipc">IPC</SelectItem>
                    <SelectItem value="renegociacion">Renegociación</SelectItem>
                    <SelectItem value="renovacion">Renovación</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={addUpdate} disabled={!newDate || !newAmount} className="gap-1.5">
              <Plus size={14} /> Añadir actualización
            </Button>
          </div>
        )}

        {step === "unpaid" && !allPaid && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Marca los meses que <strong>no se pagaron</strong>. El resto se marcarán como cobrados.
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[40vh] overflow-y-auto">
              {allMonths.map(({ mes, anio, label }) => {
                const key = `${mes}-${anio}`;
                const isUnpaid = unpaidMonths.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleUnpaid(key)}
                    className={cn(
                      "text-xs p-2 rounded-lg border transition-colors text-center",
                      isUnpaid
                        ? "border-destructive bg-destructive/10 text-destructive font-medium"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {unpaidMonths.size > 0 && (
              <p className="text-xs text-destructive font-medium">
                {unpaidMonths.size} mes(es) impagado(s)
              </p>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3 py-2">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm font-medium">Resumen</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📅 Periodo: {allMonths[0]?.label} → {allMonths[allMonths.length - 1]?.label} ({totalMonths} meses)</p>
                <p>💰 Meses cobrados: {paidMonths} de {totalMonths}</p>
                {!allPaid && unpaidMonths.size > 0 && (
                  <p>❌ Meses impagados: {unpaidMonths.size}</p>
                )}
                {hasUpdates && rentUpdates.length > 0 && (
                  <p>📈 Actualizaciones de renta: {rentUpdates.length} ({rentaMensual}€ → {currentRenta}€)</p>
                )}
                <p className="pt-1 text-foreground">No se crearán ingresos actuales por rentas históricas.</p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="min-w-0">
                <p className="text-sm font-medium">Contar este histórico en informes fiscales</p>
                <p className="text-xs text-muted-foreground">
                  Opcional. Si lo activas, las rentas se imputarán al año fiscal del que correspondan
                  (no al año actual). Por defecto, los históricos reconstruidos no afectan a fiscalidad.
                </p>
              </div>
              <Switch checked={afectaFiscalidad} onCheckedChange={setAfectaFiscalidad} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step !== "status" && (
            <Button variant="outline" onClick={() => {
              const steps: Step[] = ["status", "updates", "unpaid", "confirm"];
              let prevIdx = steps.indexOf(step) - 1;
              // Skip "unpaid" if allPaid, skip "updates" if !hasUpdates
              if (steps[prevIdx] === "unpaid" && allPaid) prevIdx--;
              if (steps[prevIdx] === "updates" && !hasUpdates) prevIdx--;
              setStep(steps[Math.max(0, prevIdx)]);
            }}>
              Atrás
            </Button>
          )}
          {step === "confirm" ? (
            <Button onClick={handleGenerate} disabled={saving}>
              {saving ? "Comprobando..." : "Generar historial"}
            </Button>
          ) : (
            <Button onClick={() => {
              const steps: Step[] = ["status", "updates", "unpaid", "confirm"];
              let nextIdx = steps.indexOf(step) + 1;
              // Skip "updates" if !hasUpdates, skip "unpaid" if allPaid
              if (steps[nextIdx] === "updates" && !hasUpdates) nextIdx++;
              if (steps[nextIdx] === "unpaid" && allPaid) nextIdx++;
              setStep(steps[Math.min(steps.length - 1, nextIdx)]);
            }}>
              Siguiente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      {conflictos && (
        <ConflictosHistoricoDialog
          open={conflictosOpen}
          onOpenChange={setConflictosOpen}
          buckets={conflictos}
          onConfirm={(estrategia) => {
            runComplete(estrategia, conflictos);
          }}
          onCancel={() => setSaving(false)}
        />
      )}
    </Dialog>
  );
};

export default HistoricalRentWizard;
