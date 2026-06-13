import { Pencil, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusConfig: Record<string, { label: string; className: string }> = {
  libre: { label: "Libre", className: "bg-emerald-100 text-emerald-800" },
  alquilado: { label: "Alquilado", className: "bg-sky-100 text-sky-800" },
  alquilada: { label: "Alquilada", className: "bg-sky-100 text-sky-800" },
  ocupado: { label: "Ocupado", className: "bg-sky-100 text-sky-800" },
  "uso propio": { label: "Uso propio", className: "bg-violet-100 text-violet-800" },
  reformas: { label: "Reformas", className: "bg-amber-100 text-amber-800" },
};

interface InmuebleCardProps {
  item: Record<string, any>;
  tipoLabel: string;
  icon: React.ReactNode;
  extraInfo?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const InmuebleCard = ({ item, tipoLabel, icon, extraInfo, onEdit, onDelete }: InmuebleCardProps) => {
  const status = statusConfig[item.estado ?? "libre"] ?? statusConfig.libre;
  const address = item.direccion_completa || item.municipio || "Sin dirección";

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <h3 className="text-base font-semibold text-foreground truncate">{item.nombre_interno}</h3>
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={12} />
            <span className="truncate">{address}</span>
          </div>
          {(item.superficie_m2 || extraInfo) && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {item.superficie_m2 ? `${item.superficie_m2} m²` : ""}
              {item.superficie_m2 && extraInfo ? " · " : ""}
              {extraInfo || ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onEdit}>
            <Pencil size={14} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {item.nombre_interno}?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará este {tipoLabel.toLowerCase()}. Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default InmuebleCard;
