import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Euro, AlertTriangle, CalendarDays, Info, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularImporteEsperado, calcularDeudaReal, type ImporteEsperado } from "@/lib/rentaUtils";
import type { PagoRenta } from "@/hooks/usePagosRenta";

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

interface Props {
  pagoActual: PagoRenta | undefined;
  rentaMensual: number | null | undefined;
  tenantNotified: boolean;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  /** Importe ya compensado (en especie / gastos asumidos por el inquilino) para este mes. No es caja, pero cubre renta. */
  compensado?: number;
  onConfirmar: (datos: {
    importe_pagado: number;
    tipo_pago: string;
    notas_acuerdo?: string;
  }) => Promise<void>;
}

const RentPaymentWidget = ({ pagoActual, rentaMensual, tenantNotified, fechaInicio, fechaFin, compensado = 0, onConfirmar }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const dayOfMonth = today.getDate();
  const mesActual = today.getMonth() + 1;
  const anioActual = today.getFullYear();

  // Calculate expected amount with proration
  const esperado: ImporteEsperado | null = rentaMensual
    ? calcularImporteEsperado(rentaMensual, mesActual, anioActual, fechaInicio, fechaFin)
    : null;

  const importeEsperado = esperado?.importe ?? 0;

  const [form, setForm] = useState({
    importe: (esperado?.importe ?? rentaMensual)?.toString() || "",
    tipo_pago: "total",
    notas: "",
  });

  const confirmed = pagoActual?.propietario_confirmado;
  const importePagado = pagoActual?.importe_pagado ? Number(pagoActual.importe_pagado) : 0;
  // Cobertura efectiva = caja real + compensaciones registradas.
  const cubiertoEfectivo = importePagado + (compensado || 0);

  // Use proration-aware debt calculation
  const deudaInfo = (confirmed || compensado > 0) && importeEsperado > 0
    ? calcularDeudaReal(importeEsperado, cubiertoEfectivo)
    : null;

  const isPartial = deudaInfo?.estado === "parcial";
  const isExcess = deudaInfo?.estado === "exceso";
  const deuda = deudaInfo?.deuda ?? 0;

  // Form validation: incongruence warning
  const formImporte = parseFloat(form.importe);
  const showIncongruenceWarning = !isNaN(formImporte) && importeEsperado > 0
    && form.tipo_pago === "total" && Math.abs(formImporte - importeEsperado) > 0.01;

  // Status color
  let statusColor = "bg-amber-400/15 text-amber-700 border-amber-400/30";
  let statusIcon = <Euro className="w-3.5 h-3.5" />;
  let statusText = "Pendiente";

  if (importeEsperado === 0 && esperado?.esProrrata) {
    statusColor = "bg-muted/50 text-muted-foreground border-border";
    statusIcon = <Info className="w-3.5 h-3.5" />;
    statusText = "Sin renta (fuera de contrato)";
  } else if ((confirmed || compensado > 0) && !isPartial) {
    statusColor = "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
    statusText = isExcess
      ? `Pagado (+${deudaInfo!.exceso.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€ exceso)`
      : "Pagado";
  } else if (isPartial) {
    statusColor = "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    statusIcon = <AlertTriangle className="w-3.5 h-3.5" />;
    statusText = `Parcial — deuda ${deuda.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€`;
  } else if (dayOfMonth > 10) {
    statusColor = "bg-red-500/15 text-red-700 border-red-500/30";
    statusIcon = <AlertTriangle className="w-3.5 h-3.5" />;
    statusText = "Impago";
  }

  const handleConfirm = async () => {
    const importe = parseFloat(form.importe);
    if (isNaN(importe) || importe <= 0) return;
    setSaving(true);
    try {
      await onConfirmar({
        importe_pagado: importe,
        tipo_pago: form.tipo_pago,
        notas_acuerdo: form.notas || undefined,
      });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">
          {MESES[mesActual - 1]} {anioActual} — Día {dayOfMonth}
        </span>
        {esperado?.esProrrata && importeEsperado > 0 && (
          <span className="text-[10px] text-primary font-medium">
            Prorrata {esperado.diasOcupados}/{esperado.diasMes} días
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
          statusColor
        )}>
          {statusIcon}
          {statusText}
          {confirmed && !isPartial && pagoActual?.importe_pagado && !isExcess && (
            <span className="ml-1">{pagoActual.importe_pagado}€</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {tenantNotified && !confirmed && (
            <span className="text-[10px] text-amber-600 font-medium">
              Inquilino notificó pago
            </span>
          )}
          {(!confirmed || isPartial) && importeEsperado > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 rounded-lg gap-1"
              onClick={() => {
                const prefillAmount = isPartial ? deuda : (esperado?.importe ?? rentaMensual ?? 0);
                setForm({
                  importe: prefillAmount.toString(),
                  tipo_pago: isPartial ? "parcial" : "total",
                  notas: "",
                });
                setDialogOpen(true);
              }}
            >
              <CheckCircle2 size={12} />
              {isPartial ? "Registrar resto" : "Confirmar pago"}
            </Button>
          )}
        </div>
      </div>

      {confirmed && pagoActual?.tipo_pago && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {TIPO_PAGO_OPTIONS.find(t => t.value === pagoActual.tipo_pago)?.label || pagoActual.tipo_pago}
          {pagoActual.notas_acuerdo && ` — ${pagoActual.notas_acuerdo}`}
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar pago — {MESES[mesActual - 1]} {anioActual}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Proration info */}
            {esperado?.esProrrata && importeEsperado > 0 && (
              <div className="flex items-start gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                <TrendingUp size={14} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-primary">Prorrata aplicada</p>
                  <p className="text-muted-foreground">
                    {esperado.diasOcupados} de {esperado.diasMes} días →
                    Esperado: {importeEsperado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                    <span className="ml-1 italic">(renta completa: {rentaMensual}€)</span>
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Importe pagado (€) *</label>
              <Input
                type="number"
                step="0.01"
                placeholder={importeEsperado ? `${importeEsperado}` : "0.00"}
                value={form.importe}
                onChange={e => setForm(p => ({ ...p, importe: e.target.value }))}
              />
            </div>

            {/* Incongruence warning */}
            {showIncongruenceWarning && (
              <div className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                <AlertTriangle size={14} className="text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-yellow-700">
                  Marcaste "pago total" pero el importe ({formImporte.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€)
                  no coincide con el esperado ({importeEsperado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€).
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de pago</label>
              <Select value={form.tipo_pago} onValueChange={v => setForm(p => ({ ...p, tipo_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_PAGO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.tipo_pago === "acuerdo" || form.tipo_pago === "parcial") && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {form.tipo_pago === "acuerdo" ? "Detalle del acuerdo" : "Notas (opcional)"}
                </label>
                <Textarea
                  placeholder="Especifica los detalles..."
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleConfirm} disabled={saving || !form.importe}>
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RentPaymentWidget;
