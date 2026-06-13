import { useState } from "react";
import { Shield, Plus, Trash2, ExternalLink, ChevronDown, ChevronUp, ClipboardCopy, BookOpen, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useFianzas, COMUNIDADES_AUTONOMAS, ESTADOS_FIANZA, type Fianza } from "@/hooks/useFianzas";
import { toast } from "sonner";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

function formatImporte(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "€";
}

const estadoColor: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  depositada: "bg-emerald-100 text-emerald-800",
  devolucion_solicitada: "bg-sky-100 text-sky-800",
  devuelta: "bg-zinc-100 text-zinc-700",
};

interface GuiaCampo {
  paso: number;
  campo: string;
  valor: string;
  instruccion: string;
}

type GuiaTipo = "deposito" | "devolucion";

function generarGuiaDeposito(
  fianza: Fianza,
  property: Property | undefined,
  inquilino: Inquilino | undefined,
  profile: { nombre?: string | null; apellidos?: string | null; telefono?: string | null; email?: string | null; nif?: string | null } | null
): GuiaCampo[] {
  const campos: GuiaCampo[] = [];
  let paso = 1;

  campos.push({ paso: paso++, campo: "NIF/CIF del arrendador", valor: profile?.nif || "No registrado — añádelo en tu perfil", instruccion: "NIF o CIF del propietario del inmueble." });
  campos.push({ paso: paso++, campo: "Nombre y apellidos del arrendador", valor: [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "No registrado en CapitalRent", instruccion: "Nombre completo del propietario." });
  campos.push({ paso: paso++, campo: "Teléfono del arrendador", valor: profile?.telefono || "No registrado", instruccion: "Teléfono de contacto del propietario." });
  campos.push({ paso: paso++, campo: "Email del arrendador", valor: profile?.email || "No registrado", instruccion: "Correo electrónico del propietario." });

  campos.push({ paso: paso++, campo: "Dirección del inmueble", valor: property?.direccion_completa || "No registrada", instruccion: "Dirección completa del inmueble arrendado." });
  campos.push({ paso: paso++, campo: "Código postal", valor: property?.codigo_postal || "No registrado", instruccion: "CP del inmueble." });
  campos.push({ paso: paso++, campo: "Municipio", valor: property?.ciudad || "No registrado", instruccion: "Ciudad/municipio donde se ubica el inmueble." });
  campos.push({ paso: paso++, campo: "Provincia", valor: property?.provincia || "No registrada", instruccion: "Provincia del inmueble." });
  campos.push({ paso: paso++, campo: "Referencia catastral", valor: property?.referencia_catastral || "No registrada", instruccion: "Referencia catastral del inmueble. Se encuentra en el recibo del IBI o en el Catastro." });
  campos.push({ paso: paso++, campo: "Tipo de vivienda", valor: property?.tipo_vivienda || "No especificado", instruccion: "Piso, casa, estudio, etc." });
  campos.push({ paso: paso++, campo: "Superficie (m²)", valor: property?.superficie_m2 ? `${property.superficie_m2} m²` : "No registrada", instruccion: "Superficie útil del inmueble." });

  campos.push({ paso: paso++, campo: "NIF del arrendatario", valor: inquilino?.dni || "No registrado", instruccion: "DNI/NIE del inquilino." });
  campos.push({ paso: paso++, campo: "Nombre del arrendatario", valor: [inquilino?.nombre, inquilino?.apellidos].filter(Boolean).join(" ") || "No registrado", instruccion: "Nombre completo del inquilino." });
  campos.push({ paso: paso++, campo: "Teléfono del arrendatario", valor: inquilino?.telefono || "No registrado", instruccion: "Teléfono de contacto del inquilino." });
  campos.push({ paso: paso++, campo: "Email del arrendatario", valor: inquilino?.email || "No registrado", instruccion: "Correo electrónico del inquilino." });

  campos.push({ paso: paso++, campo: "Fecha de inicio del contrato", valor: inquilino?.fecha_entrada ? new Date(inquilino.fecha_entrada).toLocaleDateString("es-ES") : "No registrada", instruccion: "Fecha en la que comenzó el arrendamiento." });
  campos.push({ paso: paso++, campo: "Renta mensual", valor: inquilino?.renta_mensual ? `${Number(inquilino.renta_mensual).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : "No registrada", instruccion: "Importe mensual de la renta pactada." });

  campos.push({ paso: paso++, campo: "Importe de la fianza", valor: formatImporte(fianza.importe), instruccion: "Importe total de la fianza a depositar." });
  campos.push({ paso: paso++, campo: "Número de mensualidades", valor: `${fianza.meses_fianza || 1} mes(es)`, instruccion: "Número de meses que cubre la fianza (legal = 1 mes)." });
  campos.push({ paso: paso++, campo: "Tipo de fianza", valor: fianza.tipo_fianza === "legal" ? "Fianza legal" : "Fianza adicional", instruccion: "Legal (obligatoria, 1 mes) o adicional." });

  return campos;
}

function generarGuiaDevolucion(
  fianza: Fianza,
  property: Property | undefined,
  inquilino: Inquilino | undefined,
  profile: { nombre?: string | null; apellidos?: string | null; telefono?: string | null; email?: string | null; nif?: string | null } | null
): GuiaCampo[] {
  const campos: GuiaCampo[] = [];
  let paso = 1;

  campos.push({ paso: paso++, campo: "Nº de expediente de la fianza", valor: fianza.numero_expediente || "No registrado — lo necesitarás del justificante de depósito", instruccion: "Número de expediente que te dieron al depositar la fianza. Imprescindible para solicitar la devolución." });
  campos.push({ paso: paso++, campo: "NIF/CIF del arrendador", valor: profile?.nif || "No registrado — añádelo en tu perfil", instruccion: "El mismo NIF con el que depositaste la fianza." });
  campos.push({ paso: paso++, campo: "Nombre y apellidos del arrendador", valor: [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "No registrado en CapitalRent", instruccion: "Nombre completo del propietario que depositó la fianza." });
  campos.push({ paso: paso++, campo: "Teléfono del arrendador", valor: profile?.telefono || "No registrado", instruccion: "Teléfono de contacto para la devolución." });
  campos.push({ paso: paso++, campo: "Email del arrendador", valor: profile?.email || "No registrado", instruccion: "Email donde recibirás las notificaciones del trámite." });

  campos.push({ paso: paso++, campo: "Dirección del inmueble", valor: property?.direccion_completa || "No registrada", instruccion: "Dirección del inmueble cuya fianza quieres recuperar." });
  campos.push({ paso: paso++, campo: "Referencia catastral", valor: property?.referencia_catastral || "No registrada", instruccion: "Referencia catastral del inmueble." });

  campos.push({ paso: paso++, campo: "NIF del arrendatario", valor: inquilino?.dni || "No registrado", instruccion: "DNI/NIE del inquilino que ocupaba el inmueble." });
  campos.push({ paso: paso++, campo: "Nombre del arrendatario", valor: [inquilino?.nombre, inquilino?.apellidos].filter(Boolean).join(" ") || "No registrado", instruccion: "Nombre completo del inquilino." });

  campos.push({ paso: paso++, campo: "Fecha de inicio del contrato", valor: inquilino?.fecha_entrada ? new Date(inquilino.fecha_entrada).toLocaleDateString("es-ES") : "No registrada", instruccion: "Fecha de inicio del arrendamiento." });
  campos.push({ paso: paso++, campo: "Fecha de fin del contrato", valor: inquilino?.fecha_salida ? new Date(inquilino.fecha_salida).toLocaleDateString("es-ES") : "No registrada — necesaria para la devolución", instruccion: "Fecha en que finalizó el arrendamiento. Si no la tienes, añádela en la ficha del inquilino." });

  campos.push({ paso: paso++, campo: "Importe depositado", valor: formatImporte(fianza.importe), instruccion: "Importe total que se depositó como fianza." });
  campos.push({ paso: paso++, campo: "Fecha de depósito", valor: fianza.fecha_deposito ? new Date(fianza.fecha_deposito).toLocaleDateString("es-ES") : "No registrada", instruccion: "Fecha en que se realizó el depósito original." });

  campos.push({ paso: paso++, campo: "Cuenta bancaria (IBAN)", valor: "Introduce tu IBAN para recibir la devolución", instruccion: "Número de cuenta donde quieres recibir el importe. Formato: ES00 0000 0000 00 0000000000." });

  campos.push({ paso: paso++, campo: "Motivo de devolución", valor: "Finalización del contrato de arrendamiento", instruccion: "Normalmente: fin de contrato. También puede ser por mutuo acuerdo, desistimiento, etc." });

  campos.push({ paso: paso++, campo: "Documentación a adjuntar", valor: "Justificante de depósito, contrato, acta de entrega de llaves", instruccion: "Prepara: 1) Justificante del depósito original, 2) Copia del contrato, 3) Acta de entrega de llaves o documento de fin de contrato, 4) Fotos del estado del inmueble (opcional pero recomendable)." });

  return campos;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (text && text !== "No registrado" && text !== "No registrada" && text !== "No especificado" && text !== "No registrado en CapitalRent") {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  const isAvailable = text && !text.startsWith("No ");
  return (
    <button
      onClick={handleCopy}
      disabled={!isAvailable}
      className={`p-1 rounded transition-colors ${isAvailable ? "hover:bg-primary/10 text-primary cursor-pointer" : "text-muted-foreground/30 cursor-default"}`}
      title={isAvailable ? "Copiar" : "Dato no disponible"}
    >
      {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
    </button>
  );
}

interface FianzasSectionProps {
  properties: Property[];
  inquilinos: Inquilino[];
  onBack: () => void;
  profile?: { nombre?: string | null; apellidos?: string | null; telefono?: string | null; email?: string | null; nif?: string | null } | null;
}

const FianzasSection = ({ properties, inquilinos, onBack, profile = null }: FianzasSectionProps) => {
  const { fianzas, loading, createFianza, updateFianza, deleteFianza } = useFianzas();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guiaFianza, setGuiaFianza] = useState<Fianza | null>(null);
  const [guiaTipo, setGuiaTipo] = useState<GuiaTipo>("deposito");
  const [form, setForm] = useState<Partial<Fianza>>({
    comunidad_autonoma: "",
    organismo: "",
    property_id: "",
    inquilino_id: null,
    importe: 0,
    tipo_fianza: "legal",
    meses_fianza: 1,
    estado: "pendiente",
  });

  const handleCCAAChange = (value: string) => {
    const ccaa = COMUNIDADES_AUTONOMAS.find(c => c.value === value);
    setForm(prev => ({
      ...prev,
      comunidad_autonoma: value,
      organismo: ccaa?.organismo || "",
    }));
  };

  const handlePropertyChange = (value: string) => {
    const tenant = inquilinos.find(i => i.property_id === value && i.rol_inquilino !== "avalista");
    const rentaMensual = tenant?.renta_mensual || 0;
    setForm(prev => ({
      ...prev,
      property_id: value,
      inquilino_id: tenant?.id || null,
      importe: Number(rentaMensual) * (prev.meses_fianza || 1),
    }));
  };

  const handleMesesChange = (meses: number) => {
    const tenant = inquilinos.find(i => i.property_id === form.property_id && i.rol_inquilino !== "avalista");
    const rentaMensual = tenant?.renta_mensual || 0;
    setForm(prev => ({
      ...prev,
      meses_fianza: meses,
      importe: Number(rentaMensual) * meses,
    }));
  };

  const handleSubmit = async () => {
    if (!form.property_id || !form.comunidad_autonoma) return;
    await createFianza(form);
    setShowForm(false);
    setForm({
      comunidad_autonoma: "", organismo: "", property_id: "", inquilino_id: null,
      importe: 0, tipo_fianza: "legal", meses_fianza: 1, estado: "pendiente",
    });
  };

  const openGuia = (f: Fianza) => {
    setGuiaFianza(f);
  };

  const guiaArgs = guiaFianza ? [
    guiaFianza,
    properties.find(p => p.id === guiaFianza.property_id),
    guiaFianza.inquilino_id ? inquilinos.find(i => i.id === guiaFianza.inquilino_id) : inquilinos.find(i => i.property_id === guiaFianza.property_id && i.rol_inquilino !== "avalista"),
    profile
  ] as const : null;

  const guiaCampos = guiaArgs
    ? (guiaTipo === "deposito" ? generarGuiaDeposito(...guiaArgs) : generarGuiaDevolucion(...guiaArgs))
    : [];

  const copyAllToClipboard = () => {
    const text = guiaCampos.map(c => `${c.campo}: ${c.valor}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Todos los datos copiados al portapapeles");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1 transition-colors"><ArrowLeft size={16} /> Volver a documentación</button>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Depósito de fianza
          </h2>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
          <Plus size={15} />
          Registrar fianza
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-6">
        Gestiona el depósito obligatorio de fianzas en el organismo de tu comunidad autónoma. Cada CCAA tiene su propio proceso y organismo.
      </p>

      {/* Fianzas list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse h-20" />)}
        </div>
      ) : fianzas.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Shield size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay fianzas registradas.</p>
          <p className="text-xs text-muted-foreground mt-1">Registra el depósito de fianza de tus alquileres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fianzas.map(f => {
            const prop = properties.find(p => p.id === f.property_id);
            const inq = f.inquilino_id ? inquilinos.find(i => i.id === f.inquilino_id) : null;
            const ccaa = COMUNIDADES_AUTONOMAS.find(c => c.value === f.comunidad_autonoma);
            const estadoInfo = ESTADOS_FIANZA.find(e => e.value === f.estado);
            const isExpanded = expandedId === f.id;

            return (
              <div key={f.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{prop?.nombre_interno || "Activo"}</span>
                        <Badge variant="secondary" className={`text-[9px] ${estadoColor[f.estado] || estadoColor.pendiente}`}>
                          {estadoInfo?.label || f.estado}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{ccaa?.label || f.comunidad_autonoma}</span>
                        {inq && <span>· {inq.nombre} {inq.apellidos || ""}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground tabular-nums block leading-tight">{formatImporte(f.importe)}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">depositada actualmente</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {/* H2.8 — Fianza inicial vs depositada actualmente */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fianza inicial</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                          {f.importe_inicial != null ? formatImporte(Number(f.importe_inicial)) : formatImporte(f.importe)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Al firmar el contrato</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-primary/80">Fianza depositada actualmente</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">{formatImporte(f.importe)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Vigente hoy</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha efecto</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {f.fecha_efecto_actual
                            ? new Date(f.fecha_efecto_actual).toLocaleDateString("es-ES")
                            : (f.importe_inicial != null && Number(f.importe_inicial) !== Number(f.importe) ? "Sin fecha conocida" : "Desde el inicio")}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {f.importe_inicial != null && Number(f.importe_inicial) !== Number(f.importe)
                            ? "Importe actualizado"
                            : "Sin actualizaciones"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 text-[11px] bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/50 rounded-md p-2">
                      <Shield size={12} className="text-sky-600 shrink-0 mt-0.5" />
                      <p className="text-sky-800 dark:text-sky-200">
                        La fianza es una garantía depositada en el organismo público. <strong>No forma parte de la deuda de renta</strong> ni se descuenta de cobros mensuales.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Organismo</p>
                        <p className="text-foreground text-xs">{f.organismo}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
                        <p className="text-foreground text-xs">{f.tipo_fianza === "legal" ? "Fianza legal" : "Fianza adicional"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Meses</p>
                        <p className="text-foreground text-xs">{f.meses_fianza || 1} mes(es)</p>
                      </div>
                      {f.fecha_deposito && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Fecha depósito</p>
                          <p className="text-foreground text-xs">{new Date(f.fecha_deposito).toLocaleDateString("es-ES")}</p>
                        </div>
                      )}
                      {f.numero_expediente && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Nº Expediente</p>
                          <p className="text-foreground text-xs">{f.numero_expediente}</p>
                        </div>
                      )}
                      {f.medio_pago && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Medio de pago</p>
                          <p className="text-foreground text-xs">{f.medio_pago}</p>
                        </div>
                      )}
                    </div>

                    {f.notas && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Notas</p>
                        <p className="text-xs text-foreground bg-secondary/50 rounded-lg p-2">{f.notas}</p>
                      </div>
                    )}

                    {/* Status change + actions */}
                    <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={f.estado} onValueChange={(val) => updateFianza(f.id, { estado: val } as any)}>
                          <SelectTrigger className="h-8 text-xs w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADOS_FIANZA.map(e => (
                              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {ccaa?.url && (
                          <a href={ccaa.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink size={12} />
                            Web {ccaa.label}
                          </a>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 h-8"
                          onClick={(e) => { e.stopPropagation(); openGuia(f); }}
                        >
                          <BookOpen size={13} />
                          Guía paso a paso
                        </Button>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1">
                            <Trash2 size={13} />
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar fianza?</AlertDialogTitle>
                            <AlertDialogDescription>Se eliminará el registro de esta fianza.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { deleteFianza(f.id); setExpandedId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Guía paso a paso dialog */}
      <Dialog open={!!guiaFianza} onOpenChange={(open) => { if (!open) { setGuiaFianza(null); setGuiaTipo("deposito"); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              Guía paso a paso
            </DialogTitle>
          </DialogHeader>

          {guiaFianza && (
            <div className="space-y-1">
              {/* Tabs deposito / devolucion */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
                <button
                  onClick={() => setGuiaTipo("deposito")}
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                    guiaTipo === "deposito" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📥 Depositar fianza
                </button>
                <button
                  onClick={() => setGuiaTipo("devolucion")}
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                    guiaTipo === "devolucion" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📤 Solicitar devolución
                </button>
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  {guiaTipo === "deposito"
                    ? "Abre la web del organismo y copia cada dato para depositar la fianza."
                    : "Datos necesarios para solicitar la devolución de la fianza."}
                </p>
                <Button variant="outline" size="sm" className="text-xs gap-1 shrink-0" onClick={copyAllToClipboard}>
                  <ClipboardCopy size={12} /> Copiar todo
                </Button>
              </div>

              {guiaCampos.map((campo) => (
                <div key={campo.paso} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                    {campo.paso}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{campo.campo}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{campo.instruccion}</p>
                    <div className={`mt-1 text-xs font-mono px-2 py-1 rounded ${
                      campo.valor.startsWith("No ") ? "bg-muted/50 text-muted-foreground italic" : "bg-primary/5 text-foreground border border-primary/10"
                    }`}>
                      {campo.valor}
                    </div>
                  </div>
                  <CopyButton text={campo.valor} />
                </div>
              ))}

              {(() => {
                const ccaa = COMUNIDADES_AUTONOMAS.find(c => c.value === guiaFianza.comunidad_autonoma);
                return ccaa?.url ? (
                  <div className="pt-3">
                    <a
                      href={ccaa.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button className="w-full gap-2">
                        <ExternalLink size={14} />
                        Abrir formulario en {ccaa.label}
                      </Button>
                    </a>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar depósito de fianza</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Activo *</Label>
              <Select value={form.property_id || ""} onValueChange={handlePropertyChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona activo" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Comunidad Autónoma *</Label>
              <Select value={form.comunidad_autonoma || ""} onValueChange={handleCCAAChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona CCAA" />
                </SelectTrigger>
                <SelectContent>
                  {COMUNIDADES_AUTONOMAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.comunidad_autonoma && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-xs font-medium text-primary mb-0.5">Organismo responsable:</p>
                <p className="text-xs text-foreground">{form.organismo}</p>
                {COMUNIDADES_AUTONOMAS.find(c => c.value === form.comunidad_autonoma)?.url && (
                  <a
                    href={COMUNIDADES_AUTONOMAS.find(c => c.value === form.comunidad_autonoma)?.url}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Acceder al trámite
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de fianza</Label>
                <Select value={form.tipo_fianza || "legal"} onValueChange={(v) => setForm(prev => ({ ...prev, tipo_fianza: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal">Fianza legal (1 mes)</SelectItem>
                    <SelectItem value="adicional">Fianza adicional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Meses de fianza</Label>
                <Input
                  type="number" min={1} max={12}
                  value={form.meses_fianza || 1}
                  onChange={(e) => handleMesesChange(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Importe (€)</Label>
                <Input
                  type="number" step="0.01"
                  value={form.importe || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, importe: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Fecha de depósito</Label>
                <Input
                  type="date"
                  value={form.fecha_deposito || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, fecha_deposito: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº Expediente</Label>
                <Input
                  value={form.numero_expediente || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, numero_expediente: e.target.value }))}
                  className="mt-1"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label className="text-xs">Medio de pago</Label>
                <Select value={form.medio_pago || ""} onValueChange={(v) => setForm(prev => ({ ...prev, medio_pago: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="online">Pago online</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea
                value={form.notas || ""}
                onChange={(e) => setForm(prev => ({ ...prev, notas: e.target.value }))}
                className="mt-1"
                rows={2}
                placeholder="Observaciones, referencias..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.property_id || !form.comunidad_autonoma}>
              Registrar fianza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FianzasSection;
