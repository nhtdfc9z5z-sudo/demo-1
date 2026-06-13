import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, ArrowRight, Check, Copy, Pencil, Lightbulb, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";

export interface IPCContext {
  lastRentUpdateDate?: string | null;
  openIncidenciasCount: number;
  hasPendingPayments: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato;
  tenantName?: string;
  context?: IPCContext;
  onApply: (data: {
    contratoId: string;
    propertyId: string;
    oldRent: number;
    newRent: number;
    ipcPorcentaje: number;
    message: string;
  }) => Promise<void>;
}

const MOCK_IPC = 2.4;

type RecommendationLevel = "go" | "caution" | "wait";

function useRecommendation(
  diffMonthly: number,
  diffAnnual: number,
  context?: IPCContext
): { level: RecommendationLevel; headline: string; reasons: string[] } {
  return useMemo(() => {
    const reasons: string[] = [];

    // --- Primary signal: economic impact ---
    let impactScore: -1 | 0 | 1;
    if (diffAnnual < 30) {
      impactScore = -1;
      reasons.push(`La diferencia es de unos ${diffAnnual.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € al año — bastante pequeña.`);
    } else if (diffAnnual > 200) {
      impactScore = 1;
      reasons.push(`Son unos ${diffAnnual.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € más al año, un ajuste que se nota.`);
    } else {
      impactScore = 0;
      reasons.push(`La subida supone unos ${diffAnnual.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € más al año.`);
    }

    // --- Secondary signals (matizadores, ±0.5 weight) ---
    let nudge = 0;

    if (context?.lastRentUpdateDate) {
      const months = Math.floor(
        (Date.now() - new Date(context.lastRentUpdateDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      if (months < 10) {
        reasons.push("La última actualización fue hace relativamente poco.");
        nudge -= 0.5;
      } else if (months >= 20) {
        reasons.push("Hace tiempo que no se revisa la renta.");
        nudge += 0.5;
      }
    }
    // No previous updates → neutral, don't add a reason

    if (context && context.openIncidenciasCount >= 2) {
      reasons.push(`Tienes ${context.openIncidenciasCount} incidencias abiertas — valora el momento.`);
      nudge -= 0.5;
    }

    if (context?.hasPendingPayments) {
      reasons.push("Hay un pago pendiente de confirmar este mes.");
      nudge -= 0.5;
    }

    // --- Determine level: impact drives, nudge adjusts ---
    const finalScore = impactScore + nudge;

    let level: RecommendationLevel;
    let headline: string;

    if (impactScore <= -1) {
      // Small impact is the dominant signal
      level = "caution";
      headline = "La subida es pequeña — revisa si compensa comunicarla ahora";
    } else if (finalScore >= 1) {
      level = "go";
      headline = "Merece la pena revisarlo";
    } else if (finalScore <= -0.5) {
      level = "wait";
      headline = "Puedes aplicarla, pero valora el momento";
    } else {
      level = "caution";
      headline = "Un buen momento para revisar la renta";
    }

    return { level, headline, reasons: reasons.slice(0, 3) };
  }, [diffMonthly, diffAnnual, context]);
}

const levelStyles: Record<RecommendationLevel, { bg: string; text: string; icon: string }> = {
  go: { bg: "bg-emerald-50 border-emerald-200/70", text: "text-emerald-700", icon: "text-emerald-500" },
  caution: { bg: "bg-amber-50 border-amber-200/70", text: "text-amber-700", icon: "text-amber-500" },
  wait: { bg: "bg-orange-50 border-orange-200/70", text: "text-orange-700", icon: "text-orange-500" },
};

export default function IPCUpdateDialog({ open, onOpenChange, contrato, tenantName, context, onApply }: Props) {
  const currentRent = contrato.renta_mensual ?? 0;
  const { toast } = useToast();
  const [ipcPercent, setIpcPercent] = useState(MOCK_IPC);
  const [editingIpc, setEditingIpc] = useState(false);
  const [step, setStep] = useState<"calculate" | "message">("calculate");
  const [customRent, setCustomRent] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggestedRent = useMemo(() => {
    return Math.round(currentRent * (1 + ipcPercent / 100) * 100) / 100;
  }, [currentRent, ipcPercent]);

  const finalRent = isCustom && customRent ? parseFloat(customRent) : suggestedRent;
  const diffMonthly = finalRent - currentRent;
  const diffAnnual = diffMonthly * 12;

  const recommendation = useRecommendation(diffMonthly, diffAnnual, context);
  const ls = levelStyles[recommendation.level];

  const defaultMessage = useMemo(() => {
    const name = tenantName || "inquilino/a";
    return `Hola ${name},\n\nTe escribo para informarte de que se va a actualizar la renta del alquiler según el IPC de este año.\n\nLa renta pasa de ${currentRent.toLocaleString("es-ES")} € a ${finalRent.toLocaleString("es-ES")} € al mes.\n\nEl cambio será efectivo a partir del próximo mes.\n\nCualquier duda, me dices.\n\nUn saludo.`;
  }, [tenantName, currentRent, finalRent]);

  const [message, setMessage] = useState("");

  const handleNextStep = () => {
    setMessage(defaultMessage);
    setStep("message");
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      await onApply({
        contratoId: contrato.id,
        propertyId: contrato.property_id,
        oldRent: currentRent,
        newRent: finalRent,
        ipcPorcentaje: ipcPercent,
        message,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep("calculate");
    setIsCustom(false);
    setCustomRent("");
    setIpcPercent(MOCK_IPC);
    setEditingIpc(false);
    setMessage("");
    onOpenChange(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    toast({ title: "Copiado", description: "Mensaje copiado al portapapeles." });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Actualizar renta por IPC
          </DialogTitle>
          <DialogDescription>
            {contrato.titulo}
          </DialogDescription>
        </DialogHeader>

        {step === "calculate" && (
          <div className="space-y-4 pt-2">
            {/* Before → After comparison */}
            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
              <div className="rounded-xl border bg-muted/40 p-4 text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Actual</p>
                <p className="text-2xl font-bold tabular-nums">{currentRent.toLocaleString("es-ES")} €</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-[11px] uppercase tracking-wide text-primary/70 mb-1">Nueva</p>
                <p className="text-2xl font-bold tabular-nums text-primary">{(isCustom && customRent ? parseFloat(customRent) : suggestedRent).toLocaleString("es-ES")} €</p>
              </div>
            </div>

            {/* Impact chips */}
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                +{diffMonthly.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/mes
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                +{diffAnnual.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €/año
              </span>
            </div>

            {/* Recommendation block */}
            <div className={`rounded-lg border p-3.5 ${ls.bg}`}>
              <div className="flex items-start gap-2.5">
                <Lightbulb className={`h-4 w-4 mt-0.5 shrink-0 ${ls.icon}`} />
                <div className="space-y-1.5">
                  <p className={`text-sm font-medium ${ls.text}`}>{recommendation.headline}</p>
                  <ul className="space-y-1">
                    {recommendation.reasons.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="shrink-0 mt-1">·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* IPC row */}
            <div>
              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <span className="text-sm text-muted-foreground">IPC orientativo</span>
                {editingIpc ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="0.1"
                      value={ipcPercent}
                      onChange={(e) => {
                        setIpcPercent(parseFloat(e.target.value) || 0);
                        setIsCustom(false);
                      }}
                      className="h-8 w-20 text-right text-sm font-semibold"
                      autoFocus
                      onBlur={() => setEditingIpc(false)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingIpc(false)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingIpc(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {ipcPercent}%
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                Basado en IPC reciente. Puede variar según normativa vigente.
              </p>
            </div>

            {/* Custom rent link */}
            {!isCustom ? (
              <button
                onClick={() => {
                  setIsCustom(true);
                  setCustomRent(suggestedRent.toString());
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
              >
                Poner otro importe manualmente
              </button>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="custom-rent" className="text-xs">Importe personalizado (€/mes)</Label>
                <Input
                  id="custom-rent"
                  type="number"
                  step="0.01"
                  value={customRent}
                  onChange={(e) => setCustomRent(e.target.value)}
                  className="h-9 text-base font-semibold"
                  autoFocus
                />
              </div>
            )}

            {/* Aviso informativo tranquilo: renta no toca fianza/garantía */}
            <div className="rounded-lg border border-sky-200/70 bg-sky-50 p-3 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-sky-600" />
              <div className="text-xs text-sky-900/90 leading-relaxed">
                <p className="font-medium text-sky-800">Solo se actualiza la renta</p>
                <p className="mt-0.5 text-sky-900/75">
                  La fianza y las garantías no se tocan. Puedes cambiarlas desde su sección en la ficha del contrato.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={handleClose} className="flex-1 text-muted-foreground">
                Omitir
              </Button>
              <Button
                onClick={handleNextStep}
                className="flex-1"
                disabled={!finalRent || finalRent <= 0}
              >
                Aplicar
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "message" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-muted-foreground">{currentRent.toLocaleString("es-ES")} €</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-primary">{finalRent.toLocaleString("es-ES")} €</span>
              <span className="text-xs text-muted-foreground">({ipcPercent > 0 ? "+" : ""}{ipcPercent}%)</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Mensaje para tu inquilino</Label>
                <button
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="text-sm leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                Cópialo y envíalo tú por WhatsApp o email. No se envía automáticamente.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStep("calculate")} className="text-muted-foreground">
                Atrás
              </Button>
              <Button onClick={handleApply} disabled={saving} className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                {saving ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
