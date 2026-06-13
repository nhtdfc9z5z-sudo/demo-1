import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuditoriaHallazgos } from "@/hooks/useAuditoriaHallazgos";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { useContratos } from "@/hooks/useContratos";
import { useProperties } from "@/hooks/useProperties";
import type { Hallazgo, HallazgoTipo } from "@/lib/auditoria/detectarHallazgos";

const TITULOS_GRUPO: Record<HallazgoTipo, string> = {
  pago_sin_contrato_ambiguo: "Pagos sin contrato (ambiguos)",
  pago_sin_contrato_resoluble: "Pagos sin contrato (asignables)",
  pago_con_inquilino_sin_contrato: "Pagos sin contrato vigente",
  pago_sin_inquilino_ni_contrato: "Pagos sueltos",
  pago_duplicado: "Pagos duplicados",
  pago_real_e_historico: "Mezcla de pago real e histórico",
  contrato_sin_fecha_inicio_control: "Contratos sin fecha de control",
  contrato_sin_renta: "Contratos sin renta",
  activo_varios_contratos_completos: "Activos con varios contratos completos",
  mes_inconsistente: "Meses con datos contradictorios",
};

interface AuditoriaDatosPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AuditoriaDatosPanel({ open, onOpenChange }: AuditoriaDatosPanelProps) {
  const { hallazgos, agrupadosPorTipo, total, loading } = useAuditoriaHallazgos();
  const { properties } = useProperties();
  const { contratos } = useContratos();
  const { asignarContratoAPago, marcarPagoComoHistorico, fusionarPagos, eliminarPagoLegacy } = usePagosRenta();
  const { toast } = useToast();

  const [confirm, setConfirm] = useState<null | {
    titulo: string;
    descripcion: string;
    onConfirm: () => Promise<void>;
  }>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const propsById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const ctrById = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);

  const grupos = (Object.keys(agrupadosPorTipo) as HallazgoTipo[]).filter(
    (k) => (agrupadosPorTipo[k] ?? []).length > 0,
  );

  const run = async (id: string, fn: () => Promise<void>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast({ title: okMsg });
    } catch (e: any) {
      toast({ title: "No se pudo completar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const askConfirm = (titulo: string, descripcion: string, onConfirm: () => Promise<void>) =>
    setConfirm({ titulo, descripcion, onConfirm });

  const renderAcciones = (h: Hallazgo) => {
    const nombreActivo = h.propertyId ? (propsById.get(h.propertyId) as any)?.nombre_interno ?? "" : "";
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {h.acciones.includes("asignar_contrato") && (h.contratosCandidatos?.length === 1) && h.pagoIds?.[0] && (
          <Button
            size="sm" variant="outline"
            disabled={busyId === h.id}
            onClick={() => run(h.id, () => asignarContratoAPago(h.pagoIds![0], h.contratosCandidatos![0]),
              "Pago asignado al contrato")}
          >
            Asignar al único contrato
          </Button>
        )}
        {h.acciones.includes("marcar_historico") && h.pagoIds?.[0] && (
          <Button
            size="sm" variant="outline"
            disabled={busyId === h.id}
            onClick={() => askConfirm(
              "Marcar como histórico",
              "El pago dejará de afectar a tesorería y fiscalidad. Quedará como registro histórico.",
              () => run(h.id, () => marcarPagoComoHistorico(h.pagoIds![0]), "Pago marcado como histórico"),
            )}
          >
            Marcar histórico
          </Button>
        )}
        {h.acciones.includes("fusionar_duplicados") && (h.pagoIds?.length ?? 0) >= 2 && (
          <Button
            size="sm" variant="outline"
            disabled={busyId === h.id}
            onClick={() => askConfirm(
              "Fusionar pagos duplicados",
              `Se conservará un único pago con la suma de los importes y se eliminarán los demás (${(h.pagoIds!.length - 1)}). Esta acción no se puede deshacer.`,
              () => run(h.id, () => {
                const [keep, ...rest] = h.pagoIds!;
                return fusionarPagos(keep, rest);
              }, "Pagos fusionados"),
            )}
          >
            Fusionar duplicados
          </Button>
        )}
        {h.acciones.includes("eliminar_pago") && h.pagoIds?.[0] && (
          <Button
            size="sm" variant="ghost" className="text-destructive hover:text-destructive"
            disabled={busyId === h.id}
            onClick={() => askConfirm(
              "Eliminar pago",
              "Se borrará este pago. Esta acción no se puede deshacer.",
              () => run(h.id, () => eliminarPagoLegacy(h.pagoIds![0]), "Pago eliminado"),
            )}
          >
            Eliminar
          </Button>
        )}
        {nombreActivo && (
          <span className="text-xs text-muted-foreground self-center ml-auto">{nombreActivo}</span>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-500" />
            Avisos de datos
            {total > 0 && (
              <Badge variant="secondary" className="ml-1">{total}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Revisando tus datos…
            </div>
          )}
          {!loading && total === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-10 text-sm text-muted-foreground">
              <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
              Todo en orden. No detectamos datos ambiguos ni duplicados.
            </div>
          )}
          {!loading && grupos.map((tipo) => (
            <section key={tipo}>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-500" />
                {TITULOS_GRUPO[tipo]}
                <Badge variant="outline" className="ml-1">{agrupadosPorTipo[tipo].length}</Badge>
              </h3>
              <ul className="space-y-2">
                {agrupadosPorTipo[tipo].map((h) => (
                  <li
                    key={h.id}
                    className={`rounded-lg border p-3 ${h.severidad === "error" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}
                  >
                    <p className="text-sm font-medium">{h.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{h.detalle}</p>
                    {renderAcciones(h)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm?.titulo}</AlertDialogTitle>
              <AlertDialogDescription>{confirm?.descripcion}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const c = confirm; setConfirm(null);
                  if (c) await c.onConfirm();
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

/** Botón disparador con badge de conteo, ideal para el header. */
export function AuditoriaDatosTrigger({ onOpen }: { onOpen: () => void }) {
  const { total } = useAuditoriaHallazgos();
  if (total === 0) return null;
  return (
    <button
      onClick={onOpen}
      className="relative flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/15 hover:bg-amber-500/25 transition-colors"
      aria-label={`Avisos de datos (${total})`}
      title="Avisos de datos"
    >
      <ShieldAlert size={16} className="text-amber-600" />
      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-background">
        {total > 99 ? "99+" : total}
      </span>
    </button>
  );
}

export default AuditoriaDatosPanel;