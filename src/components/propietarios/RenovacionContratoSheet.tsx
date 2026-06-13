import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import type { Contrato } from "@/hooks/useContratos";
import {
  calcularNuevaFechaFin,
  confirmarRenovacion,
  marcarNoRenovacion,
} from "@/lib/contratos/renovacionContrato";
import { RotateCcw, XCircle, Edit3, MessageSquare, AlertCircle } from "lucide-react";
import ComunicacionLegalSheet from "./ComunicacionLegalSheet";
import type { ComunicacionContexto } from "@/lib/comunicaciones/guardarComunicacion";

type Modo = "menu" | "renovar" | "no_renovar";

interface Props {
  open: boolean;
  onClose: () => void;
  contrato: Contrato | null;
  onNegociar?: (contrato: Contrato) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function RenovacionContratoSheet({ open, onClose, contrato, onNegociar }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modo, setModo] = useState<Modo>("menu");
  const [saving, setSaving] = useState(false);
  const [comunicacionOpen, setComunicacionOpen] = useState(false);
  const [comunicacionCtx, setComunicacionCtx] = useState<ComunicacionContexto>("renovacion");

  const fechaFinActual = contrato?.fecha_fin || "";
  const prorrogaAnos = contrato?.prorroga_anos || 0;
  const nuevaFechaFin =
    fechaFinActual && prorrogaAnos > 0 ? calcularNuevaFechaFin(fechaFinActual, prorrogaAnos) : null;

  const handleClose = () => { setModo("menu"); setSaving(false); onClose(); };

  const handleRenovar = async () => {
    if (!user || !contrato || !fechaFinActual || !prorrogaAnos) return;
    setSaving(true);
    try {
      await confirmarRenovacion({
        userId: user.id,
        contratoId: contrato.id,
        propertyId: contrato.property_id,
        fechaFinActual,
        prorrogaAnos,
      });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      invalidateFiscalChain(qc);
      toast({ title: "Contrato renovado", description: `Nueva fecha fin: ${fmtDate(nuevaFechaFin)}.` });
      handleClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo renovar.", variant: "destructive" });
      setSaving(false);
    }
  };

  const handleNoRenovar = async () => {
    if (!user || !contrato) return;
    setSaving(true);
    try {
      await marcarNoRenovacion({
        userId: user.id,
        contratoId: contrato.id,
        propertyId: contrato.property_id,
        fechaFinActual,
      });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      invalidateFiscalChain(qc);
      toast({ title: "Marcado como no renovable", description: `Finalizará el ${fmtDate(fechaFinActual)}.` });
      handleClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
      setSaving(false);
    }
  };

  const handleComunicar = () => {
    // El contexto depende de en qué paso del sheet estamos
    setComunicacionCtx(modo === "no_renovar" ? "no_renovacion" : "renovacion");
    setComunicacionOpen(true);
  };

  const handleNegociar = () => {
    if (contrato && onNegociar) onNegociar(contrato);
    handleClose();
  };

  return (
    <>
    <Sheet
      open={open && !comunicacionOpen}
      onOpenChange={(o) => { if (!o && !comunicacionOpen) handleClose(); }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Renovación de contrato</SheetTitle>
          <SheetDescription>{contrato?.titulo || "Contrato"}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-sm font-mono">
            <div>Fecha fin actual: <span className="font-semibold">{fmtDate(fechaFinActual)}</span></div>
            <div>Prórroga prevista: <span className="font-semibold">{prorrogaAnos} año(s)</span></div>
          </div>

          {modo === "menu" && (
            <div className="space-y-2">
              <Button
                className="w-full justify-start gap-3 h-auto py-3"
                variant="outline"
                disabled={!nuevaFechaFin}
                onClick={() => setModo("renovar")}
              >
                <RotateCcw size={18} /> <span className="text-left flex-1">
                  <span className="block text-sm font-medium">Renovar automáticamente</span>
                  <span className="block text-xs text-muted-foreground">Aplica la prórroga prevista</span>
                </span>
              </Button>
              <Button
                className="w-full justify-start gap-3 h-auto py-3"
                variant="outline"
                onClick={() => setModo("no_renovar")}
              >
                <XCircle size={18} /> <span className="text-left flex-1">
                  <span className="block text-sm font-medium">No renovar</span>
                  <span className="block text-xs text-muted-foreground">Marca como finaliza_pronto</span>
                </span>
              </Button>
              <Button
                className="w-full justify-start gap-3 h-auto py-3"
                variant="outline"
                onClick={handleNegociar}
              >
                <Edit3 size={18} /> <span className="text-left flex-1">
                  <span className="block text-sm font-medium">Negociar condiciones</span>
                  <span className="block text-xs text-muted-foreground">Abrir asistente con datos precargados</span>
                </span>
              </Button>
              <Button
                className="w-full justify-start gap-3 h-auto py-3"
                variant="outline"
                onClick={handleComunicar}
              >
                <MessageSquare size={18} /> <span className="text-left flex-1">
                  <span className="block text-sm font-medium">Comunicar al inquilino</span>
                  <span className="block text-xs text-muted-foreground">Próximamente</span>
                </span>
              </Button>
            </div>
          )}

          {modo === "renovar" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-700 mt-0.5" />
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Confirma la renovación</p>
                </div>
                <div className="space-y-1 text-sm font-mono text-amber-900 dark:text-amber-100">
                  <div>Fecha fin actual: <span className="font-semibold">{fmtDate(fechaFinActual)}</span></div>
                  <div>Prórroga: <span className="font-semibold">{prorrogaAnos} año(s)</span></div>
                  <div className="pt-1">Nueva fecha fin: <span className="font-semibold">{fmtDate(nuevaFechaFin)}</span></div>
                  <div className="pt-2 text-xs">Se actualizará el contrato y se registrará en el historial.</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleRenovar} disabled={saving}>
                  {saving ? "Guardando…" : "Confirmar renovación"}
                </Button>
                <Button variant="outline" onClick={() => setModo("menu")} disabled={saving}>Volver</Button>
              </div>
            </div>
          )}

          {modo === "no_renovar" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle size={16} className="text-rose-700 mt-0.5" />
                  <p className="text-sm font-medium text-rose-900 dark:text-rose-200">Confirma no renovar</p>
                </div>
                <div className="space-y-1 text-sm font-mono text-rose-900 dark:text-rose-100">
                  <div>El contrato finalizará el <span className="font-semibold">{fmtDate(fechaFinActual)}</span>.</div>
                  <div className="pt-1 text-xs">Estado pasará a <span className="font-semibold">finaliza_pronto</span>. No se modifican fechas ni pagos.</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleNoRenovar} disabled={saving} variant="destructive">
                  {saving ? "Guardando…" : "Confirmar no renovación"}
                </Button>
                <Button variant="outline" onClick={handleComunicar} className="gap-2">
                  <MessageSquare size={14} /> Comunicar al inquilino
                </Button>
                <Button variant="ghost" onClick={() => setModo("menu")} disabled={saving}>Volver</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <ComunicacionLegalSheet
      open={comunicacionOpen}
      onClose={() => setComunicacionOpen(false)}
      contexto={comunicacionCtx}
      contrato={contrato as any}
      datos={{
        prorroga_anos: contrato?.prorroga_anos,
        nueva_fecha_fin: nuevaFechaFin,
      }}
    />
    </>
  );
}