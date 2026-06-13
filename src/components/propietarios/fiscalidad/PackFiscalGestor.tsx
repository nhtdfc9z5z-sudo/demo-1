import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Building2, Receipt, TrendingUp, FileText, Info, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { buildOwnerPack, type MinimalProperty, type MinimalGasto, type MinimalFactura, type MeProfile, type MinimalGastoFijoActivo } from "@/lib/fiscalPack";
import {
  downloadFiscalPackPdf,
  downloadFiscalPackXlsx,
  downloadFiscalPackContasol,
  downloadFiscalPackA3,
  downloadFiscalPackSage,
  downloadFiscalPackHolded,
} from "@/lib/fiscalPackExport";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PersonaContrato } from "@/lib/contratoRoles";
import { measureAsync, measureSync, captureAppError } from "@/lib/observability";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anio: number;
  propietarioNombre?: string | null;
  properties: MinimalProperty[];
  pagos: PagoRenta[];
  gastos: MinimalGasto[];
  facturas: MinimalFactura[];
  propertyIds?: string[]; // si se filtra
  ownerKey?: string | null;
  me?: MeProfile | null;
  contratosPorProperty?: Record<string, PersonaContrato[]>;
  /** Gastos fijos del Activo (IBI, comunidad, seguros…), ya anualizados y
   *  respetando "quién paga". Si no se pasan, no se incluyen. */
  gastosFijos?: MinimalGastoFijoActivo[];
  /** Inmuebles con >1 contrato vigente solapado en el año fiscal. */
  propiedadesConSolapamiento?: string[];
  /** Inmuebles con personas en BD pero sin contrato vigente este año. */
  propiedadesSinContratoVigente?: string[];
}

export default function PackFiscalGestor({
  open, onOpenChange, anio, propietarioNombre,
  properties, pagos, gastos, facturas, propertyIds, ownerKey, me, contratosPorProperty, gastosFijos,
  propiedadesConSolapamiento, propiedadesSinContratoVigente,
}: Props) {
  const pack = useMemo(
    () => measureSync(
      "build_owner_pack",
      {
        anio,
        num_inmuebles: (propertyIds?.length ?? properties.length),
        num_pagos: pagos.length,
        num_gastos: gastos.length,
        num_facturas: facturas.length,
        scope: "pack_dialog",
      },
      () => buildOwnerPack({ properties, pagos, gastos, facturas, gastosFijos }, anio, propertyIds, {
        ownerKey, me, contratosPorProperty,
        propiedadesConSolapamiento, propiedadesSinContratoVigente,
      }),
    ),
    [properties, pagos, gastos, facturas, gastosFijos, anio, propertyIds, ownerKey, me, contratosPorProperty, propiedadesConSolapamiento, propiedadesSinContratoVigente],
  );

  const [exporting, setExporting] = useState<null | "pdf" | "xlsx">(null);

  const handleExport = async (kind: "pdf" | "xlsx") => {
    if (exporting) return; // bloqueo doble click
    setExporting(kind);
    const label = kind === "pdf" ? "Generando PDF…" : "Generando Excel…";
    const tid = toast.loading(`Preparando pack fiscal… ${label}`);
    const metricEvent = kind === "pdf" ? "export_fiscal_pdf" : "export_fiscal_excel";
    const metricCtx = {
      anio,
      num_inmuebles: pack.propiedades.length,
      num_pagos: pagos.length,
      num_gastos: gastos.length,
      num_facturas: facturas.length,
    };
    try {
      await measureAsync(metricEvent, metricCtx, async () => {
        if (kind === "pdf") await downloadFiscalPackPdf(pack, { propietarioNombre });
        else await downloadFiscalPackXlsx(pack, { propietarioNombre });
      });
      toast.success(kind === "pdf" ? "PDF generado" : "Excel generado", { id: tid });
    } catch (e: any) {
      // Auditoría fiscal: la exportación es un evento crítico para el propietario
      captureAppError({
        event: kind === "pdf" ? "export.fiscal_pdf" : "export.fiscal_excel",
        message: e?.message || "Error generando exportación fiscal",
        severity: "error",
        audit: true,
        error: e,
        context: metricCtx,
      });
      toast.error("No se pudo generar el archivo", {
        id: tid,
        description: e?.message || "Inténtalo de nuevo.",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} /> Resumen para el gestor · {anio}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Vista previa informativa. {(pack.propietarioNombre || propietarioNombre) ? `Propietario: ${pack.propietarioNombre || propietarioNombre}. ` : ""}
            Imputación por <strong>fecha de devengo</strong>; sólo pagos marcados como fiscales.
            <span className="block mt-1">
              Criterio: <strong>{pack.criterioCalculo === "por_propietario" ? "por propietario (porcentaje de titularidad)" : "total inmueble (100%)"}</strong>.
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="px-6 max-h-[60vh]">
          <div className="space-y-4 pb-4">
            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Resumen informativo.</strong> Revisa con tu asesor fiscal antes de presentar la declaración.
                {pack.criterioCalculo === "por_propietario" && (
                  <> Los importes por propietario se calculan según el porcentaje de titularidad configurado en cada inmueble.</>
                )}
              </span>
            </div>

            {pack.inmueblesRequierenRevision.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Revisa con tu asesor fiscal.</strong> {pack.inmueblesRequierenRevision.length} inmueble(s) tienen un criterio fiscal que conviene verificar (titular que no figura como arrendador, datos incompletos, etc.).
                </span>
              </div>
            )}

            {/* Totales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Ingresos declarables" value={`${fmt(pack.totalIngresosDeclarables)} €`} accent="emerald" />
              <Stat label="Gastos deducibles" value={`${fmt(pack.totalGastosDeducibles)} €`} accent="rose" />
              <Stat label="Neto" value={`${fmt(pack.totalNeto)} €`} accent={pack.totalNeto >= 0 ? "primary" : "amber"} />
              <Stat label="Inmuebles" value={String(pack.propiedades.length)} accent="muted" />
            </div>

            {(pack.totalMesesPendientes + pack.totalMesesRegularizados + pack.totalMesesSinIngresos > 0) && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {pack.totalMesesPendientes > 0 && (
                  <Badge variant="outline" className="border-rose-300 text-rose-700">{pack.totalMesesPendientes} mes(es) pendientes</Badge>
                )}
                {pack.totalMesesRegularizados > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700">{pack.totalMesesRegularizados} mes(es) regularizados</Badge>
                )}
                {pack.totalMesesSinIngresos > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">{pack.totalMesesSinIngresos} mes(es) sin ingreso</Badge>
                )}
              </div>
            )}

            <Separator />

            {/* Por inmueble */}
            {pack.propiedades.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No hay inmuebles para mostrar.</p>
            ) : (
              pack.propiedades.map(p => (
                <div key={p.propertyId} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <Building2 size={14} className="text-primary" /> {p.propertyName}
                        {pack.criterioCalculo === "por_propietario" && (
                          <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0 h-4">{p.porcentajeAplicado}%</Badge>
                        )}
                      </h4>
                      <div className="text-[10px] text-muted-foreground space-x-2 mt-0.5">
                        {p.referenciaCatastral && <span>Ref. catastral: {p.referenciaCatastral}</span>}
                        {p.direccion && <span>· {p.direccion}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div className="font-mono font-semibold text-emerald-700">{fmt(p.ingresosDeclarables)} €</div>
                      <div className="text-[10px] text-muted-foreground">ingresos declarables</div>
                    </div>
                  </div>

                  {/* Desglose ingresos */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <MiniBox label="Pagos reales fiscales" value={`${fmt(p.pagosRealesFiscal)} €`} />
                    <MiniBox label="Históricos fiscales" value={`${fmt(p.historicosFiscal)} €`} />
                    <MiniBox label="Gastos deducibles" value={`${fmt(p.gastosTotal)} €`} />
                  </div>

                  {/* Meses */}
                  <div className="grid grid-cols-12 gap-0.5">
                    {p.meses.map(m => {
                      const tone =
                        m.ingresoDeclarable > 0 ? "bg-emerald-100 text-emerald-800" :
                        m.pendiente ? "bg-rose-100 text-rose-800" :
                        m.regularizado ? "bg-amber-100 text-amber-800" :
                        "bg-muted text-muted-foreground";
                      return (
                        <div
                          key={m.mes}
                          title={
                            m.ingresoDeclarable > 0 ? `${MESES[m.mes - 1]}: ${fmt(m.ingresoDeclarable)} €` :
                            m.pendiente ? `${MESES[m.mes - 1]}: pendiente` :
                            m.regularizado ? `${MESES[m.mes - 1]}: regularizado` :
                            `${MESES[m.mes - 1]}: sin ingreso`
                          }
                          className={`text-[9px] text-center py-1 rounded ${tone}`}
                        >
                          {MESES[m.mes - 1].slice(0, 1)}
                        </div>
                      );
                    })}
                  </div>

                  {/* Gastos detalle */}
                  {p.gastosDeducibles.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
                        <Receipt size={11} /> Ver gastos deducibles ({p.gastosDeducibles.length})
                      </summary>
                      <ul className="mt-1.5 space-y-0.5 pl-4">
                        {p.gastosDeducibles.slice(0, 30).map((g, i) => (
                          <li key={i} className="flex justify-between gap-2 text-[11px]">
                            <span className="truncate">
                              <Badge variant="outline" className="text-[9px] mr-1 px-1 py-0 h-3.5">{g.categoria}</Badge>
                              {g.concepto}
                            </span>
                            <span className="font-mono">{fmt(g.importe)} €</span>
                          </li>
                        ))}
                        {p.gastosDeducibles.length > 30 && (
                          <li className="text-[10px] text-muted-foreground">…y {p.gastosDeducibles.length - 30} más</li>
                        )}
                      </ul>
                    </details>
                  )}

                  {/* Notas de regularización */}
                  {p.notasRegularizacion.length > 0 && (
                    <div className="rounded-md bg-muted/50 border border-border p-2 space-y-0.5">
                      {p.notasRegularizacion.map((n, i) => (
                        <p key={i} className="text-[11px] flex items-start gap-1.5">
                          <Info size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                          <span>{n}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-3 border-t border-border">
          <div className="flex flex-wrap gap-2 w-full items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!exporting}>Cerrar</Button>
          <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport("xlsx")}
            disabled={!!exporting}
            aria-busy={exporting === "xlsx"}
          >
            {exporting === "xlsx" ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <FileSpreadsheet size={14} className="mr-1.5" />
            )}
            {exporting === "xlsx" ? "Generando Excel…" : "Excel"}
          </Button>
          <Button variant="outline" onClick={() => downloadFiscalPackContasol(pack)} disabled={!!exporting}>
            <FileSpreadsheet size={14} className="mr-1.5" /> Contasol
          </Button>
          <Button variant="outline" onClick={() => downloadFiscalPackA3(pack)} disabled={!!exporting}>
            <FileSpreadsheet size={14} className="mr-1.5" /> A3
          </Button>
          <Button variant="outline" onClick={() => downloadFiscalPackSage(pack)} disabled={!!exporting}>
            <FileSpreadsheet size={14} className="mr-1.5" /> Sage
          </Button>
          <Button variant="outline" onClick={() => downloadFiscalPackHolded(pack)} disabled={!!exporting}>
            <FileSpreadsheet size={14} className="mr-1.5" /> Holded
          </Button>
          <Button
            onClick={() => handleExport("pdf")}
            disabled={!!exporting}
            aria-busy={exporting === "pdf"}
          >
            {exporting === "pdf" ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Download size={14} className="mr-1.5" />
            )}
            {exporting === "pdf" ? "Generando PDF…" : "PDF"}
          </Button>
          </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "emerald" | "rose" | "primary" | "amber" | "muted" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    primary: "bg-primary/5 text-primary border-primary/20",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    muted: "bg-card text-foreground border-border",
  };
  return (
    <div className={`rounded-lg border p-2 ${tones[accent]}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-[11px] font-semibold">{value}</p>
    </div>
  );
}