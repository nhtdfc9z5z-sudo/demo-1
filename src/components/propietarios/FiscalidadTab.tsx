import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PersonaContrato } from "@/lib/contratoRoles";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, Send, FileText, Download, AlertTriangle, CheckCircle2, Clock, Building2, TrendingUp, TrendingDown, Euro, FileCheck, Shield, Receipt, Home, Users, Briefcase, Calendar, Eye, X, ChevronDown, ChevronUp, Package, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFiscalData, type FiscalValidation, type ExpedienteEstado, type FiscalNavigationTarget } from "@/hooks/useFiscalData";
import FiscalEnviarDialog from "./fiscalidad/FiscalEnviarDialog";
import FiscalGastosSection from "./fiscalidad/FiscalGastosSection";
import FiscalValidacionesSection from "./fiscalidad/FiscalValidacionesSection";
import FiscalDetectedInfo from "./fiscalidad/FiscalDetectedInfo";
import FiscalPrevision from "./fiscalidad/FiscalPrevision";
import FiscalHistorialRentas from "./fiscalidad/FiscalHistorialRentas";
import PackFiscalGestor from "./fiscalidad/PackFiscalGestor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFacturas } from "@/hooks/useFacturas";
import { usePropertyGastos } from "@/hooks/usePropertyGastos";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { useAuth } from "@/hooks/useAuth";
import { listOwnersInPortfolio } from "@/lib/fiscalPack";
import { getGastosFijosFiscalesAnuales } from "@/lib/finanzasEngine";
import {
  calcularAmortizacion,
  aplicaReduccion60,
  calcularRendimientoFiscal,
} from "@/lib/fiscal/amortizacionReduccion";
import { filterPersonasParaAnioFiscal, type ContratoVigenciaInput, type PersonaConContrato } from "@/lib/contratosVigentes";
import { useContratos } from "@/hooks/useContratos";
import { useHabitaciones } from "@/hooks/useHabitaciones";
import { useGarajes } from "@/hooks/useGarajes";
import { useTrasteros } from "@/hooks/useTrasteros";
import { useOficinas } from "@/hooks/useOficinas";
import { useLocalesNaves } from "@/hooks/useLocalesNaves";
import { useTerrenos } from "@/hooks/useTerrenos";
import { useEdificios } from "@/hooks/useEdificios";
import type { OtroInmueble } from "./fiscalidad/FiscalEnviarDialog";

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const estadoConfig: Record<ExpedienteEstado, { label: string; icon: React.ReactNode; className: string }> = {
  incompleto: { label: "Incompleto", icon: <AlertTriangle size={14} />, className: "bg-destructive/10 text-destructive" },
  revisar: { label: "Revisar", icon: <Eye size={14} />, className: "bg-amber-100 text-amber-800" },
  listo: { label: "Listo para enviar", icon: <CheckCircle2 size={14} />, className: "bg-emerald-100 text-emerald-800" },
  enviado: { label: "Enviado", icon: <Send size={14} />, className: "bg-sky-100 text-sky-800" },
};

interface FiscalidadTabProps {
  onNavigate?: (target: FiscalNavigationTarget) => void;
}

const FiscalidadTab = ({ onNavigate }: FiscalidadTabProps) => {
  const currentYear = new Date().getFullYear();
  const [anio, setAnio] = useState(currentYear - 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Sprint 4.0 — al abrir el panel fiscal marcamos el hito de onboarding.
  useEffect(() => {
    import("@/hooks/useOnboardingProgress").then((m) => m.markFiscalRevisado());
  }, []);

  const fiscalData = useFiscalData(anio);
  const { loading, totals, estado, validations, gastosAgrupados, detectedInfo, propertySummaries, profile, properties } = fiscalData;

  // Datos crudos para el pack del gestor (capa pura)
  const { user } = useAuth();
  const { facturas: allFacturas } = useFacturas();
  const { gastos: allGastos } = usePropertyGastos();
  const { pagos: allPagos } = usePagosRenta({ asOwner: true, userId: user?.id });

  const packPropertyIds = propertyFilter === "all" ? undefined : [propertyFilter];
  const meProfile = useMemo(() => ({ nombre: profile?.nombre, apellidos: profile?.apellidos, nif: profile?.nif }), [profile?.nombre, profile?.apellidos, profile?.nif]);
  const ownersList = useMemo(
    () => listOwnersInPortfolio(properties as any, meProfile),
    [properties, meProfile],
  );
  const ownerKey = ownerFilter === "all" ? null : ownerFilter;

  // Carga de personas contractuales por inmueble (para criterio fiscal por rol).
  // Se filtran por contratos vigentes en el año fiscal (no se mezclan archivados
  // ni contratos de años anteriores) en `filterPersonasParaAnioFiscal`.
  const { contratos: allContratos } = useContratos();
  const [personasRaw, setPersonasRaw] = useState<PersonaConContrato[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("contrato_personas")
        .select("contrato_id, property_id, rol, parte, nombre, dni, porcentaje_participacion, porcentaje_fiscal, afecta_fiscalidad, es_yo")
        .eq("user_id", user.id);
      setPersonasRaw((data as PersonaConContrato[]) || []);
    })();
  }, [user]);

  const personasFiscalAnio = useMemo(() => {
    const contratosLite: ContratoVigenciaInput[] = (allContratos || []).map(c => ({
      id: c.id,
      property_id: c.property_id,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      archivado: c.archivado,
    }));
    return filterPersonasParaAnioFiscal(personasRaw, contratosLite, anio);
  }, [personasRaw, allContratos, anio]);
  const contratosPorProperty = personasFiscalAnio.porProperty;

  const habitaciones = useHabitaciones();
  const garajes = useGarajes();
  const trasteros = useTrasteros();
  const oficinas = useOficinas();
  const localesNaves = useLocalesNaves();
  const terrenos = useTerrenos();
  const edificios = useEdificios();

  const otrosInmuebles: OtroInmueble[] = useMemo(() => {
    const map = (items: any[], tipo: string, tipoLabel: string): OtroInmueble[] =>
      items.map(i => ({ ...i, tipo, tipoLabel }));
    return [
      ...map(habitaciones.items, "habitacion", "Habitación"),
      ...map(garajes.items, "garaje", "Garaje"),
      ...map(trasteros.items, "trastero", "Trastero"),
      ...map(oficinas.items, "oficina", "Oficina"),
      ...map(localesNaves.items, "local_nave", "Local/Nave"),
      ...map(terrenos.items, "terreno", "Terreno"),
      ...map(edificios.items, "edificio", "Edificio"),
    ];
  }, [habitaciones.items, garajes.items, trasteros.items, oficinas.items, localesNaves.items, terrenos.items, edificios.items]);

  // Search through expenses and invoices
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results: { tipo: string; texto: string; importe: number; propiedad: string; fecha?: string }[] = [];

    for (const ps of propertySummaries) {
      for (const f of ps.facturas) {
        if (
          (f.emisor && f.emisor.toLowerCase().includes(q)) ||
          (f.categoria && f.categoria.toLowerCase().includes(q)) ||
          (f.fecha && f.fecha.includes(q)) ||
          (f.total && f.total.toString().includes(q))
        ) {
          results.push({ tipo: "Factura", texto: f.emisor || "Sin emisor", importe: f.total || 0, propiedad: ps.property.nombre_interno, fecha: f.fecha || undefined });
        }
      }
    }

    for (const group of gastosAgrupados) {
      for (const item of group.items) {
        if (
          item.concepto.toLowerCase().includes(q) ||
          item.propertyName.toLowerCase().includes(q) ||
          item.importe.toString().includes(q)
        ) {
          results.push({ tipo: "Gasto", texto: item.concepto, importe: item.importe, propiedad: item.propertyName });
        }
      }
    }

    return results;
  }, [searchQuery, propertySummaries, gastosAgrupados]);

  const errorsCount = validations.filter(v => v.tipo === "error").length;
  const warningsCount = validations.filter(v => v.tipo === "warning").length;

  // Gestor info from first property that has it
  const gestorInfo = useMemo(() => {
    const p = properties.find(pr => pr.gestor_nombre || pr.gestor_email);
    if (!p) return null;
    return { nombre: p.gestor_nombre, email: p.gestor_email, empresa: p.gestor_empresa, telefono: p.gestor_telefono };
  }, [properties]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card rounded-2xl border border-border p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Fiscalidad</h2>
          <p className="text-sm text-muted-foreground mt-1">Tu documentación fiscal, lista para el gestor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setAnio(a => a - 1)} className="rounded-xl">
            <ChevronLeft size={18} />
          </Button>
          <span className="text-lg font-semibold text-foreground min-w-[60px] text-center">{anio}</span>
          <Button variant="ghost" size="icon" onClick={() => setAnio(a => Math.min(a + 1, currentYear))} disabled={anio >= currentYear} className="rounded-xl">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Filtros: inmueble */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Inmueble:</span>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="h-9 text-sm w-[240px] rounded-xl bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los inmuebles ({properties.length})</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Propietario:</span>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-9 text-sm w-[240px] rounded-xl bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (inmueble completo)</SelectItem>
              {ownersList.map(o => (
                <SelectItem key={o.key} value={o.key}>
                  {o.esYo ? "Yo" : o.nombre}
                  {o.dni ? ` · ${o.dni}` : ""}
                  {o.numInmuebles > 1 ? ` (${o.numInmuebles} inm.)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {ownerKey && (
          <p className="text-[11px] text-muted-foreground italic">
            Los importes por propietario se calculan según el porcentaje de titularidad configurado en cada inmueble.
          </p>
        )}
      </div>

      {/* Resumen fiscal */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Resumen del año {anio}</h3>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="¿Por qué no coincide con Finanzas?"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                  <p className="font-semibold mb-1">¿Por qué no coincide con Finanzas?</p>
                  <p>
                    Fiscalidad usa la <strong>fecha de devengo</strong> (factura o contrato)
                    y excluye los movimientos marcados como no fiscales. Finanzas muestra los
                    importes según la fecha de cobro o registro.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge className={`${estadoConfig[estado].className} gap-1.5 px-3 py-1`}>
            {estadoConfig[estado].icon}
            {estadoConfig[estado].label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Ingresos</span>
            </div>
            <p className="text-lg font-bold text-emerald-800">{formatImporte(totals.ingresos)}€</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-700 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Gastos</span>
            </div>
            <p className="text-lg font-bold text-red-800">{formatImporte(totals.gastos)}€</p>
            {totals.gastosDeducibles !== totals.gastos && (
              <p className="text-xs text-red-600 mt-0.5">Deducibles: {formatImporte(totals.gastosDeducibles)}€</p>
            )}
          </div>
          <div className={`rounded-xl p-4 ${totals.balance >= 0 ? "bg-primary/5" : "bg-amber-50"}`}>
            <div className={`flex items-center gap-2 mb-1 ${totals.balance >= 0 ? "text-primary" : "text-amber-700"}`}>
              <Euro size={16} />
              <span className="text-xs font-medium">Balance</span>
            </div>
            <p className={`text-lg font-bold ${totals.balance >= 0 ? "text-primary" : "text-amber-800"}`}>{formatImporte(totals.balance)}€</p>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 size={16} />
              <span className="text-xs font-medium">Inmuebles</span>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.numInmuebles}</p>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText size={16} />
              <span className="text-xs font-medium">Documentos</span>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.numDocumentos}</p>
          </div>
        </div>

        {/* Validations summary */}
        {(errorsCount > 0 || warningsCount > 0) && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            {errorsCount > 0 && (
              <button onClick={() => setActiveSection("validaciones")} className="flex items-center gap-1.5 text-destructive hover:underline">
                <AlertTriangle size={14} />
                {errorsCount} dato(s) necesario(s)
              </button>
            )}
            {warningsCount > 0 && (
              <button onClick={() => setActiveSection("validaciones")} className="flex items-center gap-1.5 text-amber-600 hover:underline">
                <Clock size={14} />
                {warningsCount} recomendación(es)
              </button>
            )}
          </div>
        )}
      </div>

      {/* CTA principal */}
      <Button
        size="lg"
        onClick={() => setEnviarOpen(true)}
        className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base h-14 shadow-sm"
      >
        <Send size={18} />
        Enviar año {anio} al gestor
      </Button>

      {/* CTA preparar resumen para gestor */}
      <Button
        size="lg"
        variant="outline"
        onClick={() => setPackOpen(true)}
        className="w-full rounded-xl gap-2 text-base h-12"
      >
        <FileText size={18} />
        Preparar resumen para gestor
      </Button>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar factura, gasto, proveedor, importe..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl bg-card"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {searchResults && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-3">
            {searchResults.length} resultado(s) para "{searchQuery}"
          </p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No se encontraron resultados</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.slice(0, 20).map((r, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{r.tipo}</Badge>
                    <span className="text-foreground font-medium">{r.texto}</span>
                    <span className="text-muted-foreground">· {r.propiedad}</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatImporte(r.importe)}€</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info detectada */}
      <FiscalDetectedInfo detectedInfo={detectedInfo} />

      {/* Gastos agrupados */}
      <FiscalGastosSection gastosAgrupados={gastosAgrupados} />

      {/* Rendimiento neto fiscal por activo (amortización 3% + reducción 60%) */}
      <RendimientoFiscalSection
        anio={anio}
        propertySummaries={propertySummaries}
        contratos={allContratos}
      />

      {/* Historial de rentas */}
      <FiscalHistorialRentas properties={properties} anio={anio} />

      {/* Previsión del año en curso */}
      {anio === currentYear && (
        <FiscalPrevision anio={anio} propertySummaries={propertySummaries} totals={totals} />
      )}

      {/* Validaciones */}
      <FiscalValidacionesSection validations={validations} onNavigate={onNavigate} />

      {/* Enviar dialog */}
      <FiscalEnviarDialog
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        anio={anio}
        totals={totals}
        validations={validations}
        estado={estado}
        profile={profile}
        gestorInfo={gestorInfo}
        propertySummaries={propertySummaries}
        properties={properties}
        otrosInmuebles={otrosInmuebles}
        onNavigate={onNavigate}
      />

      {/* Pack para gestor (preview) */}
      <PackFiscalGestor
        open={packOpen}
        onOpenChange={setPackOpen}
        anio={anio}
        propietarioNombre={profile?.nombre || null}
        properties={properties as any}
        pagos={allPagos as any}
        gastos={allGastos as any}
        facturas={allFacturas as any}
        propertyIds={packPropertyIds}
        ownerKey={ownerKey}
        me={meProfile}
        contratosPorProperty={contratosPorProperty}
        gastosFijos={getGastosFijosFiscalesAnuales(properties as any)}
        propiedadesConSolapamiento={personasFiscalAnio.propiedadesConSolapamiento}
        propiedadesSinContratoVigente={personasFiscalAnio.propiedadesSinContratoVigente}
      />
    </motion.div>
  );
};

export default FiscalidadTab;

// ─── Rendimiento neto fiscal (amortización 3% + reducción 60%) ───────────────
function RendimientoFiscalSection({
  anio,
  propertySummaries,
  contratos,
}: {
  anio: number;
  propertySummaries: any[];
  contratos: any[];
}) {
  const filas = propertySummaries.map((ps) => {
    const prop = ps.property as any;
    const ingresos = Number(ps.ingresos || 0);
    const gastosManuales = Number(ps.gastosManuales || 0);
    const gastosFijosAnuales = (ps.gastosFijos || []).reduce(
      (s: number, g: any) => s + Number(g.importeAnual || 0),
      0,
    );
    const gastosDeducibles = gastosManuales + gastosFijosAnuales;

    const amort = calcularAmortizacion(prop);

    // Contrato vigente más reciente del activo (no archivado).
    const propContratos = (contratos || []).filter(
      (c: any) => c.property_id === prop.id && !c.archivado,
    );
    propContratos.sort((a: any, b: any) =>
      String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || "")),
    );
    const tipoContrato = propContratos[0]?.tipo_contrato ?? null;
    const conReduc = aplicaReduccion60(tipoContrato);

    const rend = calcularRendimientoFiscal({
      ingresosDeclarables: ingresos,
      gastosDeducibles,
      amortizacionAnual: amort.amortizacionAnual,
      aplicaReduccion: conReduc,
    });

    return {
      propertyId: prop.id,
      nombre: prop.nombre_interno || prop.nombre || "Activo sin nombre",
      ingresos,
      gastosDeducibles,
      amort,
      tipoContrato,
      conReduc,
      rend,
    };
  }).filter((f) => f.ingresos > 0 || f.gastosDeducibles > 0 || f.amort.amortizacionAnual > 0);

  if (filas.length === 0) return null;

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-1">
        Rendimiento neto fiscal · {anio}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Estimación informativa según LIRPF: amortización 3% sobre el valor de
        construcción y reducción 60% para vivienda habitual. Revisa siempre con
        tu asesor.
      </p>

      <div className="space-y-3">
        {filas.map((f) => (
          <div
            key={f.propertyId}
            className="rounded-xl border border-border p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{f.nombre}</h4>
              {f.conReduc ? (
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                  Reducción 60% (habitual)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Sin reducción
                </Badge>
              )}
            </div>

            {f.amort.requiereValorCompra && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Añade el valor de compra en la ficha para calcular la amortización.
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
              <MiniRow label="Rend. neto bruto" value={`${fmt(f.rend.rendimientoNetoBruto)} €`} />
              <MiniRow
                label="Reducción 60%"
                value={f.conReduc ? `-${fmt(f.rend.reduccion)} €` : "—"}
              />
              <MiniRow
                label="Rend. neto reducido"
                value={`${fmt(f.rend.rendimientoNetoReducido)} €`}
              />
              <MiniRow
                label="Amortización (3%)"
                value={`${fmt(f.amort.amortizacionAnual)} €`}
              />
              <MiniRow
                label="Base liquidable est."
                value={`${fmt(f.rend.baseLiquidableEstimada)} €`}
                strong
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-mono mt-0.5 ${
          strong ? "text-foreground text-[12px] font-bold" : "text-foreground text-[11px] font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
