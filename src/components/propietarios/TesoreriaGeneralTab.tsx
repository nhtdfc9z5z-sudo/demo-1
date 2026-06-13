import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Filter, TrendingDown, TrendingUp, Wallet, Download, FileSpreadsheet, FileText, Receipt, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import GraficaAnual from "./GraficaAnual";
import { usePropertyGastos, CATEGORIAS_GASTO, type PropertyGasto } from "@/hooks/usePropertyGastos";
import { useProfile } from "@/hooks/useProfile";
import { useIncidencias } from "@/hooks/useIncidencias";
import FacturaUploadDialog from "./FacturaUploadDialog";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import { exportTesoreriaCSV, exportInformeAnualCSV, exportInformeIRPF } from "@/lib/exportUtils";
import { getAllGastosFijos, totalFijosMensual as calcTotalFijosMensual } from "@/lib/finanzasEngine";

const categoriaColor: Record<string, string> = {
  ibi: "bg-amber-100 text-amber-800",
  basuras: "bg-lime-100 text-lime-800",
  comunidad: "bg-sky-100 text-sky-800",
  derrama: "bg-orange-100 text-orange-800",
  seguro_vivienda: "bg-violet-100 text-violet-800",
  seguro_impago: "bg-pink-100 text-pink-800",
  prestamo: "bg-red-100 text-red-800",
  suministros: "bg-cyan-100 text-cyan-800",
  reformas: "bg-indigo-100 text-indigo-800",
  mantenimiento: "bg-teal-100 text-teal-800",
  arreglos: "bg-emerald-100 text-emerald-800",
  otro: "bg-zinc-100 text-zinc-700",
};

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface TesoreriaGeneralTabProps {
  properties: Property[];
  inquilinos: Inquilino[];
  pagos: PagoRenta[];
}

const TesoreriaGeneralTab = ({ properties, inquilinos, pagos }: TesoreriaGeneralTabProps) => {
  const navigate = useNavigate();
  const { gastos, loading } = usePropertyGastos();
  const { profile } = useProfile();
  const { incidencias } = useIncidencias();
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterProp, setFilterProp] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("fecha");
  const [showFacturaDialog, setShowFacturaDialog] = useState(false);
  const currentYear = new Date().getFullYear();

  const gastosFijos = useMemo(() => getAllGastosFijos(properties), [properties]);

  const totalFijosMensualVal = useMemo(() => calcTotalFijosMensual(gastosFijos), [gastosFijos]);

  const totalManualAnual = useMemo(() => {
    const yr = new Date().getFullYear();
    return gastos
      .filter(g => new Date(g.fecha).getFullYear() === yr)
      .reduce((sum, g) => sum + Number(g.importe), 0);
  }, [gastos]);

  // Income from rent payments
  const ingresosAnuales = useMemo(() => {
    return pagos
      .filter(p => p.anio === currentYear && p.propietario_confirmado && p.importe_pagado)
      .reduce((sum, p) => sum + Number(p.importe_pagado), 0);
  }, [pagos, currentYear]);

  const ingresosPorVivienda = useMemo(() => {
    const filtered = filterProp !== "all"
      ? pagos.filter(p => p.anio === currentYear && p.property_id === filterProp)
      : pagos.filter(p => p.anio === currentYear);
    
    return filtered
      .sort((a, b) => b.mes - a.mes)
      .map(p => {
        const prop = properties.find(pr => pr.id === p.property_id);
        const inq = inquilinos.find(i => i.id === p.inquilino_id);
        return {
          ...p,
          propertyName: prop?.nombre_interno || (prop as any)?.nombre || "Activo sin nombre",
          inquilinoName: inq?.nombre || "",
        };
      });
  }, [pagos, currentYear, filterProp, properties, inquilinos]);

  const totalGastosAnual = totalFijosMensualVal * 12 + totalManualAnual;
  const balanceAnual = ingresosAnuales - totalGastosAnual;

  const filteredGastos = useMemo(() => {
    let result = gastos;
    if (filterCat !== "all") result = result.filter(g => g.categoria === filterCat);
    if (filterProp !== "all") result = result.filter(g => g.property_id === filterProp);
    if (sortBy === "fecha") result = [...result].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    if (sortBy === "importe") result = [...result].sort((a, b) => Number(b.importe) - Number(a.importe));
    if (sortBy === "categoria") result = [...result].sort((a, b) => a.categoria.localeCompare(b.categoria));
    return result;
  }, [gastos, filterCat, filterProp, sortBy]);

  const filteredFijos = useMemo(() => {
    let result = gastosFijos;
    if (filterProp !== "all") result = result.filter(g => g.id.startsWith(filterProp));
    if (filterCat !== "all") result = result.filter(g => g.categoria === filterCat);
    return result;
  }, [gastosFijos, filterProp, filterCat]);

  return (
    <div>
      {/* Fila 1 — KPIs: ingresos, gastos totales y balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Ingresos {currentYear}</p>
          <p className="text-xl font-bold text-emerald-600">{formatImporte(ingresosAnuales)}€</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Gastos totales {currentYear}</p>
          <p className="text-xl font-bold text-destructive">{formatImporte(totalGastosAnual)}€</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Fijos/mes: {formatImporte(totalFijosMensualVal)}€</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Balance {currentYear}</p>
          <p className={`text-xl font-bold ${balanceAnual >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {balanceAnual >= 0 ? "+" : ""}{formatImporte(balanceAnual)}€
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        <Select value={filterProp} onValueChange={setFilterProp}>
          <SelectTrigger className="min-h-[44px] text-sm w-full sm:w-[180px]">
            <SelectValue placeholder="Activo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los activos</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterProp !== "all" && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] text-sm gap-1.5 w-full sm:w-auto"
            onClick={() => navigate(`/finanzas?propertyId=${filterProp}`)}
          >
            <ArrowUpRight size={14} />
            Ver detalle de este activo
          </Button>
        )}
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="min-h-[44px] text-sm w-full sm:w-[160px]">
            <Filter size={14} className="mr-1" />
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS_GASTO.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="min-h-[44px] text-sm w-full sm:w-[150px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fecha">Por fecha</SelectItem>
            <SelectItem value="importe">Por importe</SelectItem>
            <SelectItem value="categoria">Por categoría</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
          <Button variant="outline" size="sm" className="min-h-[44px] text-sm gap-1.5 flex-1 sm:flex-none" onClick={() => setShowFacturaDialog(true)}>
            <Receipt size={14} />
            Nueva factura
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px] text-sm gap-1.5 flex-1 sm:flex-none">
                <Download size={14} />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => exportTesoreriaCSV(currentYear, properties, inquilinos, pagos, gastos)}
              >
                <FileSpreadsheet size={14} />
                Finanzas {currentYear} (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => exportTesoreriaCSV(currentYear - 1, properties, inquilinos, pagos, gastos)}
              >
                <FileSpreadsheet size={14} />
                Finanzas {currentYear - 1} (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => exportInformeAnualCSV(currentYear, properties, inquilinos, pagos, gastos)}
              >
                <FileText size={14} />
                Informe anual {currentYear}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => exportInformeAnualCSV(currentYear - 1, properties, inquilinos, pagos, gastos)}
              >
                <FileText size={14} />
                Informe anual {currentYear - 1}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => exportInformeIRPF(currentYear - 1, properties, inquilinos, pagos, gastos, profile?.nombre ? `${profile.nombre} ${profile.apellidos || ""}`.trim() : undefined, profile?.nif || undefined)}
              >
                <FileText size={14} className="text-primary" />
                Informe IRPF {currentYear - 1}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Fila 2 — Ingresos por activo (izq) · Gastos registrados (der) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Columna izquierda — Ingresos */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-600" />
            Ingresos por activo {currentYear}
          </h2>
          {ingresosPorVivienda.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4">No hay pagos de renta confirmados este año.</p>
          ) : (
            <div className="space-y-2">
              {ingresosPorVivienda.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/finanzas?propertyId=${p.property_id}`)}
                  className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3 cursor-pointer hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className="text-xs shrink-0 bg-emerald-100 text-emerald-800">Renta</Badge>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground block truncate">
                        {p.propertyName} · {p.inquilinoName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {MESES[p.mes - 1]} {p.anio}
                        {p.propietario_confirmado ? " · Confirmado" : p.inquilino_notificado ? " · Notificado" : " · Pendiente"}
                      </span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${p.propietario_confirmado ? "text-emerald-600" : "text-muted-foreground"}`}>
                    +{formatImporte(Number(p.importe_pagado || 0))}€
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha — Gastos */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingDown size={14} />
            Gastos registrados
          </h2>

          {/* Gastos fijos */}
          {filteredFijos.length > 0 && (
            <div className="space-y-2 mb-3">
              {filteredFijos.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className={`text-xs shrink-0 ${categoriaColor[g.categoria] || categoriaColor.otro}`}>
                      {CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria}
                    </Badge>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground block truncate">{g.concepto}</span>
                      <span className="text-xs text-muted-foreground">{g.propertyName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground capitalize">{g.recurrencia}</span>
                    <span className="text-sm font-semibold text-foreground">{formatImporte(g.importe)}€</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gastos manuales */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse h-14" />)}
            </div>
          ) : filteredGastos.length === 0 && filteredFijos.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4 text-center">
              No hay gastos registrados. Usa las finanzas de cada vivienda para añadir gastos.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredGastos.map(g => {
                const prop = properties.find(p => p.id === g.property_id);
                const propName = prop?.nombre_interno || (prop as any)?.nombre || "Activo sin nombre";
                return (
                  <div key={g.id} className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/finanzas?propertyId=${g.property_id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className={`text-xs shrink-0 ${categoriaColor[g.categoria] || categoriaColor.otro}`}>
                        {CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria}
                      </Badge>
                      <div className="min-w-0">
                        <span className="text-sm text-foreground block truncate">{g.concepto || "Sin concepto"}</span>
                        <span className="text-xs text-muted-foreground">
                          {propName} · {new Date(g.fecha).toLocaleDateString("es-ES")}
                          {g.recurrente && g.recurrencia && ` · ${g.recurrencia}`}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{formatImporte(Number(g.importe))}€</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Gráfica general */}
      <GraficaAnual
        properties={properties}
        inquilinos={inquilinos}
        pagos={pagos}
        gastosManuales={gastos}
        incidencias={incidencias}
        title="Resumen económico general"
      />

      <FacturaUploadDialog
        open={showFacturaDialog}
        onOpenChange={setShowFacturaDialog}
        properties={properties}
      />
    </div>
  );
};

export default TesoreriaGeneralTab;
