import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Euro, CheckCircle2, AlertTriangle, Clock, Copy, Smartphone, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PagoRenta } from "@/hooks/usePagosRenta";

const meses = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface OwnerPaymentInfo {
  iban: string | null;
  telefono_bizum: string | null;
  nombre: string | null;
  apellidos: string | null;
}

interface Props {
  rentaMensual?: number | null;
  pagoActual?: PagoRenta | null;
  onNotificarPago?: (datos: { importe_pagado: number; tipo_pago: string; notas_acuerdo?: string }) => Promise<void>;
  inquilinoNombre: string;
  mesActual: number;
  anioActual: number;
  propertyId?: string | null;
}

function getRentStatus(pagoActual?: PagoRenta | null): "paid" | "notified" | "pending" | "overdue" {
  if (pagoActual?.propietario_confirmado) return "paid";
  if (pagoActual?.inquilino_notificado) return "notified";
  const day = new Date().getDate();
  return day > 10 ? "overdue" : "pending";
}

const PagarRentaDialog = ({ rentaMensual, pagoActual, onNotificarPago, inquilinoNombre, mesActual, anioActual, propertyId }: Props) => {
  const [notifying, setNotifying] = useState(false);
  const [open, setOpen] = useState(false);
  const status = getRentStatus(pagoActual);
  const { toast } = useToast();

  const [importe, setImporte] = useState<string>("");
  const [tipoPago, setTipoPago] = useState("Transferencia");
  const [notas, setNotas] = useState("");
  const [ownerInfo, setOwnerInfo] = useState<OwnerPaymentInfo | null>(null);

  // Fetch owner payment info when dialog opens
  useEffect(() => {
    if (!open || !propertyId) return;
    (async () => {
      const { data: prop } = await supabase
        .from("properties")
        .select("user_id")
        .eq("id", propertyId)
        .maybeSingle();
      if (!prop) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nombre, apellidos, iban, telefono_bizum")
        .eq("user_id", prop.user_id)
        .maybeSingle();
      if (profile) {
        setOwnerInfo(profile as unknown as OwnerPaymentInfo);
      }
    })();
  }, [open, propertyId]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && status !== "paid" && status !== "notified") {
      setImporte(rentaMensual?.toString() || "");
      setTipoPago("Transferencia");
      setNotas("");
    }
  };

  const handleNotificar = async () => {
    if (!onNotificarPago) return;
    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum <= 0) return;
    setNotifying(true);
    try {
      await onNotificarPago({
        importe_pagado: importeNum,
        tipo_pago: tipoPago,
        notas_acuerdo: notas.trim() || undefined,
      });
    } finally {
      setNotifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado`, description: text });
  };

  const concepto = `Renta ${meses[mesActual - 1]} ${anioActual}`;
  const importeNum = parseFloat(importe);
  const isDifferentAmount = rentaMensual && !isNaN(importeNum) && importeNum !== rentaMensual;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className={cn(
            "w-full h-14 text-base font-semibold rounded-2xl gap-3",
            status === "paid"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : status === "overdue"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : ""
          )}
          variant="default"
        >
          <CreditCard className="w-5 h-5" />
          {status === "paid" ? "Renta pagada ✓" : "Pagar renta"}
          {status === "notified" && (
            <Badge className="ml-2 bg-amber-100 text-amber-700 text-[10px]">Pendiente confirmación</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Pago de renta — {meses[mesActual - 1]} {anioActual}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inquilino</span>
              <span className="font-medium text-foreground">{inquilinoNombre}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Periodo</span>
              <span className="font-medium text-foreground">{meses[mesActual - 1]} {anioActual}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Renta mensual</span>
              <span className="font-medium text-foreground">{rentaMensual ? `${rentaMensual} €` : "—"}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Estado</span>
              {status === "paid" && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Confirmado
                </span>
              )}
              {status === "notified" && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Clock className="w-4 h-4" /> Pendiente de confirmación
                </span>
              )}
              {status === "pending" && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Euro className="w-4 h-4" /> Pendiente de pago
                </span>
              )}
              {status === "overdue" && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4" /> Fuera de plazo
                </span>
              )}
            </div>
          </div>

          {/* Paid confirmation */}
          {status === "paid" && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
              <div className="flex items-center gap-2 justify-center mb-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700">Pago confirmado por el propietario</p>
              </div>
              {pagoActual?.importe_pagado && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600/80">Importe confirmado</span>
                  <span className="font-semibold text-emerald-700">{pagoActual.importe_pagado} €</span>
                </div>
              )}
              {pagoActual?.tipo_pago && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600/80">Método de pago</span>
                  <span className="text-emerald-700">{pagoActual.tipo_pago}</span>
                </div>
              )}
              {pagoActual?.notas_acuerdo && (
                <div className="text-sm">
                  <span className="text-emerald-600/80">Notas</span>
                  <p className="text-emerald-700 mt-0.5">{pagoActual.notas_acuerdo}</p>
                </div>
              )}
              {pagoActual?.propietario_confirmado_at && (
                <p className="text-xs text-emerald-600/60 text-center mt-1">
                  Confirmado el {new Date(pagoActual.propietario_confirmado_at).toLocaleDateString("es-ES")}
                </p>
              )}
            </div>
          )}

          {/* Notified - show what was sent */}
          {status === "notified" && (
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/20 p-4 space-y-2">
              <div className="flex items-center gap-2 justify-center mb-1">
                <Clock className="w-6 h-6 text-amber-600" />
                <p className="text-sm font-medium text-amber-700">Pago notificado</p>
              </div>
              {pagoActual?.importe_pagado && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600/80">Importe notificado</span>
                  <span className="font-semibold text-amber-700">{pagoActual.importe_pagado} €</span>
                </div>
              )}
              {pagoActual?.tipo_pago && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600/80">Método de pago</span>
                  <span className="text-amber-700">{pagoActual.tipo_pago}</span>
                </div>
              )}
              {pagoActual?.notas_acuerdo && (
                <div className="text-sm">
                  <span className="text-amber-600/80">Notas / Acuerdo</span>
                  <p className="text-amber-700 mt-0.5">{pagoActual.notas_acuerdo}</p>
                </div>
              )}
              <p className="text-xs text-amber-600/60 text-center mt-1">
                Pendiente de confirmación del propietario
              </p>
            </div>
          )}

          {/* Payment form for pending/overdue */}
          {(status === "pending" || status === "overdue") && (
            <>
              {/* Direct Payment Methods */}
              {ownerInfo && (ownerInfo.iban || ownerInfo.telefono_bizum) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Datos de pago del propietario
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Beneficiario: {[ownerInfo.nombre, ownerInfo.apellidos].filter(Boolean).join(" ") || "—"}
                  </p>

                  {ownerInfo.iban && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5" /> Transferencia bancaria
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => copyToClipboard(ownerInfo.iban!, "IBAN")}
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </Button>
                      </div>
                      <p className="font-mono text-sm text-foreground tracking-wider">{ownerInfo.iban}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Concepto: <button
                          className="font-medium text-primary hover:underline"
                          onClick={() => copyToClipboard(concepto, "Concepto")}
                        >{concepto}</button>
                      </p>
                    </div>
                  )}

                  {ownerInfo.telefono_bizum && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" /> Bizum
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => copyToClipboard(ownerInfo.telefono_bizum!, "Teléfono Bizum")}
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </Button>
                      </div>
                      <p className="text-sm font-medium text-foreground">{ownerInfo.telefono_bizum}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Concepto: <button
                          className="font-medium text-primary hover:underline"
                          onClick={() => copyToClipboard(concepto, "Concepto")}
                        >{concepto}</button>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Importe pagado (€) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={rentaMensual?.toString() || "0.00"}
                    value={importe}
                    onChange={e => setImporte(e.target.value)}
                  />
                  {isDifferentAmount && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠ El importe es diferente a la renta mensual ({rentaMensual} €)
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Método de pago</label>
                  <Select value={tipoPago} onValueChange={setTipoPago}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Transferencia">Transferencia bancaria</SelectItem>
                      <SelectItem value="Bizum">Bizum</SelectItem>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Domiciliación">Domiciliación</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notas o acuerdo (opcional)</label>
                  <Textarea
                    placeholder="Ej: Pago parcial según acuerdo, se abona el resto el día 15..."
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <Button
                className="w-full h-12 text-base font-semibold rounded-xl"
                onClick={handleNotificar}
                disabled={notifying || !onNotificarPago || isNaN(parseFloat(importe)) || parseFloat(importe) <= 0}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {notifying ? "Notificando..." : "Notificar pago"}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                Realiza el pago por transferencia o Bizum con los datos de arriba y luego notifica aquí.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PagarRentaDialog;
