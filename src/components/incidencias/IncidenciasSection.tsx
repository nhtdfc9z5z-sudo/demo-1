import { useState, useMemo } from "react";
import { Plus, AlertTriangle, Eye, Trash2, X, ArrowUpDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PrioridadSelector from "./PrioridadSelector";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { PRIORIDADES, ESTADOS_INCIDENCIA } from "@/hooks/useIncidencias";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

const estadoColors: Record<string, string> = {
  "Abierta": "bg-red-100 text-red-800",
  "En revisión": "bg-amber-100 text-amber-800",
  "Proveedor asignado": "bg-blue-100 text-blue-800",
  "Pendiente de factura": "bg-indigo-100 text-indigo-800",
  "Cerrada": "bg-emerald-100 text-emerald-800",
};

const ESTADOS = ESTADOS_INCIDENCIA;

type SortField = "fecha" | "vivienda" | "prioridad" | "estado";
type SortDir = "asc" | "desc";

interface Props {
  incidencias: Incidencia[];
  properties: Property[];
  inquilinos?: Inquilino[];
  loading: boolean;
  filterPropertyId?: string | null;
  onClearFilter?: () => void;
  onNew: () => void;
  onView: (inc: Incidencia) => void;
  onDelete: (id: string) => void;
  onUpdatePrioridad?: (id: string, prioridad: number) => void;
}

const sortLabels: Record<SortField, string> = {
  fecha: "Fecha",
  vivienda: "Vivienda",
  prioridad: "Prioridad",
  estado: "Estado",
};

const IncidenciasSection = ({ incidencias, properties, inquilinos = [], loading, filterPropertyId, onClearFilter, onNew, onView, onDelete, onUpdatePrioridad }: Props) => {
  const filterProp = filterPropertyId ? properties.find(p => p.id === filterPropertyId) : null;
  const [sortField, setSortField] = useState<SortField>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [filterPrioridad, setFilterPrioridad] = useState<number | null>(null);

  const activeFilterCount = [filterEstado, filterPrioridad].filter(Boolean).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "prioridad" ? "desc" : "asc"); }
  };

  const clearFilters = () => { setFilterEstado(null); setFilterPrioridad(null); };

  const processed = useMemo(() => {
    let list = [...incidencias];
    if (filterEstado) list = list.filter(i => i.estado === filterEstado);
    if (filterPrioridad !== null) list = list.filter(i => i.prioridad === filterPrioridad);

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "fecha": cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(); break;
        case "vivienda": {
          const pa = properties.find(p => p.id === a.property_id)?.nombre_interno || "";
          const pb = properties.find(p => p.id === b.property_id)?.nombre_interno || "";
          cmp = pa.localeCompare(pb); break;
        }
        case "prioridad": cmp = (a.prioridad ?? 0) - (b.prioridad ?? 0); break;
        case "estado": cmp = ESTADOS.indexOf(a.estado || "") - ESTADOS.indexOf(b.estado || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [incidencias, filterEstado, filterPrioridad, sortField, sortDir, properties]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Incidencias</h2>
          <p className="text-sm text-muted-foreground">
            {processed.length} de {incidencias.length} incidencia{incidencias.length !== 1 ? "s" : ""}
          </p>
          {filterProp && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{filterProp.nombre_interno}</span>
              <button onClick={onClearFilter} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
            </div>
          )}
        </div>
        <Button onClick={onNew} className="gap-1.5">
          <Plus size={15} /> Nueva incidencia
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowUpDown size={13} /> {sortLabels[sortField]} {sortDir === "asc" ? "↑" : "↓"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sortLabels) as SortField[]).map(f => (
              <DropdownMenuItem key={f} onClick={() => handleSort(f)} className="text-xs gap-2">
                <span className={sortField === f ? "font-semibold" : ""}>{sortLabels[f]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filterEstado ? "default" : "outline"} size="sm" className="gap-1.5 text-xs">
              Estado {filterEstado && `: ${filterEstado}`} <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterEstado(null)} className="text-xs">Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {ESTADOS.map(e => (
              <DropdownMenuItem key={e} onClick={() => setFilterEstado(e)} className="text-xs">{e}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filterPrioridad !== null ? "default" : "outline"} size="sm" className="gap-1.5 text-xs">
              Prioridad {filterPrioridad !== null && `: ${PRIORIDADES.find(p => p.value === filterPrioridad)?.label}`} <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterPrioridad(null)} className="text-xs">Todas</DropdownMenuItem>
            <DropdownMenuSeparator />
            {PRIORIDADES.map(p => (
              <DropdownMenuItem key={p.value} onClick={() => setFilterPrioridad(p.value)} className="text-xs">{p.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 text-muted-foreground">
            <X size={12} /> Limpiar ({activeFilterCount})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border border-border p-5 h-24 animate-pulse" />)}
        </div>
      ) : processed.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <AlertTriangle size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {activeFilterCount > 0 ? "No hay incidencias con estos filtros" : "No hay incidencias registradas"}
          </p>
          <Button onClick={activeFilterCount > 0 ? clearFilters : onNew} variant="outline" className="mt-4 gap-1.5 text-xs">
            {activeFilterCount > 0 ? <><X size={14} /> Limpiar filtros</> : <><Plus size={14} /> Crear primera incidencia</>}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {processed.map(inc => {
            const prop = properties.find(p => p.id === inc.property_id);
            return (
              <div key={inc.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(inc)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{inc.numero_incidencia}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${estadoColors[inc.estado] || "bg-zinc-100 text-zinc-600"}`}>
                        {inc.estado}
                      </span>
                      {inc.estado !== "Cerrada" && (
                        <PrioridadSelector
                          value={inc.prioridad ?? 3}
                          onChange={(p) => onUpdatePrioridad?.(inc.id, p)}
                        />
                      )}
                      {inc.origen_tipo && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{inc.origen_tipo}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{inc.concepto || "Sin concepto"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {prop?.nombre_interno || "Sin propiedad"}
                      {inc.responsable_pago ? ` · ${inc.responsable_pago}` : ""}
                      {" · "}{inc.created_at ? new Date(inc.created_at).toLocaleDateString("es-ES") : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => onView(inc)}>
                      <Eye size={13} /> Ver
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs gap-1 text-destructive border-destructive/30">
                          <Trash2 size={13} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar incidencia #{inc.numero_incidencia}?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminarán todos los datos asociados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(inc.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default IncidenciasSection;
