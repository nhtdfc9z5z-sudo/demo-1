import { useState, useEffect, useRef, useCallback } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsappUtils";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Home, Phone, Mail, FileText, Upload, Trash2, ExternalLink, Pencil, AlertTriangle, Eye, EyeOff, Copy, Check, Link2, ShieldCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAltaAlquiler } from "@/components/propietarios/AltaAlquilerContext";
import { Wand2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import type { Inquilino, InquilinoDocumento } from "@/hooks/useInquilinos";
import type { Property } from "@/hooks/useProperties";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { Contrato } from "@/hooks/useContratos";
import ContratoActivoCard from "./inquilino-detail/ContratoActivoCard";
import ResumenPagosCard from "./inquilino-detail/ResumenPagosCard";
import PerfilEconomicoCard from "./inquilino-detail/PerfilEconomicoCard";

const TIPOS_INQUILINO = [
  { value: "asalariado", label: "Asalariado" },
  { value: "autonomo", label: "Autónomo" },
  { value: "pensionista", label: "Pensionista" },
];

const DOCS_POR_TIPO: Record<string, { categoria: string; label: string }[]> = {
  asalariado: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "contrato_trabajo", label: "Contrato de trabajo" },
    { categoria: "nominas", label: "Últimas 3 nóminas" },
    { categoria: "vida_laboral", label: "Vida laboral" },
    { categoria: "irpf", label: "Declaración de la renta (IRPF)" },
  ],
  autonomo: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "alta_autonomos", label: "Alta de autónomos" },
    { categoria: "irpf", label: "Última declaración de la renta" },
    { categoria: "modelo_trimestral", label: "Modelo trimestral (130/131)" },
    { categoria: "resumen_iva", label: "Resumen anual IVA (390)" },
  ],
  pensionista: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "certificado_pension", label: "Certificado de pensión / justificante de ingresos" },
  ],
};

const statusStyle: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800",
  finalizado: "bg-zinc-100 text-zinc-600",
  moroso: "bg-red-100 text-red-800",
};

const estadoIncColors: Record<string, string> = {
  "Abierta": "bg-red-100 text-red-800",
  "En diagnóstico": "bg-amber-100 text-amber-800",
  "Presupuestada": "bg-blue-100 text-blue-800",
  "Aprobada": "bg-indigo-100 text-indigo-800",
  "En curso": "bg-sky-100 text-sky-800",
  "Cerrada": "bg-emerald-100 text-emerald-800",
};

interface InquilinoDetailPanelProps {
  inquilino: Inquilino | null;
  properties: Property[];
  incidencias?: Incidencia[];
  contratos?: Contrato[];
  open: boolean;
  onClose: () => void;
  onEdit: (inq: Inquilino) => void;
  fetchDocumentos: (inquilinoId: string) => Promise<InquilinoDocumento[]>;
  uploadDocumento: (inquilinoId: string, file: File, categoria: string) => Promise<InquilinoDocumento | null>;
  deleteDocumento: (doc: InquilinoDocumento) => Promise<void>;
  onUpdateTipo: (id: string, tipo: string) => Promise<void>;
}

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
  <div className="flex items-start gap-3 py-2">
    <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  </div>
);

const InquilinoDetailPanel = ({
  inquilino,
  properties,
  incidencias = [],
  contratos = [],
  open,
  onClose,
  onEdit,
  fetchDocumentos,
  uploadDocumento,
  deleteDocumento,
  onUpdateTipo,
}: InquilinoDetailPanelProps) => {
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<InquilinoDocumento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const altaAlquiler = useAltaAlquiler();
  const [uploading, setUploading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [seguroImpago, setSeguroImpago] = useState<{ id: string; compania: string | null; num_poliza: string | null; estado: string | null } | null>(null);
  const [loadingSeguro, setLoadingSeguro] = useState(false);
  const [datosOpen, setDatosOpen] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!inquilino) return;
    setLoadingDocs(true);
    const docs = await fetchDocumentos(inquilino.id);
    setDocumentos(docs);
    setLoadingDocs(false);
  }, [inquilino, fetchDocumentos]);

  const loadSeguro = useCallback(async () => {
    if (!inquilino) return;
    setLoadingSeguro(true);
    const { data: links } = await supabase
      .from("seguro_impago_inquilinos" as any)
      .select("seguro_impago_id")
      .eq("inquilino_id", inquilino.id);
    
    if (links && (links as any[]).length > 0) {
      const seguroIds = (links as any[]).map((l: any) => l.seguro_impago_id);
      const { data } = await supabase
        .from("seguros_impago" as any)
        .select("id, compania, num_poliza, estado")
        .in("id", seguroIds)
        .eq("estado", "activo")
        .limit(1)
        .maybeSingle();
      setSeguroImpago(data as any);
    } else {
      setSeguroImpago(null);
    }
    setLoadingSeguro(false);
  }, [inquilino]);

  useEffect(() => {
    if (open && inquilino) {
      loadDocs();
      loadSeguro();
    }
  }, [open, inquilino, loadDocs, loadSeguro]);

  if (!inquilino) return null;

  const st = statusStyle[inquilino.estado || "activo"] || statusStyle.activo;

  // Prioritize inquilino_id for incidencias, fallback to name+period match
  const tenantIncidencias = incidencias.filter(inc => {
    // Primary: direct FK match
    if (inc.inquilino_id === inquilino.id) return true;
    // Legacy fallback: name + property + date range
    if (!inc.inquilino_id && inc.property_id === inquilino.property_id) {
      const nameMatch = inc.inquilino_nombre &&
        `${inquilino.nombre} ${inquilino.apellidos || ""}`.toLowerCase().includes(inc.inquilino_nombre.toLowerCase());
      if (nameMatch && inquilino.fecha_entrada) {
        const incDate = new Date(inc.created_at || 0);
        const entrada = new Date(inquilino.fecha_entrada);
        const salida = inquilino.fecha_salida ? new Date(inquilino.fecha_salida) : new Date();
        return incDate >= entrada && incDate <= salida;
      }
    }
    return false;
  });

  const tipo = inquilino.tipo_inquilino || "asalariado";
  const docCategories = DOCS_POR_TIPO[tipo] || DOCS_POR_TIPO.asalariado;

  const handleFileUpload = async (categoria: string, file: File) => {
    setUploading(categoria);
    const doc = await uploadDocumento(inquilino.id, file, categoria);
    if (doc) setDocumentos(prev => [doc, ...prev]);
    setUploading(null);
  };

  const handleDeleteDoc = async (doc: InquilinoDocumento) => {
    await deleteDocumento(doc);
    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
  };

  const handleTipoChange = async (newTipo: string) => {
    await onUpdateTipo(inquilino.id, newTipo);
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {/* ── CABECERA ── */}
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              {inquilino.nombre} {inquilino.apellidos || ""}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                inquilino.rol_inquilino === "avalista" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
              }`}>
                {inquilino.rol_inquilino === "avalista" ? "Avalista" : "Inquilino"}
              </span>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${st}`}>
                {inquilino.estado || "activo"}
              </span>
              <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" onClick={() => onEdit(inquilino)}>
                <Pencil size={13} /> Editar
              </Button>
              <Button
                variant="default"
                size="sm"
                className="rounded-lg text-xs gap-1.5"
                onClick={() => altaAlquiler.open({ inquilinoId: inquilino.id, origen: "inquilino", modoInicial: "contrato" })}
                title="Vincular vivienda o crear contrato con el mismo flujo guiado"
              >
                <Wand2 size={13} /> Vincular vivienda / contrato
              </Button>
            </div>
          </div>
          {/* Portal status inline */}
          <div className="flex items-center gap-2 mt-1">
            {inquilino.dni && (
              <span className="text-xs text-muted-foreground">DNI: {inquilino.dni}</span>
            )}
            {inquilino.auth_user_id ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Portal vinculado ✓</span>
            ) : inquilino.email ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Portal pendiente</span>
            ) : null}
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* ── INVITACIÓN PORTAL ── */}
          {inquilino.email && !inquilino.auth_user_id && (
            <div className="bg-accent/50 border border-accent rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Link2 size={14} className="text-primary" />
                <p className="text-xs font-semibold text-foreground">Enlace de invitación</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Comparte este enlace para que {inquilino.nombre} acceda al portal del inquilino.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg flex-1"
                  onClick={() => {
                    const link = `${window.location.origin}/login?role=inquilino&email=${encodeURIComponent(inquilino.email!)}`;
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    toast({ title: "Enlace copiado" });
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? "¡Copiado!" : "Copiar enlace"}
                </Button>
                <Button
                  variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg"
                  onClick={() => {
                    const link = `${window.location.origin}/login?role=inquilino&email=${encodeURIComponent(inquilino.email!)}`;
                    const text = `Hola ${inquilino.nombre}, te invito a acceder al portal de inquilinos. Crea tu cuenta aquí: ${link}`;
                    window.open(buildWhatsAppUrl(null, text), "_blank");
                  }}
                >
                  WhatsApp
                </Button>
              </div>
            </div>
          )}

          {/* ── 1. CONTRATO ACTIVO ── */}
          <ContratoActivoCard inquilino={inquilino} contratos={contratos} />

          {/* ── 2. RESUMEN DE PAGOS ── */}
          {inquilino.rol_inquilino !== "avalista" && (
            <ResumenPagosCard inquilino={inquilino} contratos={contratos} />
          )}

          {/* ── 3. PERFIL ECONÓMICO ── */}
          <PerfilEconomicoCard inquilino={inquilino} contratos={contratos} />

          {/* ── 4. INCIDENCIAS ACTIVAS ── */}
          {tenantIncidencias.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle size={14} />
                Incidencias
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-normal">{tenantIncidencias.length}</span>
              </h3>
              <div className="space-y-2">
                {tenantIncidencias.slice(0, 5).map(inc => {
                  const prop = properties.find(p => p.id === inc.property_id);
                  const isLegacy = inc.inquilino_id !== inquilino.id;
                  return (
                    <div key={inc.id} className="bg-secondary/50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">#{inc.numero_incidencia}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${estadoIncColors[inc.estado] || "bg-zinc-100 text-zinc-600"}`}>
                          {inc.estado}
                        </span>
                        {isLegacy && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Asociación estimada</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{inc.concepto || "Sin concepto"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {prop?.nombre_interno || "Sin propiedad"} · {inc.created_at ? new Date(inc.created_at).toLocaleDateString("es-ES") : ""}
                      </p>
                    </div>
                  );
                })}
                {tenantIncidencias.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+ {tenantIncidencias.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {/* ── 5. SEGURO DE IMPAGO ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck size={14} />
              Seguro de impago
            </h3>
            {loadingSeguro ? (
              <p className="text-xs text-muted-foreground">Comprobando…</p>
            ) : seguroImpago ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Seguro activo</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {seguroImpago.compania || "Compañía no especificada"}
                  {seguroImpago.num_poliza ? ` · Póliza: ${seguroImpago.num_poliza}` : ""}
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 border border-dashed border-border rounded-xl p-4 text-center">
                <ShieldCheck size={20} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Sin seguro de impago vinculado.</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Puedes registrarlo desde la sección <span className="font-medium">Documentación → Seguros de impago</span> de la propiedad.
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* ── 6. DOCUMENTACIÓN ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Documentación</h3>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Tipo de inquilino</p>
              <div className="flex gap-2">
                {TIPOS_INQUILINO.map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleTipoChange(t.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      tipo === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Estos documentos se usan para scoring y preparación de seguro de impago.</p>
            </div>

            {loadingDocs ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {docCategories.map(({ categoria, label }) => {
                  const catDocs = documentos.filter(d => d.categoria === categoria);
                  const isUploading = uploading === categoria;
                  return (
                    <div key={categoria} className="bg-secondary/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <Button
                          variant="ghost" size="sm" disabled={isUploading}
                          className="text-xs text-primary hover:text-primary/80 gap-1 h-7"
                          onClick={() => fileInputRefs.current[categoria]?.click()}
                        >
                          <Upload size={12} />
                          {isUploading ? "Subiendo..." : "Subir"}
                        </Button>
                        <input
                          ref={el => { fileInputRefs.current[categoria] = el; }}
                          type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" multiple
                          onChange={e => {
                            const files = e.target.files;
                            if (files) Array.from(files).forEach(f => handleFileUpload(categoria, f));
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {catDocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sin documentos</p>
                      ) : (
                        <div className="space-y-1.5">
                          {catDocs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={14} className="text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs text-foreground truncate block">{doc.nombre_archivo}</span>
                                  {(doc as any).subido_por === "inquilino" && (
                                    <span className="text-[10px] text-muted-foreground">Subido por inquilino</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7"
                                  title={(doc as any).visible_para_inquilino !== false ? "Visible para inquilino" : "Oculto para inquilino"}
                                  onClick={async () => {
                                    const newVal = (doc as any).visible_para_inquilino === false;
                                    await supabase.from("inquilino_documentos").update({ visible_para_inquilino: newVal } as any).eq("id", doc.id);
                                    if (inquilino) {
                                      setLoadingDocs(true);
                                      const docs = await fetchDocumentos(inquilino.id);
                                      setDocumentos(docs);
                                      setLoadingDocs(false);
                                    }
                                  }}
                                >
                                  {(doc as any).visible_para_inquilino !== false
                                    ? <Eye size={13} className="text-primary" />
                                    : <EyeOff size={13} className="text-muted-foreground" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.url, "_blank")}>
                                  <ExternalLink size={13} />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                      <Trash2 size={13} />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                                      <AlertDialogDescription>Se eliminará "{doc.nombre_archivo}". Esta acción no se puede deshacer.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteDoc(doc)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* ── 7. DATOS PERSONALES (colapsable) ── */}
          <Collapsible open={datosOpen} onOpenChange={setDatosOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1">
              <h3 className="text-sm font-semibold text-foreground">Datos personales</h3>
              <span className="text-xs text-muted-foreground">{datosOpen ? "Ocultar" : "Ver"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <InfoRow icon={User} label="Nombre completo" value={`${inquilino.nombre} ${inquilino.apellidos || ""}`} />
              <InfoRow icon={FileText} label="DNI / NIE" value={inquilino.dni} />
              <InfoRow icon={Phone} label="Teléfono" value={inquilino.telefono} />
              <InfoRow icon={Mail} label="Email" value={inquilino.email} />
              <InfoRow icon={Home} label="Activo asignado" value={
                inquilino.property_id
                  ? properties.find(p => p.id === inquilino.property_id)?.nombre_interno || "Vivienda desconocida"
                  : "Sin asignar"
              } />
              {inquilino.notas && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inquilino.notas}</p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InquilinoDetailPanel;
