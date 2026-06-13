import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Download, Send, Building2, Calculator, FileText, Euro, TrendingUp, TrendingDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Property } from "@/hooks/useProperties";

interface DeclaracionHaciendaProps {
  properties: Property[];
  onBack: () => void;
}

interface ResumenVivienda {
  property: Property;
  ingresos: number;
  gastos: number;
  facturas: number;
  detalleIngresos: { mes: number; importe: number }[];
  detalleGastos: { categoria: string; concepto: string | null; importe: number; fecha: string }[];
  detalleFacturas: { emisor: string | null; total: number | null; fecha: string | null; categoria: string | null }[];
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const DeclaracionHaciendaSection = ({ properties, onBack }: DeclaracionHaciendaProps) => {
  const { user } = useAuth();
  const [anio, setAnio] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(false);
  const [resumenes, setResumenes] = useState<ResumenVivienda[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [gestorEmail, setGestorEmail] = useState("");
  const [gestorNombre, setGestorNombre] = useState("");
  const [gestoriaNombre, setGestoriaNombre] = useState("");
  const [profileData, setProfileData] = useState<{ nombre?: string; apellidos?: string; email?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nombre, apellidos, email").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfileData(data); });
  }, [user]);

  useEffect(() => {
    if (!user || properties.length === 0) return;
    fetchData();
  }, [user, properties, anio]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const results: ResumenVivienda[] = [];

    for (const prop of properties) {
      // Ingresos (pagos_renta confirmados)
      const { data: pagos } = await supabase
        .from("pagos_renta")
        .select("mes, importe_pagado")
        .eq("property_id", prop.id)
        .eq("anio", anio)
        .eq("propietario_confirmado", true)
        .eq("user_id", user.id);

      const detalleIngresos = (pagos || []).map(p => ({
        mes: p.mes as number,
        importe: (p.importe_pagado as number) || 0,
      }));
      const totalIngresos = detalleIngresos.reduce((s, i) => s + i.importe, 0);

      // Gastos
      const { data: gastos } = await supabase
        .from("property_gastos")
        .select("categoria, concepto, importe, fecha")
        .eq("property_id", prop.id)
        .eq("user_id", user.id)
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`);

      const detalleGastos = (gastos || []).map(g => ({
        categoria: g.categoria as string,
        concepto: g.concepto as string | null,
        importe: g.importe as number,
        fecha: g.fecha as string,
      }));
      const totalGastos = detalleGastos.reduce((s, g) => s + g.importe, 0);

      // Facturas
      const { data: facturas } = await supabase
        .from("facturas")
        .select("emisor_nombre, total, fecha, categoria")
        .eq("property_id", prop.id)
        .eq("user_id", user.id)
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`);

      const detalleFacturas = (facturas || []).map(f => ({
        emisor: f.emisor_nombre as string | null,
        total: f.total as number | null,
        fecha: f.fecha as string | null,
        categoria: f.categoria as string | null,
      }));
      const totalFacturas = detalleFacturas.reduce((s, f) => s + (f.total || 0), 0);

      results.push({
        property: prop,
        ingresos: totalIngresos,
        gastos: totalGastos,
        facturas: totalFacturas,
        detalleIngresos,
        detalleGastos,
        detalleFacturas,
      });
    }
    setResumenes(results);
    setLoading(false);
  };

  const totales = useMemo(() => {
    const ingresos = resumenes.reduce((s, r) => s + r.ingresos, 0);
    const gastos = resumenes.reduce((s, r) => s + r.gastos, 0);
    const facturas = resumenes.reduce((s, r) => s + r.facturas, 0);
    return { ingresos, gastos, facturas, rendimiento: ingresos - gastos };
  }, [resumenes]);

  const generarTextoInforme = () => {
    const propietario = profileData ? `${profileData.nombre || ""} ${profileData.apellidos || ""}`.trim() : "Propietario";
    let texto = `INFORME FISCAL PARA DECLARACIÓN DE LA RENTA – EJERCICIO ${anio}\n`;
    texto += `${"=".repeat(60)}\n`;
    texto += `Propietario: ${propietario}\n`;
    texto += `Email: ${profileData?.email || ""}\n`;
    texto += `Fecha de generación: ${new Date().toLocaleDateString("es-ES")}\n\n`;

    texto += `RESUMEN GLOBAL\n${"─".repeat(40)}\n`;
    texto += `Total ingresos por alquiler: ${totales.ingresos.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
    texto += `Total gastos deducibles: ${totales.gastos.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
    texto += `Total facturas asociadas: ${totales.facturas.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
    texto += `Rendimiento neto: ${totales.rendimiento.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n\n`;

    for (const r of resumenes) {
      texto += `\nVIVIENDA: ${r.property.nombre_interno}\n`;
      texto += `Dirección: ${r.property.direccion_completa || "No especificada"}\n`;
      texto += `Ref. catastral: ${r.property.referencia_catastral || "No especificada"}\n`;
      texto += `Valor adquisición: ${r.property.valor_compra ? r.property.valor_compra.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "No especificado"}\n`;
      texto += `Año adquisición: ${r.property.ano_compra || "No especificado"}\n`;
      texto += `${"─".repeat(40)}\n`;

      texto += `\n  INGRESOS POR ALQUILER (${r.ingresos.toLocaleString("es-ES", { style: "currency", currency: "EUR" })})\n`;
      if (r.detalleIngresos.length === 0) {
        texto += `    Sin ingresos registrados\n`;
      } else {
        for (const ing of r.detalleIngresos.sort((a, b) => a.mes - b.mes)) {
          texto += `    ${MESES[ing.mes - 1]}: ${ing.importe.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
        }
      }

      texto += `\n  GASTOS DEDUCIBLES (${r.gastos.toLocaleString("es-ES", { style: "currency", currency: "EUR" })})\n`;
      if (r.detalleGastos.length === 0) {
        texto += `    Sin gastos registrados\n`;
      } else {
        const porCategoria: Record<string, { total: number; items: typeof r.detalleGastos }> = {};
        for (const g of r.detalleGastos) {
          if (!porCategoria[g.categoria]) porCategoria[g.categoria] = { total: 0, items: [] };
          porCategoria[g.categoria].total += g.importe;
          porCategoria[g.categoria].items.push(g);
        }
        for (const [cat, data] of Object.entries(porCategoria)) {
          texto += `    ${cat.toUpperCase()} — ${data.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
          for (const item of data.items) {
            texto += `      · ${item.fecha} ${item.concepto || ""} ${item.importe.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}\n`;
          }
        }
      }

      texto += `\n  FACTURAS (${r.facturas.toLocaleString("es-ES", { style: "currency", currency: "EUR" })})\n`;
      if (r.detalleFacturas.length === 0) {
        texto += `    Sin facturas registradas\n`;
      } else {
        for (const f of r.detalleFacturas) {
          texto += `    · ${f.fecha || "S/F"} | ${f.emisor || "Emisor desconocido"} | ${(f.total || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} | ${f.categoria || ""}\n`;
        }
      }
      texto += `\n`;
    }

    texto += `\nINFORMACIÓN ADICIONAL PARA EL GESTOR\n${"─".repeat(40)}\n`;
    texto += `Número de inmuebles: ${properties.length}\n`;
    for (const r of resumenes) {
      const p = r.property;
      texto += `\n  ${p.nombre_interno}:\n`;
      texto += `    Tipo: ${p.tipo_vivienda || "No especificado"} | Superficie: ${p.superficie_m2 ? p.superficie_m2 + " m²" : "N/E"}\n`;
      texto += `    IBI: ${p.ibi_importe ? p.ibi_importe.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "N/E"}\n`;
      texto += `    Comunidad: ${p.cuota_comunidad ? p.cuota_comunidad.toLocaleString("es-ES", { style: "currency", currency: "EUR" }) + "/mes" : "N/E"}\n`;
      texto += `    Seguro: ${p.seguros && Array.isArray(p.seguros) && p.seguros.length > 0 ? "Sí" : "No registrado"}\n`;
      texto += `    Calificación energética: ${p.calificacion_energetica || "N/E"}\n`;
    }

    texto += `\n\nDocumento generado automáticamente por la plataforma de gestión inmobiliaria.\n`;
    return texto;
  };

  const descargarPDF = () => {
    const texto = generarTextoInforme();
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Declaracion_Hacienda_${anio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Informe descargado");
  };

  const enviarEmail = () => {
    if (!gestorEmail) { toast.error("Introduce el email del gestor"); return; }
    const asunto = encodeURIComponent(`Informe fiscal ejercicio ${anio} – ${profileData?.nombre || "Propietario"} ${profileData?.apellidos || ""}`);
    const cuerpo = encodeURIComponent(
      `Estimado/a ${gestorNombre || "gestor"},\n\n` +
      `Le adjunto el informe fiscal del ejercicio ${anio} para la preparación de la declaración de la renta.\n\n` +
      `Quedo a su disposición para cualquier aclaración.\n\n` +
      `Un saludo,\n${profileData?.nombre || ""} ${profileData?.apellidos || ""}\n\n` +
      `---\nNOTA: El informe detallado se ha descargado como archivo adjunto. Por favor, adjúntelo manualmente a este correo.`
    );
    window.open(`mailto:${gestorEmail}?subject=${asunto}&body=${cuerpo}`, "_blank");
    descargarPDF();
    setEmailOpen(false);
    toast.success("Se ha abierto tu cliente de correo. Adjunta el archivo descargado.");
  };

  const fmt = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a documentación
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calculator size={20} className="text-primary" />
            Declaración de Hacienda — {anio}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Informe automático con todos los datos fiscales para tu gestor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
          >
            {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 1 - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Generando informe...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp size={14} className="text-green-500" /> Ingresos
              </div>
              <div className="text-lg font-bold text-foreground">{fmt(totales.ingresos)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingDown size={14} className="text-red-500" /> Gastos
              </div>
              <div className="text-lg font-bold text-foreground">{fmt(totales.gastos)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText size={14} className="text-blue-500" /> Facturas
              </div>
              <div className="text-lg font-bold text-foreground">{fmt(totales.facturas)}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Euro size={14} className="text-primary" /> Rendimiento
              </div>
              <div className={`text-lg font-bold ${totales.rendimiento >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt(totales.rendimiento)}
              </div>
            </div>
          </div>

          {/* Per-property detail */}
          {resumenes.map(r => (
            <div key={r.property.id} className="bg-card border border-border rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{r.property.nombre_interno}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{r.property.direccion_completa || ""}</span>
              </div>
              <Separator className="mb-3" />

              <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                <div>
                  <span className="text-muted-foreground">Ingresos</span>
                  <p className="font-semibold text-foreground">{fmt(r.ingresos)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Gastos</span>
                  <p className="font-semibold text-foreground">{fmt(r.gastos)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Facturas</span>
                  <p className="font-semibold text-foreground">{fmt(r.facturas)}</p>
                </div>
              </div>

              {/* Ingresos detail */}
              {r.detalleIngresos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Ingresos mensuales</p>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-1">
                    {r.detalleIngresos.sort((a, b) => a.mes - b.mes).map(ing => (
                      <div key={ing.mes} className="bg-muted/50 rounded px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{MESES[ing.mes - 1]?.slice(0, 3)}</span>
                        <p className="font-medium text-foreground">{fmt(ing.importe)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gastos detail */}
              {r.detalleGastos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Gastos deducibles</p>
                  <div className="space-y-1">
                    {r.detalleGastos.map((g, i) => (
                      <div key={i} className="flex justify-between text-xs bg-muted/30 rounded px-2 py-1">
                        <span className="text-muted-foreground">{g.fecha} · {g.categoria} {g.concepto ? `— ${g.concepto}` : ""}</span>
                        <span className="font-medium text-foreground">{fmt(g.importe)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Facturas detail */}
              {r.detalleFacturas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Facturas</p>
                  <div className="space-y-1">
                    {r.detalleFacturas.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs bg-muted/30 rounded px-2 py-1">
                        <span className="text-muted-foreground">{f.fecha || "S/F"} · {f.emisor || "Emisor desconocido"} · {f.categoria || ""}</span>
                        <span className="font-medium text-foreground">{fmt(f.total || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.detalleIngresos.length === 0 && r.detalleGastos.length === 0 && r.detalleFacturas.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin datos registrados para {anio}</p>
              )}
            </div>
          ))}

          {resumenes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay propiedades registradas.
            </div>
          )}

          {/* Action buttons */}
          {resumenes.length > 0 && (
            <div className="flex gap-3 mt-6">
              <Button onClick={descargarPDF} variant="outline" className="flex items-center gap-2">
                <Download size={16} /> Descargar informe
              </Button>
              <Button onClick={() => setEmailOpen(true)} className="flex items-center gap-2">
                <Send size={16} /> Enviar al gestor
              </Button>
            </div>
          )}
        </>
      )}

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={18} className="text-primary" /> Enviar informe al gestor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre de la gestoría</Label>
              <Input value={gestoriaNombre} onChange={e => setGestoriaNombre(e.target.value)} placeholder="Ej: Asesoría Fiscal López" />
            </div>
            <div>
              <Label className="text-xs">Nombre del gestor</Label>
              <Input value={gestorNombre} onChange={e => setGestorNombre(e.target.value)} placeholder="Ej: María García" />
            </div>
            <div>
              <Label className="text-xs">Email del gestor</Label>
              <Input type="email" value={gestorEmail} onChange={e => setGestorEmail(e.target.value)} placeholder="gestor@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancelar</Button>
            <Button onClick={enviarEmail} className="flex items-center gap-2">
              <Send size={14} /> Enviar email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeclaracionHaciendaSection;
