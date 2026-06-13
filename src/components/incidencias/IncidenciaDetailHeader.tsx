import { ArrowLeft, Save, MapPin, Clock, Hash, UserCheck, Wallet, Tag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import IncidenciaStatusBar from "./IncidenciaStatusBar";
import PrioridadSelector from "./PrioridadSelector";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { Property } from "@/hooks/useProperties";

interface Props {
  incidencia: Incidencia;
  property: Property | undefined;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  onChangeEstado: (estado: string) => void;
  onChangePrioridad: (prioridad: number) => void;
}

const IncidenciaDetailHeader = ({ incidencia, property, onBack, onSave, saving, onChangeEstado, onChangePrioridad }: Props) => {
  return (
    <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border -mx-6 px-6 py-3 space-y-3">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                <Hash size={12} />{incidencia.numero_incidencia}
              </span>
              {incidencia.tipo_incidencia && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Tag size={9} /> {incidencia.tipo_incidencia}
                </Badge>
              )}
              {incidencia.estado !== "Cerrada" && (
                <PrioridadSelector
                  value={incidencia.prioridad ?? 3}
                  onChange={onChangePrioridad}
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="font-medium text-foreground text-sm truncate">
                {property?.nombre_interno || "Sin propiedad"}
              </span>
              {incidencia.direccion && (
                <span className="flex items-center gap-1 hidden sm:flex">
                  <MapPin size={11} /> <span className="truncate max-w-[200px]">{incidencia.direccion}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={11} /> {new Date(incidencia.created_at).toLocaleDateString("es-ES")}
              </span>
            </div>
            {/* Responsables */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {(incidencia as any).causante && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users size={10} /> Causante: <span className="font-medium text-foreground">{(incidencia as any).causante}</span>
                </span>
              )}
              {incidencia.responsable_pago && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                  <Wallet size={10} /> Pago: <span className="font-medium text-foreground">{incidencia.responsable_pago}</span>
                </span>
              )}
              {incidencia.responsable_gestion && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <UserCheck size={10} /> Gestiona: <span className="font-medium text-foreground">{incidencia.responsable_gestion}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={onSave} disabled={saving} className="gap-1.5 hidden md:inline-flex shrink-0">
          <Save size={14} /> {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      {/* Status bar */}
      <IncidenciaStatusBar estado={incidencia.estado || "Abierta"} onChangeEstado={onChangeEstado} />
    </div>
  );
};

export default IncidenciaDetailHeader;
