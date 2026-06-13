import { useState } from "react";
import { Trash2, RotateCcw, Home, User, Receipt, AlertTriangle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { usePapelera, type PapeleraItem, type PapeleraEntityType } from "@/hooks/usePapelera";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICONS: Record<PapeleraEntityType, React.ComponentType<any>> = {
  property: Home,
  inquilino: User,
  factura: Receipt,
  incidencia: AlertTriangle,
};

const LABELS: Record<PapeleraEntityType, string> = {
  property: "Activo",
  inquilino: "Inquilino",
  factura: "Factura",
  incidencia: "Incidencia",
};

const PapeleraDialog = ({ open, onOpenChange }: Props) => {
  const { items, loading, restore, purge } = usePapelera();
  const [confirmPurge, setConfirmPurge] = useState<PapeleraItem | null>(null);
  const [filter, setFilter] = useState<PapeleraEntityType | "all">("all");

  const filtered = filter === "all" ? items : items.filter(i => i.tipo === filter);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={20} />
              Papelera
            </DialogTitle>
            <DialogDescription>
              Los elementos eliminados se conservan 30 días. Después se borran definitivamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5 flex-wrap pb-2 border-b border-border">
            {(["all", "property", "inquilino", "factura", "incidencia"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors min-h-[32px] ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? `Todo (${items.length})` : `${LABELS[f]}s (${items.filter(i => i.tipo === f).length})`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-12">Cargando…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Trash2 size={32} className="mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map(item => {
                  const Icon = ICONS[item.tipo];
                  return (
                    <li key={`${item.tipo}-${item.id}`} className="py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon size={18} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.titulo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{LABELS[item.tipo]}</span>
                          {item.subtitulo && (
                            <span className="text-[11px] text-muted-foreground truncate">· {item.subtitulo}</span>
                          )}
                          <span className={`text-[11px] font-medium ${item.diasRestantes <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                            · {item.diasRestantes}d restantes
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-9"
                          onClick={() => restore(item)}
                        >
                          <RotateCcw size={14} />
                          Restaurar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmPurge(item)}
                          aria-label="Eliminar definitivamente"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmPurge} onOpenChange={(o) => !o && setConfirmPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {confirmPurge?.titulo} se borrará para siempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmPurge) { purge(confirmPurge); setConfirmPurge(null); } }}
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PapeleraDialog;