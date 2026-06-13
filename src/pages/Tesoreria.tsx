import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Receipt, TrendingDown, TrendingUp, Filter, Download, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight, Search, Euro } from "lucide-react";
import { Brand } from "@/components/Brand";
import PagosHistorial from "@/components/propietarios/PagosHistorial";
import HistoricalRentWizard from "@/components/propietarios/HistoricalRentWizard";
import { useRentaActualizaciones } from "@/hooks/useRentaActualizaciones";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

import GraficaAnual from "@/components/propietarios/GraficaAnual";
import { usePropertyGastos, CATEGORIAS_GASTO, RECURRENCIAS, type PropertyGasto } from "@/hooks/usePropertyGastos";
import { useProperties, type Property, type InsuranceEntry } from "@/hooks/useProperties";
import { useInquilinos } from "@/hooks/useInquilinos";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { useContratos } from "@/hooks/useContratos";
import { logContratoEvento } from "@/lib/contratoHistorialEvents";
import { useIncidencias } from "@/hooks/useIncidencias";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { getGastosFijosFromProperty as getGastosFijosEngine, totalFijosMensual as calcTotalFijosMensual } from "@/lib/finanzasEngine";
import { exportTesoreriaCSV } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";
import FacturaUploadDialog from "@/components/propietarios/FacturaUploadDialog";

import type { GastoFijo as EngineGastoFijo } from "@/lib/finanzasEngine";

type GastoFijo = EngineGastoFijo & { origen: "ficha" };

function getGastosFijosFromProperty(prop: Property): GastoFijo[] {
  return getGastosFijosEngine(prop).map(g => ({ ...g, origen: "ficha" as const }));
}

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

const emptyForm = {
  categoria: "otro",
  concepto: "",
  importe: "",
  fecha: new Date().toISOString().split("T")[0],
  fecha_devengo: "",
  recurrente: false,
  recurrencia: "" as string,
  fecha_fin: "",
  notas: "",
};

const Tesoreria = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const propertyId = searchParams.get("propertyId") || undefined;

  const { user } = useAuth();
  const { toast } = useToast();
  const { properties, updateProperty } = useProperties();
  const { inquilinos } = useInquilinos();
  const { pagos, confirmarPago, updatePago, deletePago, registrarHistorico, registrarHistoricoBatch } = usePagosRenta();
  const { gastos, loading, createGasto, updateGasto, deleteGasto } = usePropertyGastos(propertyId);
  const { contratos } = useContratos();
  const { incidencias } = useIncidencias();

  const property = properties.find(p => p.id === propertyId);
  const inquilino = inquilinos.find(i => i.property_id === propertyId && i.rol_inquilino !== "avalista");
  const rentaResuelta = propertyId ? resolveRentaEsperada(propertyId, inquilinos, contratos) : null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showFacturaDialog, setShowFacturaDialog] = useState(false);
  const [quienPagaOpen, setQuienPagaOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [propertySearchOpen, setPropertySearchOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [showRentas, setShowRentas] = useState(false);
  const [showHistoricalWizard, setShowHistoricalWizard] = useState(false);

  const gastosFijos = useMemo(() => property ? getGastosFijosFromProperty(property) : [], [property]);

  const totalFijosMensual = useMemo(() => calcTotalFijosMensual(gastosFijos), [gastosFijos]);

  const totalManualAnual = useMemo(() => {
    return gastos
      .filter(g => new Date(g.fecha).getFullYear() === selectedYear)
      .reduce((sum, g) => sum + Number(g.importe), 0);
  }, [gastos, selectedYear]);

  const filteredGastos = useMemo(() => {
    let result = gastos.filter(g => new Date(g.fecha).getFullYear() === selectedYear);
    if (filterCat !== "all") result = result.filter(g => g.categoria === filterCat);
    return result;
  }, [gastos, filterCat, selectedYear]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, fecha: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const openEdit = (g: PropertyGasto) => {
    setEditingId(g.id);
    setForm({
      categoria: g.categoria,
      concepto: g.concepto || "",
      importe: String(g.importe),
      fecha: g.fecha,
      fecha_devengo: g.fecha_devengo || "",
      recurrente: g.recurrente,
      recurrencia: g.recurrencia || "",
      fecha_fin: g.fecha_fin || "",
      notas: g.notas || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!propertyId || !form.importe) return;
    const payload = {
      property_id: propertyId,
      categoria: form.categoria,
      concepto: form.concepto || null,
      importe: parseFloat(form.importe),
      fecha: form.fecha,
      fecha_devengo: form.fecha_devengo || null,
      recurrente: form.recurrente,
      recurrencia: form.recurrente ? form.recurrencia || null : null,
      fecha_fin: form.fecha_fin || null,
      notas: form.notas || null,
    };
    if (editingId) {
      await updateGasto(editingId, payload);
    } else {
      await createGasto(payload as any);
    }
    setDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/propietarios")} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <Brand size="sm" symbolOnly />
          <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Receipt size={18} />
            Cartera
          </h1>
        </div>
      </header>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div>
            {property && (() => {
              const sortedProps = [...properties].sort((a, b) => a.nombre_interno.localeCompare(b.nombre_interno));
              const currentIdx = sortedProps.findIndex(p => p.id === property.id);
              const prevProp = currentIdx > 0 ? sortedProps[currentIdx - 1] : null;
              const nextProp = currentIdx < sortedProps.length - 1 ? sortedProps[currentIdx + 1] : null;
              const goTo = (id: string) => { setSearchParams({ propertyId: id }); setSelectedYear(new Date().getFullYear()); setPropertySearchOpen(false); };
              return (
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={!prevProp} onClick={() => prevProp && goTo(prevProp.id)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <p className="text-sm text-muted-foreground truncate">
                    {property.nombre_interno}{property.direccion_completa ? ` · ${property.direccion_completa}` : ""}
                  </p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={!nextProp} onClick={() => nextProp && goTo(nextProp.id)}>
                    <ChevronRight size={14} />
                  </Button>
                  <Popover open={propertySearchOpen} onOpenChange={setPropertySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <ChevronDown size={14} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="relative mb-2">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar vivienda…"
                          value={propertySearchQuery}
                          onChange={e => setPropertySearchQuery(e.target.value)}
                          className="h-8 pl-8 text-sm rounded-lg"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {sortedProps
                          .filter(p => p.nombre_interno.toLowerCase().includes(propertySearchQuery.toLowerCase()) || (p.direccion_completa || "").toLowerCase().includes(propertySearchQuery.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => goTo(p.id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-muted ${p.id === property.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
                            >
                              {p.nombre_interno}
                            </button>
                          ))
                        }
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })()}
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[48px] text-center">{selectedYear}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= new Date().getFullYear()}>
              <ChevronRight size={16} />
            </Button>
          </div>
          {inquilino && (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowRentas(true)}>
              <Euro size={14} />
              Rentas
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowFacturaDialog(true)}>
            <Receipt size={14} />
            Nueva factura
          </Button>
        </div>

        {/* Rentas view */}
        {showRentas && property && user ? (
          <div className="mb-6">
            <PagosHistorial
              pagos={pagos.filter(p => p.property_id === property.id)}
              rentaMensual={rentaResuelta}
              propertyName={property.nombre_interno}
              propertyId={property.id}
              inquilinoId={inquilino?.id}
              fechaInicio={inquilino?.fecha_entrada}
              fechaInicioControl={(() => {
                const c = property ? contratos.find(c => c.property_id === property.id && !c.archivado && c.estado !== "finalizado") : null;
                return c?.fecha_inicio_control || c?.fecha_inicio || null;
              })()}
              userId={user.id}
              onBack={() => setShowRentas(false)}
              onUpdatePago={updatePago}
              onDeletePago={deletePago}
              onConfirmarPago={confirmarPago}
              onImportHistorical={inquilino?.fecha_entrada ? () => setShowHistoricalWizard(true) : undefined}
            />
            {showHistoricalWizard && inquilino && inquilino.fecha_entrada && (
              <HistoricalRentWizard
                open={showHistoricalWizard}
                onOpenChange={setShowHistoricalWizard}
                propertyName={property.nombre_interno}
                propertyId={property.id}
                inquilinoId={inquilino.id}
                rentaMensual={rentaResuelta || 0}
                fechaInicio={inquilino.fecha_entrada}
                userId={user.id}
                onComplete={async (data) => {
                  // Generate historical payments
                  const startDate = new Date(inquilino.fecha_entrada!);
                  const now = new Date();
                  const months: { mes: number; anio: number }[] = [];
                  let y = startDate.getFullYear();
                  let m = startDate.getMonth() + 1;
                  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
                    months.push({ mes: m, anio: y });
                    m++;
                    if (m > 12) { m = 1; y++; }
                  }

                  const unpaidSet = new Set(data.unpaidMonths.map(u => `${u.mes}-${u.anio}`));

                  const reconstruidos: Array<{ mes: number; anio: number; importe: number }> = [];
                  const pendientes: Array<{ mes: number; anio: number; importe: number }> = [];
                  const planeados: Array<{
                    mes: number; anio: number; importe_pagado: number;
                    tipo_registro: "historico_reconstruido" | "pendiente";
                    afecta_fiscalidad: boolean; notas_acuerdo: string;
                  }> = [];
                  for (const month of months) {
                    const key = `${month.mes}-${month.anio}`;
                    let rent = rentaResuelta || 0;
                    for (const update of data.rentUpdates) {
                      const updateDate = new Date(update.fecha);
                      const monthDate = new Date(month.anio, month.mes - 1, 15);
                      if (updateDate <= monthDate) rent = update.importe_nuevo;
                    }
                    const isPendiente = !data.allPaid && unpaidSet.has(key);
                    planeados.push({
                      mes: month.mes, anio: month.anio,
                      importe_pagado: rent,
                      tipo_registro: isPendiente ? "pendiente" : "historico_reconstruido",
                      afecta_fiscalidad: !isPendiente && !!data.afectaFiscalidad,
                      notas_acuerdo: isPendiente
                        ? "Pendiente histórico (anterior al alta en CapitalRent)"
                        : "Histórico reconstruido (anterior al alta en CapitalRent)",
                    });
                    if (isPendiente) pendientes.push({ mes: month.mes, anio: month.anio, importe: rent });
                    else reconstruidos.push({ mes: month.mes, anio: month.anio, importe: rent });
                  }
                  // Ejecutamos en batch: nunca sobrescribirá pagos_real existentes.
                  const summary = await registrarHistoricoBatch(
                    property.id, inquilino.id, user.id,
                    planeados.map(p => ({ ...p, origen: "reconstruccion_historica" })),
                    data.estrategia,
                  );
                  const omitidosKeys = new Set([
                    ...summary.omitidos.map(o => `${o.mes}-${o.anio}`),
                    ...summary.omitidos_por_decision.map(o => `${o.mes}-${o.anio}`),
                  ]);
                  // Limpiamos de las listas de trazabilidad lo que NO se aplicó.
                  const filt = (arr: Array<{ mes: number; anio: number; importe: number }>) =>
                    arr.filter(x => !omitidosKeys.has(`${x.mes}-${x.anio}`));
                  const reconstruidosAplicados = filt(reconstruidos);
                  const pendientesAplicados = filt(pendientes);
                  if (summary.omitidos.length > 0) {
                    toast({
                      title: `${summary.omitidos.length} mes(es) protegidos`,
                      description: "Se han omitido meses con un cobro real ya registrado para no sobrescribirlos.",
                    });
                  }
                  if (summary.omitidos_por_decision.length > 0) {
                    toast({
                      title: `${summary.omitidos_por_decision.length} mes(es) omitidos`,
                      description: "Saltados por la estrategia anti-duplicidad elegida.",
                    });
                  }
                  if (summary.errores.length > 0) {
                    toast({
                      title: `${summary.errores.length} error(es) en la reconstrucción`,
                      description: summary.errores[0]?.message || "Revisa la consola.",
                      variant: "destructive",
                    });
                  }

                  // Save rent updates
                  for (const update of data.rentUpdates) {
                    await supabase.from("renta_actualizaciones").insert({
                      user_id: user.id,
                      property_id: property.id,
                      fecha_efectiva: update.fecha,
                      importe_anterior: update.importe_anterior,
                      importe_nuevo: update.importe_nuevo,
                      motivo: update.motivo,
                    } as any);
                  }

                  // Trazabilidad: localizamos el contrato vigente para registrar el evento
                  try {
                    const { data: contratoRow } = await supabase
                      .from("contratos_arrendamiento")
                      .select("id")
                      .eq("property_id", property.id)
                      .eq("inquilino_id", inquilino.id)
                      .eq("user_id", user.id)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (contratoRow?.id) {
                      if (reconstruidosAplicados.length > 0) {
                        await logContratoEvento({
                          contratoId: contratoRow.id,
                          propertyId: property.id,
                          userId: user.id,
                          tipo: data.allPaid ? "renta_historica_regularizada" : "historico_economico_reconstruido",
                          titulo: data.allPaid ? "Histórico regularizado (al día)" : "Histórico económico reconstruido",
                          importeTotal: reconstruidosAplicados.reduce((s, x) => s + x.importe, 0),
                          metadata: {
                            origen: "reconstruccion_historica",
                            meses_afectados: reconstruidosAplicados,
                            afecta_finanzas_actuales: false,
                            afecta_fiscalidad: !!data.afectaFiscalidad,
                            actor_id: user.id,
                            estrategia_elegida: data.estrategia,
                            meses_creados: summary.creados.map(o => ({ mes: o.mes, anio: o.anio })),
                            meses_actualizados: summary.actualizados.map(o => ({ mes: o.mes, anio: o.anio })),
                            meses_omitidos_pago_real: summary.omitidos.map(o => ({ mes: o.mes, anio: o.anio })),
                            meses_omitidos_por_decision_usuario: summary.omitidos_por_decision.map(o => ({ mes: o.mes, anio: o.anio })),
                            omitidos_pago_real: summary.omitidos.map(o => ({ mes: o.mes, anio: o.anio })),
                          },
                        });
                      }
                      if (pendientesAplicados.length > 0) {
                        await logContratoEvento({
                          contratoId: contratoRow.id,
                          propertyId: property.id,
                          userId: user.id,
                          tipo: "pago_pendiente_historico",
                          titulo: "Pagos pendientes históricos",
                          importeTotal: pendientesAplicados.reduce((s, x) => s + x.importe, 0),
                          metadata: {
                            origen: "reconstruccion_historica",
                            meses_afectados: pendientesAplicados,
                            afecta_finanzas_actuales: false,
                            afecta_fiscalidad: false,
                            actor_id: user.id,
                          },
                        });
                      }
                    }
                  } catch (err) { console.error("log contrato_historial:", err); }
                }}
              />
            )}
          </div>
        ) : (
        <>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Gastos fijos / mes</p>
            <p className="text-lg font-bold text-foreground">{formatImporte(totalFijosMensual)}€</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Gastos manuales {selectedYear}</p>
            <p className="text-lg font-bold text-foreground">{formatImporte(totalManualAnual)}€</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 col-span-2 md:col-span-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Total anual estimado</p>
            <p className="text-lg font-bold text-red-600">{formatImporte(totalFijosMensual * 12 + totalManualAnual)}€</p>
          </div>
        </div>

        {/* Toggles: quién paga */}
        {property && (
          <div className="mb-6 bg-card rounded-xl border border-border">
            <button
              onClick={() => setQuienPagaOpen(!quienPagaOpen)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div>
                <h2 className="text-sm font-semibold text-foreground">¿Quién paga cada concepto?</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Si lo paga el inquilino, no se contabiliza como gasto tuyo.</p>
              </div>
              {quienPagaOpen ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
            </button>
            {quienPagaOpen && (
              <div className="px-4 pb-4 space-y-3">
                {[
                  { key: "ibi_paga_inquilino", label: "IBI", show: !!property.ibi_importe },
                  { key: "basuras_paga_inquilino", label: "Basuras", show: !!property.basuras_importe },
                  { key: "seguro_impago_paga_inquilino", label: "Seguro de impago", show: true },
                ].filter(t => t.show).map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{toggle.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {(property as any)[toggle.key] ? "Inquilino" : "Propietario"}
                      </span>
                      <Switch
                        checked={(property as any)[toggle.key] || false}
                        onCheckedChange={async (v) => {
                          await updateProperty(property.id, { [toggle.key]: v } as any);
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Suministros desglosados */}
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Suministros</h3>
                  <div className="space-y-3">
                    {[
                      { key: "agua_paga_inquilino", label: "Agua", communityKey: "agua_incluida_comunidad" },
                      { key: "calefaccion_paga_inquilino", label: "Calefacción", communityKey: "calefaccion_incluida_comunidad" },
                      { key: "luz_paga_inquilino", label: "Luz", communityKey: null },
                      { key: "gas_paga_inquilino", label: "Gas", communityKey: null },
                      { key: "internet_paga_inquilino", label: "Internet", communityKey: null },
                    ].map(toggle => {
                      const incluidaComunidad = toggle.communityKey && (property as any)[toggle.communityKey];
                      return (
                        <div key={toggle.key}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">{toggle.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {incluidaComunidad ? "Comunidad" : (property as any)[toggle.key] ? "Inquilino" : "Propietario"}
                              </span>
                              <Switch
                                checked={(property as any)[toggle.key] || false}
                                disabled={!!incluidaComunidad}
                                onCheckedChange={async (v) => {
                                  await updateProperty(property.id, { [toggle.key]: v } as any);
                                }}
                              />
                            </div>
                          </div>
                          {toggle.communityKey && (
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">Incluido en comunidad</span>
                              <Switch
                                checked={(property as any)[toggle.communityKey] || false}
                                onCheckedChange={async (v) => {
                                  await updateProperty(property.id, { [toggle.communityKey!]: v } as any);
                                }}
                                className="scale-75"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gastos fijos from property */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingDown size={14} />
            Gastos fijos (desde ficha de la vivienda)
          </h2>
          {gastosFijos.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4">No hay gastos fijos configurados en la ficha.</p>
          ) : (() => {
            const MESES_FULL_FIJO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
            const MESES_MAP_FIJO: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
            const nowFijo = new Date();

            const getNextPayment = (g: GastoFijo): string | null => {
              if (!property) return null;
              if (g.recurrencia === "mensual") {
                const nextMonth = nowFijo.getDate() > 15 ? nowFijo.getMonth() + 1 : nowFijo.getMonth();
                const nextDate = new Date(nowFijo.getFullYear(), nextMonth, 1);
                return `${MESES_FULL_FIJO[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
              }
              if (g.recurrencia === "anual") {
                let mesPago: string | null = null;
                if (g.categoria === "ibi" && property.ibi_fecha_pago) mesPago = property.ibi_fecha_pago;
                else if (g.categoria === "basuras" && property.basuras_fecha_pago) mesPago = property.basuras_fecha_pago;
                if (mesPago) {
                  const mesIdx = MESES_MAP_FIJO[mesPago.toLowerCase()];
                  if (mesIdx !== undefined) {
                    let nextDate = new Date(nowFijo.getFullYear(), mesIdx, 1);
                    if (nextDate <= nowFijo) nextDate = new Date(nowFijo.getFullYear() + 1, mesIdx, 1);
                    return `${MESES_FULL_FIJO[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
                  }
                }
              }
              return null;
            };

            return (
              <div className="space-y-2">
                {gastosFijos.map(g => {
                  const nextPay = getNextPayment(g);
                  return (
                    <div key={g.id} className="bg-card rounded-xl border border-border px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className={`text-[10px] ${categoriaColor[g.categoria] || categoriaColor.otro}`}>
                            {CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria}
                          </Badge>
                          <span className="text-sm text-foreground">{g.concepto}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground capitalize">{g.recurrencia}</span>
                          <span className="text-sm font-semibold text-foreground">~{formatImporte(g.importe)}€ <span className="text-[9px] font-normal text-muted-foreground italic">(orientativo)</span></span>
                        </div>
                      </div>
                      {nextPay && (
                        <p className="text-[10px] text-muted-foreground mt-1 ml-0.5 italic">
                          Próximo cargo previsto: <span className="capitalize">{nextPay}</span> · importe orientativo, sin carácter vinculante
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Manual gastos */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Gastos registrados</h2>
            <div className="flex items-center gap-2">
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <Filter size={12} className="mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIAS_GASTO.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => exportTesoreriaCSV(new Date().getFullYear(), property ? [property] : properties, inquilinos, pagos, gastos)}>
                <Download size={14} />
                Excel
              </Button>
              <Button size="sm" onClick={openCreate} className="rounded-xl gap-1.5">
                <Plus size={14} />
                Gasto
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse h-14" />)}
            </div>
          ) : filteredGastos.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4 text-center">
              No hay gastos registrados. Pulsa "+ Gasto" para añadir uno.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredGastos.map(g => (
                <div key={g.id} className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${categoriaColor[g.categoria] || categoriaColor.otro}`}>
                      {CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria}
                    </Badge>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground block truncate">{g.concepto || "Sin concepto"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(g.fecha).toLocaleDateString("es-ES")}
                        {g.recurrente && g.recurrencia && ` · ${g.recurrencia}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-foreground">{formatImporte(Number(g.importe))}€</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                      <Pencil size={13} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 size={13} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteGasto(g.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historial combinado ingresos y gastos */}
        {property && (() => {
          const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          const propertyPagos = pagos.filter(p => p.property_id === property.id && p.anio === selectedYear);
          const ingresoItems = propertyPagos.map(p => {
            const inq = inquilinos.find(i => i.id === p.inquilino_id);
            const fecha = new Date(p.anio, p.mes - 1, 15);
            return {
              id: `ing-${p.id}`,
              tipo: "ingreso" as const,
              fecha,
              concepto: `Renta ${MESES[p.mes - 1]} ${p.anio}`,
              detalle: inq?.nombre || "",
              importe: Number(p.importe_pagado || 0),
              estado: p.propietario_confirmado ? "confirmado" : p.inquilino_notificado ? "notificado" : "pendiente",
            };
          });
          const gastoItems = gastos.filter(g => new Date(g.fecha).getFullYear() === selectedYear).map(g => ({
            id: `gas-${g.id}`,
            tipo: "gasto" as const,
            fecha: new Date(g.fecha),
            concepto: g.concepto || (CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria),
            detalle: g.recurrente && g.recurrencia ? g.recurrencia : "",
            importe: Number(g.importe),
            estado: "registrado",
            categoria: g.categoria,
          }));

          // Add fixed expenses from property card — only past ones appear as "occurred"
          const MESES_MAP: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
          const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
          const now = new Date();
          const fijoItems: (typeof gastoItems[0] & { prevision?: boolean })[] = [];

          const addFijo = (id: string, concepto: string, importe: number, mesIdx: number, categoria: string) => {
            const fechaGasto = new Date(selectedYear, mesIdx, 1);
            const isPast = fechaGasto <= now;
            fijoItems.push({
              id,
              tipo: "gasto",
              fecha: fechaGasto,
              concepto,
              detalle: isPast ? "Gasto fijo · ficha" : `Previsto ${MESES[mesIdx]} ${selectedYear} · estimación orientativa`,
              importe,
              estado: isPast ? "registrado" : "prevision",
              categoria,
              prevision: !isPast,
            });
          };

          if (property.ibi_importe && !(property as any).ibi_paga_inquilino && property.ibi_fecha_pago) {
            const mesIdx = MESES_MAP[property.ibi_fecha_pago.toLowerCase()];
            if (mesIdx !== undefined) addFijo(`fijo-ibi-${selectedYear}`, "IBI", Number(property.ibi_importe), mesIdx, "ibi");
          }
          if (property.basuras_importe && !(property as any).basuras_paga_inquilino && property.basuras_fecha_pago) {
            const mesIdx = MESES_MAP[property.basuras_fecha_pago.toLowerCase()];
            if (mesIdx !== undefined) addFijo(`fijo-basuras-${selectedYear}`, "Basuras", Number(property.basuras_importe), mesIdx, "basuras");
          }
          // Comunidad (monthly)
          if (property.cuota_comunidad) {
            for (let m = 0; m < 12; m++) {
              addFijo(`fijo-comunidad-${selectedYear}-${m}`, "Comunidad", Number(property.cuota_comunidad), m, "comunidad");
            }
          }

          const historial = [...ingresoItems, ...gastoItems, ...fijoItems].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

          return (
            <div className="mb-6">

              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <History size={14} />
                Historial de movimientos
              </h2>
              {historial.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4 text-center">No hay movimientos registrados.</p>
              ) : (
                <div className="space-y-1.5">
                  {historial.map(item => {
                    const isPrevision = (item as any).prevision;
                    return (
                      <div key={item.id} className={`flex items-center justify-between bg-card rounded-xl border px-4 py-2.5 ${isPrevision ? "border-dashed border-muted-foreground/30 opacity-60" : "border-border"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          {item.tipo === "ingreso" ? (
                            <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                          ) : (
                            <TrendingDown size={14} className={`shrink-0 ${isPrevision ? "text-muted-foreground" : "text-destructive"}`} />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm text-foreground block truncate">
                              {item.concepto}
                              {isPrevision && <span className="text-[10px] ml-1.5 text-muted-foreground italic">(previsión)</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {item.fecha.toLocaleDateString("es-ES")}
                              {item.detalle ? ` · ${item.detalle}` : ""}
                              {item.tipo === "ingreso" && item.estado !== "confirmado" && ` · ${item.estado === "notificado" ? "Notificado" : "Pendiente"}`}
                            </span>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${item.tipo === "ingreso" ? "text-emerald-600" : isPrevision ? "text-muted-foreground" : "text-destructive"}`}>
                          {item.tipo === "ingreso" ? "+" : "~"}{formatImporte(item.importe)}€
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}


        {property && (
          <GraficaAnual
            properties={[property]}
            inquilinos={inquilinos}
            pagos={pagos}
            filterPropertyId={property.id}
            gastosManuales={gastos}
            incidencias={incidencias}
            title={`Resumen económico · ${property.nombre_interno}`}
          />
        )}
        </>
        )}
      </div>

      {/* Dialog for create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingId && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setDialogOpen(false);
                  setShowFacturaDialog(true);
                }}
              >
                <Receipt size={14} />
                Registrar con factura completa
              </Button>
            )}
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_GASTO.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Reparación caldera" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Importe (€)</Label>
                <Input type="number" step="0.01" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Fecha de devengo (opcional)</Label>
              <Input type="date" value={form.fecha_devengo} onChange={e => setForm(f => ({ ...f, fecha_devengo: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Si se informa, se usará para imputación fiscal; si no, se usará la fecha principal.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.recurrente} onCheckedChange={v => setForm(f => ({ ...f, recurrente: v }))} />
              <Label>Gasto recurrente</Label>
            </div>
            {form.recurrente && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Recurrencia</Label>
                  <Select value={form.recurrencia} onValueChange={v => setForm(f => ({ ...f, recurrencia: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {RECURRENCIAS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha fin (opcional)</Label>
                  <Input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.importe}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FacturaUploadDialog
        open={showFacturaDialog}
        onOpenChange={setShowFacturaDialog}
        properties={properties}
        defaultPropertyId={propertyId || null}
      />
    </div>
  );
};

export default Tesoreria;
