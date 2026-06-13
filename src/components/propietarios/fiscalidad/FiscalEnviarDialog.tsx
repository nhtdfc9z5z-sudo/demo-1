import { useState, useMemo } from "react";
import { Send, Download, Copy, Mail, MessageSquare, FileText, AlertTriangle, CheckCircle2, X, ExternalLink, Home, BedDouble, Car, Archive, Briefcase, Store, Mountain, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { FiscalValidation, FiscalTotals, ExpedienteEstado, FiscalPropertySummary, FiscalNavigationTarget } from "@/hooks/useFiscalData";
import type { ProfileData } from "@/hooks/useProfile";
import type { Property } from "@/hooks/useProperties";
import { useAuth } from "@/hooks/useAuth";
import CompensacionesFacturasPendientes from "./CompensacionesFacturasPendientes";

export interface OtroInmueble {
  id: string;
  nombre_interno: string;
  tipo: string;
  tipoLabel: string;
  direccion_completa?: string | null;
  numero_portal?: string | null;
  planta?: string | null;
  puerta?: string | null;
  urbanizacion?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  comunidad_autonoma?: string | null;
  referencia_catastral?: string | null;
  valor_compra?: number | null;
  ano_compra?: number | null;
  superficie_m2?: number | null;
}

interface FiscalEnviarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anio: number;
  totals: FiscalTotals;
  validations: FiscalValidation[];
  estado: ExpedienteEstado;
  profile: ProfileData;
  gestorInfo: { nombre: string | null; email: string | null; empresa: string | null; telefono: string | null } | null;
  propertySummaries: FiscalPropertySummary[];
  properties: Property[];
  otrosInmuebles?: OtroInmueble[];
  onNavigate?: (target: FiscalNavigationTarget) => void;
}

function formatImporte(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const TIPO_ICONS: Record<string, React.ReactNode> = {
  habitacion: <BedDouble size={14} className="text-muted-foreground" />,
  garaje: <Car size={14} className="text-muted-foreground" />,
  trastero: <Archive size={14} className="text-muted-foreground" />,
  oficina: <Briefcase size={14} className="text-muted-foreground" />,
  local_nave: <Store size={14} className="text-muted-foreground" />,
  terreno: <Mountain size={14} className="text-muted-foreground" />,
  edificio: <Building2 size={14} className="text-muted-foreground" />,
};

const FiscalEnviarDialog = ({ open, onOpenChange, anio, totals, validations, estado, profile, gestorInfo, propertySummaries, properties, otrosInmuebles = [], onNavigate }: FiscalEnviarDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<"review" | "properties" | "options" | "share">("review");
  const [incluirIngresos, setIncluirIngresos] = useState(true);
  const [incluirGastos, setIncluirGastos] = useState(true);
  const [incluirAnexoInmueble, setIncluirAnexoInmueble] = useState(true);
  const [incluirFacturas, setIncluirFacturas] = useState(true);
  const [incluirDatosPropietario, setIncluirDatosPropietario] = useState(true);
  const [incluirDatosGestor, setIncluirDatosGestor] = useState(true);

  const allIds = useMemo(() => [...properties.map(p => p.id), ...otrosInmuebles.map(i => i.id)], [properties, otrosInmuebles]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set(allIds));

  const errors = validations.filter(v => v.tipo === "error");
  const warnings = validations.filter(v => v.tipo === "warning");

  // Reset selections when dialog opens
  const handleClose = () => {
    setStep("review");
    setSelectedPropertyIds(new Set(allIds));
    onOpenChange(false);
  };

  // Filtered summaries based on selected properties
  const filteredSummaries = propertySummaries.filter(ps => selectedPropertyIds.has(ps.property.id));

  // Recalculated totals based on selected properties
  const filteredTotals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    let gastosDeducibles = 0;
    let numDocumentos = 0;

    for (const ps of filteredSummaries) {
      ingresos += ps.ingresos;
      const psGastos = ps.gastosManuales + ps.gastosFijos.reduce((s, g) => s + g.importeAnual, 0);
      gastos += psGastos;
      // Approximate deducible ratio from original totals
      const deducibleRatio = totals.gastos > 0 ? totals.gastosDeducibles / totals.gastos : 1;
      gastosDeducibles += psGastos * deducibleRatio;
      numDocumentos += ps.facturas.length;
    }

    const selectedOtrosCount = otrosInmuebles.filter(i => selectedPropertyIds.has(i.id)).length;
    return {
      ingresos,
      gastos,
      gastosDeducibles,
      balance: ingresos - gastos,
      numInmuebles: filteredSummaries.length + selectedOtrosCount,
      numDocumentos,
    };
  }, [filteredSummaries, totals, otrosInmuebles, selectedPropertyIds]);

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectedPropertyIds.size === allIds.length;
  const toggleAll = () => {
    if (allSelected) setSelectedPropertyIds(new Set());
    else setSelectedPropertyIds(new Set(allIds));
  };

  const buildAddress = (p: { direccion_completa?: string | null; numero_portal?: string | null; planta?: string | null; puerta?: string | null; urbanizacion?: string | null; codigo_postal?: string | null; municipio?: string | null; provincia?: string | null; comunidad_autonoma?: string | null; nombre_interno: string }) => {
    const parts: string[] = [];
    if (p.direccion_completa) parts.push(p.direccion_completa);
    if (p.numero_portal) parts.push(`nº ${p.numero_portal}`);
    if (p.planta || p.puerta) {
      const sub = [p.planta ? `Planta ${p.planta}` : null, p.puerta ? `Puerta ${p.puerta}` : null].filter(Boolean).join(", ");
      parts.push(sub);
    }
    if (p.urbanizacion) parts.push(p.urbanizacion);
    const loc = [p.codigo_postal, p.municipio, p.provincia, p.comunidad_autonoma].filter(Boolean).join(", ");
    if (loc) parts.push(loc);
    return parts.length > 0 ? parts.join(", ") : p.nombre_interno;
  };

  const buildFullAddress = (p: Property) => buildAddress(p as any);

  const generateReportText = () => {
    const propietario = [profile.nombre, profile.apellidos].filter(Boolean).join(" ") || "Propietario";
    let text = `EXPEDIENTE FISCAL ${anio}\n${"=".repeat(50)}\n`;
    text += `Generado: ${new Date().toLocaleDateString("es-ES")}\n`;

    if (incluirDatosPropietario) {
      text += `\nPROPIETARIO\n${"─".repeat(30)}\n`;
      text += `Nombre: ${propietario}\nNIF: ${profile.nif || "No especificado"}\nEmail: ${profile.email}\n`;
      if (profile.direccion) text += `Dirección: ${profile.direccion}\n`;
    }

    if (incluirDatosGestor && gestorInfo) {
      text += `\nGESTOR\n${"─".repeat(30)}\n`;
      text += `Nombre: ${gestorInfo.nombre || "No especificado"}\n`;
      if (gestorInfo.empresa) text += `Empresa: ${gestorInfo.empresa}\n`;
      if (gestorInfo.email) text += `Email: ${gestorInfo.email}\n`;
    }

    text += `\nRESUMEN GENERAL\n${"─".repeat(30)}\n`;
    text += `Ingresos totales: ${formatImporte(filteredTotals.ingresos)}€\n`;
    text += `Gastos totales: ${formatImporte(filteredTotals.gastos)}€\n`;
    text += `  · Gastos deducibles: ${formatImporte(filteredTotals.gastosDeducibles)}€\n`;
    text += `Balance neto: ${formatImporte(filteredTotals.balance)}€\n`;
    text += `Rendimiento neto (ingresos - deducibles): ${formatImporte(filteredTotals.ingresos - filteredTotals.gastosDeducibles)}€\n`;
    text += `Activos: ${filteredTotals.numInmuebles}\n`;

    for (const ps of filteredSummaries) {
      if (incluirAnexoInmueble) {
        text += `\n${"═".repeat(50)}\n`;
        text += `INMUEBLE: ${buildFullAddress(ps.property)}\n`;
        text += `Ref. catastral: ${ps.property.referencia_catastral || "No especificada"}\n`;
        if (ps.property.valor_compra) text += `Valor adquisición: ${formatImporte(Number(ps.property.valor_compra))}€\n`;
        if (ps.property.ano_compra) text += `Año adquisición: ${ps.property.ano_compra}\n`;

        // Titularidad
        const tit = (ps.property as any).titularidad;
        if (tit === "copropietarios") {
          const coprop = ((ps.property as any).copropietarios as any[]) || [];
          text += `Titularidad: Copropiedad (${coprop.length + 1} titulares)\n`;
          for (const cp of coprop) {
            text += `  · ${cp.nombre || "Sin nombre"}`;
            if (cp.dni) text += ` (DNI/NIE: ${cp.dni})`;
            if (cp.porcentaje) text += ` — ${cp.porcentaje}%`;
            text += `\n`;
          }
        } else {
          text += `Titularidad: Propietario único\n`;
        }
        if ((ps.property as any).tiene_usufructo) {
          text += `Usufructuario: ${(ps.property as any).usufructuario_nombre || "No especificado"}`;
          if ((ps.property as any).usufructuario_dni) text += ` (DNI/NIE: ${(ps.property as any).usufructuario_dni})`;
          text += `\n`;
        }
      }

      if (incluirIngresos) {
        text += `\n  INGRESOS: ${formatImporte(ps.ingresos)}€\n`;
        if (ps.inquilinos.length > 0) {
          for (const inq of ps.inquilinos) {
            text += `  · ${inq.nombre}${inq.dni ? ` (DNI/NIE: ${inq.dni})` : ""}\n`;
          }
        }
      }

      if (incluirGastos) {
        const totalGastos = ps.gastosManuales + ps.gastosFijos.reduce((s, g) => s + g.importeAnual, 0);
        text += `\n  GASTOS: ${formatImporte(totalGastos)}€\n`;
        for (const g of ps.gastosFijos) {
          text += `    · ${g.concepto}: ${formatImporte(g.importeAnual)}€/año\n`;
        }
      }

      if (incluirFacturas && ps.facturas.length > 0) {
        const deducibles = ps.facturas.filter(f => f.deducible);
        const noDeducibles = ps.facturas.filter(f => !f.deducible);
        if (deducibles.length > 0) {
          text += `\n  FACTURAS DEDUCIBLES: ${deducibles.length}\n`;
          for (const f of deducibles) {
            text += `    · ${f.fecha || "S/F"} | ${f.emisor || "Sin emisor"} | ${formatImporte(f.total || 0)}€\n`;
          }
        }
        if (noDeducibles.length > 0) {
          text += `\n  FACTURAS NO DEDUCIBLES: ${noDeducibles.length}\n`;
          for (const f of noDeducibles) {
            text += `    · ${f.fecha || "S/F"} | ${f.emisor || "Sin emisor"} | ${formatImporte(f.total || 0)}€\n`;
          }
        }
      }
    }

    // Include other inmueble types
    const selectedOtros = otrosInmuebles.filter(i => selectedPropertyIds.has(i.id));
    for (const inmueble of selectedOtros) {
      if (incluirAnexoInmueble) {
        text += `\n${"═".repeat(50)}\n`;
        text += `INMUEBLE (${inmueble.tipoLabel}): ${buildAddress(inmueble)}\n`;
        if (inmueble.referencia_catastral) text += `Ref. catastral: ${inmueble.referencia_catastral}\n`;
        if (inmueble.valor_compra) text += `Valor adquisición: ${formatImporte(Number(inmueble.valor_compra))}€\n`;
        if (inmueble.ano_compra) text += `Año adquisición: ${inmueble.ano_compra}\n`;
        if (inmueble.superficie_m2) text += `Superficie: ${inmueble.superficie_m2} m²\n`;
      }
    }

    text += `\n\nDocumento generado automáticamente. Sin validez fiscal.\n`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    toast.success("Expediente copiado al portapapeles");
  };

  const handleDownload = () => {
    const text = generateReportText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expediente-fiscal-${anio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Expediente descargado");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Expediente fiscal ${anio} - ${[profile.nombre, profile.apellidos].filter(Boolean).join(" ")}`);
    const body = encodeURIComponent(generateReportText());
    const to = gestorInfo?.email || "";
    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
    toast.success("Abriendo correo electrónico...");
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateReportText());
    const phone = gestorInfo?.telefono?.replace(/\s+/g, "") || "";
    window.open(`https://wa.me/${phone}?text=${text}`);
    toast.success("Abriendo WhatsApp...");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send size={18} className="text-primary" />
            Enviar año {anio} al gestor
          </DialogTitle>
        </DialogHeader>

        {step === "review" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Revisión automática de tu documentación antes de enviar:</p>

            {/* Quick summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center py-3 rounded-xl bg-emerald-50">
                <p className="text-xs text-emerald-700">Ingresos</p>
                <p className="text-sm font-bold text-emerald-800">{formatImporte(totals.ingresos)}€</p>
              </div>
              <div className="text-center py-3 rounded-xl bg-red-50">
                <p className="text-xs text-red-700">Gastos</p>
                <p className="text-sm font-bold text-red-800">{formatImporte(totals.gastos)}€</p>
              </div>
              <div className="text-center py-3 rounded-xl bg-secondary">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-sm font-bold text-foreground">{formatImporte(totals.balance)}€</p>
              </div>
            </div>

            {/* Issues */}
            {errors.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={14} /> Datos necesarios ({errors.length})
                </p>
                {errors.map((e, idx) => (
                  <button
                    key={idx}
                    onClick={e.navigateTo && onNavigate ? () => { onNavigate(e.navigateTo!); handleClose(); } : undefined}
                    className={`text-xs text-destructive/80 ml-5 text-left flex items-center gap-1 ${e.navigateTo && onNavigate ? "hover:underline cursor-pointer" : ""}`}
                  >
                    · {e.mensaje}{e.propertyName ? ` (${e.propertyName})` : ""}
                    {e.navigateTo && onNavigate && <ExternalLink size={10} className="shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={14} /> Recomendaciones ({warnings.length})
                </p>
                {warnings.slice(0, 5).map((w, idx) => (
                  <button
                    key={idx}
                    onClick={w.navigateTo && onNavigate ? () => { onNavigate(w.navigateTo!); handleClose(); } : undefined}
                    className={`text-xs text-amber-700 ml-5 text-left flex items-center gap-1 ${w.navigateTo && onNavigate ? "hover:underline cursor-pointer" : ""}`}
                  >
                    · {w.mensaje}{w.propertyName ? ` (${w.propertyName})` : ""}
                    {w.navigateTo && onNavigate && <ExternalLink size={10} className="shrink-0" />}
                  </button>
                ))}
                {warnings.length > 5 && <p className="text-xs text-amber-600 ml-5 mt-1">... y {warnings.length - 5} más</p>}
              </div>
            )}

            {errors.length === 0 && warnings.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-700" />
                <p className="text-sm text-emerald-800">Todo en orden. Tu expediente está listo para enviar.</p>
              </div>
            )}

            <CompensacionesFacturasPendientes
              userId={user?.id}
              anio={anio}
              selectedPropertyIds={selectedPropertyIds}
              properties={properties}
            />

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={() => setStep("properties")} className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                {errors.length > 0 ? "Continuar igualmente" : "Siguiente"}
              </Button>
            </div>
          </div>
        )}

        {step === "properties" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona qué propiedades incluir en el expediente para tu gestor:</p>

            <label className="flex items-center gap-3 py-2 px-3 rounded-xl bg-secondary/50 cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span className="text-sm font-semibold text-foreground">Todos los activos</span>
              <Badge variant="outline" className="ml-auto text-xs">{allIds.length}</Badge>
            </label>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Activos */}
              {propertySummaries.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 flex items-center gap-1.5">
                  <Home size={12} /> Activos
                </p>
              )}
              {propertySummaries.map(ps => {
                const isSelected = selectedPropertyIds.has(ps.property.id);
                const addr = buildFullAddress(ps.property);
                return (
                  <label
                    key={ps.property.id}
                    className={`flex items-start gap-3 py-3 px-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/5 border border-primary/20" : "bg-secondary/30 border border-transparent hover:bg-secondary/50"
                    }`}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleProperty(ps.property.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{ps.property.nombre_interno}</span>
                      <p className="text-xs text-muted-foreground truncate">{addr}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="text-emerald-700">+{formatImporte(ps.ingresos)}€</span>
                        <span className="text-red-700">-{formatImporte(ps.gastosManuales + ps.gastosFijos.reduce((s, g) => s + g.importeAnual, 0))}€</span>
                      </div>
                    </div>
                  </label>
                );
              })}

              {/* Other inmueble types */}
              {(() => {
                const grouped = otrosInmuebles.reduce<Record<string, OtroInmueble[]>>((acc, i) => {
                  (acc[i.tipoLabel] = acc[i.tipoLabel] || []).push(i);
                  return acc;
                }, {});
                return Object.entries(grouped).map(([tipoLabel, items]) => (
                  <div key={tipoLabel}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 flex items-center gap-1.5">
                      {TIPO_ICONS[items[0].tipo] || <Building2 size={12} />} {tipoLabel}s
                    </p>
                    {items.map(inmueble => {
                      const isSelected = selectedPropertyIds.has(inmueble.id);
                      const addr = buildAddress(inmueble);
                      return (
                        <label
                          key={inmueble.id}
                          className={`flex items-start gap-3 py-3 px-3 rounded-xl cursor-pointer transition-colors mt-1 ${
                            isSelected ? "bg-primary/5 border border-primary/20" : "bg-secondary/30 border border-transparent hover:bg-secondary/50"
                          }`}
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleProperty(inmueble.id)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{inmueble.nombre_interno}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tipoLabel}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{addr}</p>
                            {inmueble.superficie_m2 && (
                              <p className="text-xs text-muted-foreground mt-0.5">{inmueble.superficie_m2} m²</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>

            {/* Updated totals preview */}
            {selectedPropertyIds.size < allIds.length && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800 font-medium mb-2">Balance actualizado ({filteredTotals.numInmuebles} de {allIds.length} inmuebles):</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-700 font-semibold">Ingresos: {formatImporte(filteredTotals.ingresos)}€</span>
                  <span className="text-red-700 font-semibold">Gastos: {formatImporte(filteredTotals.gastos)}€</span>
                  <span className="text-foreground font-semibold">Balance: {formatImporte(filteredTotals.balance)}€</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("review")} className="flex-1 rounded-xl">Atrás</Button>
              <Button onClick={() => setStep("options")} disabled={selectedPropertyIds.size === 0} className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                Siguiente ({selectedPropertyIds.size} inmueble{selectedPropertyIds.size !== 1 ? "s" : ""})
              </Button>
            </div>
          </div>
        )}

        {step === "options" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Elige qué incluir en el expediente:</p>

            <div className="space-y-3">
              {[
                { id: "ingresos", label: "Detalle de ingresos", checked: incluirIngresos, set: setIncluirIngresos },
                { id: "gastos", label: "Detalle de gastos", checked: incluirGastos, set: setIncluirGastos },
                { id: "anexo", label: "Anexo por inmueble", checked: incluirAnexoInmueble, set: setIncluirAnexoInmueble },
                { id: "facturas", label: "Listado de facturas", checked: incluirFacturas, set: setIncluirFacturas },
                { id: "propietario", label: "Datos del propietario", checked: incluirDatosPropietario, set: setIncluirDatosPropietario },
                { id: "gestor", label: "Datos del gestor", checked: incluirDatosGestor, set: setIncluirDatosGestor },
              ].map(opt => (
                <label key={opt.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-secondary/50 cursor-pointer">
                  <Checkbox checked={opt.checked} onCheckedChange={(v) => opt.set(!!v)} />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("properties")} className="flex-1 rounded-xl">Atrás</Button>
              <Button onClick={() => setStep("share")} className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">Generar expediente</Button>
            </div>
          </div>
        )}

        {step === "share" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 size={24} className="text-emerald-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-800">Expediente fiscal {anio} generado</p>
              <p className="text-xs text-emerald-700 mt-1">Elige cómo compartirlo con tu gestor</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleEmail} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Mail size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Email</span>
              </button>
              <button onClick={handleWhatsApp} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <MessageSquare size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">WhatsApp</span>
              </button>
              <button onClick={handleCopy} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Copy size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Copiar</span>
              </button>
              <button onClick={handleDownload} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Download size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Descargar</span>
              </button>
            </div>

            <Button variant="outline" onClick={handleClose} className="w-full rounded-xl">Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FiscalEnviarDialog;
