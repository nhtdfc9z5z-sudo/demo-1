import { useMemo, useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { ConflictoHistoricoBuckets, EstrategiaReconstruccion } from "@/hooks/usePagosRenta";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: ConflictoHistoricoBuckets;
  onConfirm: (estrategia: EstrategiaReconstruccion) => void;
  onCancel?: () => void;
}

const ConflictosHistoricoDialog = ({ open, onOpenChange, buckets, onConfirm, onCancel }: Props) => {
  const [estrategia, setEstrategia] = useState<EstrategiaReconstruccion>("omitir_pagos_reales");

  const counts = useMemo(() => ({
    nuevos: buckets.sin_registro.length,
    reconstruidos: buckets.historico_reconstruido.length,
    regularizados: buckets.regularizado.length,
    pendientes: buckets.pendiente.length,
    reales: buckets.pago_real.length,
  }), [buckets]);

  const totalExistentes = counts.reconstruidos + counts.regularizados + counts.pendientes + counts.reales;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Ya existen registros para algunos meses
          </AlertDialogTitle>
          <AlertDialogDescription>
            CapitalRent ha detectado registros económicos previos para este contrato.
            No queremos duplicar ni modificar cobros reales ya registrados.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 text-sm">
          <Row label="Meses nuevos a crear" value={counts.nuevos} tone="ok" />
          <Row label="Ya reconstruidos como histórico" value={counts.reconstruidos} tone="warn" />
          <Row label="Ya regularizados" value={counts.regularizados} tone="warn" />
          <Row label="Marcados como pendientes" value={counts.pendientes} tone="warn" />
          <Row label="Cobros reales (protegidos, no se modifican)" value={counts.reales} tone="locked" />
        </div>

        <div className="pt-2">
          <p className="text-sm font-medium mb-2">¿Cómo quieres continuar?</p>
          <RadioGroup
            value={estrategia}
            onValueChange={(v) => setEstrategia(v as EstrategiaReconstruccion)}
            className="space-y-2"
          >
            <Opt
              value="omitir_pagos_reales"
              title="Continuar omitiendo cobros reales"
              desc="Crea los meses nuevos y actualiza históricos / regularizados / pendientes. Los cobros reales no se tocan."
            />
            <Opt
              value="solo_reemplazar_existentes"
              title="Reemplazar solo lo ya existente"
              desc="Actualiza únicamente meses con histórico / regularizado / pendiente. No crea meses nuevos. Cobros reales protegidos."
              disabled={totalExistentes - counts.reales === 0}
            />
            <Opt
              value="solo_nuevos"
              title="No tocar nada existente, crear solo meses nuevos"
              desc="Solo se crean los meses que aún no tienen ningún registro."
              disabled={counts.nuevos === 0}
            />
          </RadioGroup>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <ShieldCheck size={14} className="text-emerald-600" />
          Los cobros reales nunca se sobrescriben, sea cual sea la opción elegida.
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => { onCancel?.(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={() => { onConfirm(estrategia); onOpenChange(false); }}>Continuar</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const Row = ({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "locked" }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
    <span className="text-muted-foreground">{label}</span>
    <span className={
      tone === "ok" ? "font-semibold text-emerald-600"
      : tone === "warn" ? "font-semibold text-amber-600"
      : "font-semibold text-foreground"
    }>{value}</span>
  </div>
);

const Opt = ({ value, title, desc, disabled }: { value: string; title: string; desc: string; disabled?: boolean }) => (
  <Label
    htmlFor={`estrategia-${value}`}
    className={`flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
  >
    <RadioGroupItem value={value} id={`estrategia-${value}`} className="mt-1" disabled={disabled} />
    <div className="space-y-0.5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
    </div>
  </Label>
);

export default ConflictosHistoricoDialog;