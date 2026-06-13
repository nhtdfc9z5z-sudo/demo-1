import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import type { Contrato } from "@/hooks/useContratos";
import {
  calcularNuevaRenta,
  registrarRevisionRenta,
  type TipoRevisionRenta,
} from "@/lib/contratos/revisionRenta";
import { TrendingUp, Edit3, Minus, MessageSquare, AlertCircle } from "lucide-react";
import ComunicacionLegalSheet from "./ComunicacionLegalSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  contrato: Contrato | null;
  /** Renta vigente actual (puede venir ya actualizada de tramos previos). */
  rentaActual?: number | null;
  /** Fecha sugerida para el tramo (aniversario o hoy). */
  fechaSugerida?: string;
}

const TIPOS: { id: TipoRevisionRenta; label: string; icon: typeof TrendingUp; defaultPct: number }[] = [
  { id: "ipc", label: "Aplicar IPC", icon: TrendingUp, defaultPct: 3.0 },
  { id: "personalizado", label: "Incremento personalizado", icon: Edit3, defaultPct: 2.0 },
  { id: "sin_cambio", label: "Mantener renta", icon: Minus, defaultPct: 0 },
];

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RevisionRentaSheet({ open, onClose, contrato, rentaActual, fechaSugerida }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoRevisionRenta>("ipc");
  const [pct, setPct] = useState<string>("3.0");
  const [fecha, setFecha] = useState<string>(fechaSugerida || new Date().toISOString().slice(0, 10));
  const [confirmando, setConfirmando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comunicacionOpen, setComunicacionOpen] = useState(false);

  const renta = useMemo(() => {
    const v = rentaActual ?? contrato?.renta_mensual ?? 0;
    return Number(v) || 0;
  }, [rentaActual, contrato]);

  const pctNum = Number(pct.replace(",", ".")) || 0;
  const nuevaRenta = calcularNuevaRenta(renta, tipo, pctNum);

  const reset = () => {
    setTipo("ipc");
    setPct("3.0");
    setConfirmando(false);
    setSaving(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleGuardar = async () => {
    if (!user || !contrato) return;
    setSaving(true);
    try {
      await registrarRevisionRenta({
        userId: user.id,
        contratoId: contrato.id,
        propertyId: contrato.property_id,
        tipo,
        rentaActual: renta,
        porcentaje: tipo === "sin_cambio" ? null : pctNum,
        fechaEfectiva: fecha,
      });
      qc.invalidateQueries({ queryKey: ["renta_actualizaciones"] });
      invalidateFiscalChain(qc);
      toast({ title: "Revisión guardada", description: `Nueva renta vigente desde ${fecha}.` });
      handleClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar la revisión.", variant: "destructive" });
      setSaving(false);
    }
  };

  const handleComunicar = () => setComunicacionOpen(true);

  return (
    <>
    <Sheet
      open={open && !comunicacionOpen}
      onOpenChange={(o) => { if (!o && !comunicacionOpen) handleClose(); }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Revisión de renta</SheetTitle>
          <SheetDescription>{contrato?.titulo || "Contrato"}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Renta actual</p>
            <p className="text-2xl font-semibold font-mono">{fmt(renta)} €</p>
          </div>

          {!confirmando && (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de revisión</Label>
                <div className="grid grid-cols-1 gap-2">
                  {TIPOS.map((t) => {
                    const Icon = t.icon;
                    const active = tipo === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setTipo(t.id); if (t.id !== "sin_cambio") setPct(String(t.defaultPct)); }}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <Icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {tipo !== "sin_cambio" && (
                <div className="space-y-2">
                  <Label htmlFor="pct" className="text-xs uppercase tracking-wide text-muted-foreground">Porcentaje (%)</Label>
                  <Input id="pct" type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} className="font-mono" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-xs uppercase tracking-wide text-muted-foreground">Fecha efectiva</Label>
                <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              <div className="rounded-xl border border-border p-3 bg-card">
                <p className="text-xs text-muted-foreground">Nueva renta (preview)</p>
                <p className="text-xl font-semibold font-mono text-primary">{fmt(nuevaRenta)} €</p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => setConfirmando(true)}>Continuar</Button>
                <Button variant="outline" onClick={handleComunicar} className="gap-2">
                  <MessageSquare size={14} /> Comunicar al inquilino
                </Button>
              </div>
            </>
          )}

          {confirmando && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-700 mt-0.5" />
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Confirma la revisión</p>
                </div>
                <div className="space-y-1 text-sm font-mono text-amber-900 dark:text-amber-100">
                  <div>Renta actual: <span className="font-semibold">{fmt(renta)} €</span></div>
                  {tipo !== "sin_cambio" && (
                    <div>
                      {tipo === "ipc" ? "IPC" : "Incremento"} aplicado: <span className="font-semibold">{pctNum}%</span>
                    </div>
                  )}
                  <div>Nueva renta: <span className="font-semibold">{fmt(nuevaRenta)} €</span></div>
                  <div className="pt-2 text-xs">
                    Se creará una actualización de renta con fecha efectiva <span className="font-semibold">{fecha}</span>.
                  </div>
                  {tipo === "sin_cambio" && (
                    <div className="text-xs">Quedará registrada como "sin cambio" para trazabilidad.</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleGuardar} disabled={saving}>
                  {saving ? "Guardando…" : "Confirmar y guardar"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmando(false)} disabled={saving}>
                  Volver
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <ComunicacionLegalSheet
      open={comunicacionOpen}
      onClose={() => setComunicacionOpen(false)}
      contexto="revision_renta"
      contrato={contrato as any}
      datos={{
        renta_actual: renta,
        tipo_revision: tipo,
        porcentaje: tipo === "sin_cambio" ? 0 : pctNum,
        nueva_renta: nuevaRenta,
        fecha_efectiva: fecha,
      }}
    />
    </>
  );
}