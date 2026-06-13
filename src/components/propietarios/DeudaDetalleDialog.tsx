import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Home, ChevronRight } from "lucide-react";

interface DeudaItem {
  propertyName: string;
  propertyId: string;
  meses: { mes: number; anio: number; importe: number }[];
  total: number;
}

interface DeudaDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deudas: DeudaItem[];
  onPropertyClick?: (propertyId: string) => void;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const DeudaDetalleDialog = ({ open, onOpenChange, deudas, onPropertyClick }: DeudaDetalleDialogProps) => {
  const totalGeneral = deudas.reduce((sum, d) => sum + d.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-destructive" />
            Deuda acumulada: {formatImporte(totalGeneral)}€
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {deudas.map(deuda => (
            <button
              key={deuda.propertyId}
              onClick={() => {
                if (onPropertyClick) {
                  onPropertyClick(deuda.propertyId);
                  onOpenChange(false);
                }
              }}
              className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Home size={16} className="text-primary" />
                  <span className="font-semibold text-sm">{deuda.propertyName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-destructive">{formatImporte(deuda.total)}€</span>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                {deuda.meses.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-destructive/5 rounded-lg px-3 py-2">
                    <span className="text-muted-foreground">
                      {MESES[m.mes - 1]} {m.anio}
                    </span>
                    <span className="font-semibold text-destructive">{formatImporte(m.importe)}€</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeudaDetalleDialog;
