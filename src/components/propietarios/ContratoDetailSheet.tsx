import { useState, useRef, useMemo } from "react";
import { getContratoTimeline, formatDateEs } from "@/lib/contratoStatusUtils";
import { SecureFileLink } from "@/components/common/SecureFileLink";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Upload, ExternalLink, FileText, CalendarDays, Euro, Home, User, Loader2, Building2, ScrollText, Zap, Droplets, Flame, Wifi, Receipt, Trash2, PackageCheck, RefreshCw, ClipboardList, AlertTriangle, Mail, Send, TrendingUp, Percent, Bell, Clock, Calendar, Download, Users, Paperclip, Plus, ChevronUp, ChevronDown, Shield, Info } from "lucide-react";
import { openContractDocumentFromRef, resolveGeneratedContractDocument, resolveOriginalContractDocument } from "@/lib/contractDocumentUtils";
import { supabase } from "@/integrations/supabase/client";
import { useContratoModificaciones } from "@/hooks/useContratoModificaciones";
import { useContratoPersonas, ROL_LABEL, type ContratoPersonaRol } from "@/hooks/useContratoPersonas";
import { parteFromRol, validarPorcentajesFiscales } from "@/lib/contratoRoles";
import { useRentaActualizaciones } from "@/hooks/useRentaActualizaciones";
import { useAuth } from "@/hooks/useAuth";
import ContratoModificacionesPanel from "./ContratoModificacionesPanel";
import HistorialContratoSection from "./HistorialContratoSection";
import HistoricoEconomicoSection from "./HistoricoEconomicoSection";
import RegularizarHistoricoDialog from "./RegularizarHistoricoDialog";
import FianzaGarantiasSection from "./FianzaGarantiasSection";
import { History as HistoryIcon } from "lucide-react";
import type { Contrato } from "@/hooks/useContratos";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

export interface IpcEditInfo {
  oldRenta: number;
  newRenta: number;
  percent: number;
}

interface ContratoDetailSheetProps {
  contrato: Contrato | null;
  open: boolean;
  onClose: () => void;
  properties: Property[];
  inquilinos: Inquilino[];
  onSave: (id: string, data: Partial<Contrato>) => Promise<void>;
  onUploadArchivo: (id: string, file: File) => Promise<any>;
  onUploadDocumentoOriginal?: (id: string, file: File) => Promise<any>;
  onCreateCalendarEvents: (contrato: Contrato) => Promise<void>;
  onUpdateContratoWithHistory?: (contrato: Contrato, data: Partial<Contrato>, title: string, detail?: string, valAnterior?: string, valNuevo?: string) => Promise<void>;
  initialIpcInfo?: IpcEditInfo | null;
}

const ESTADO_MAP: Record<string, { label: string; color: string }> = {
  vigente: { label: "Vigente", color: "bg-emerald-500" },
  finalizado: { label: "Finalizado", color: "bg-muted-foreground/40" },
  renovado: { label: "Prorrogado", color: "bg-sky-500" },
};

interface FieldProps {
  label: string;
  value: string | number | null | undefined;
  editing: boolean;
  type?: string;
  onChange?: (val: string) => void;
  suffix?: string;
  placeholder?: string;
  colSpan?: boolean;
}

const Field = ({ label, value, editing, type = "text", onChange, suffix, placeholder, colSpan }: FieldProps) => {
  const displayValue = value != null && value !== "" ? `${value}${suffix || ""}` : "—";
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs mt-0.5"
        />
      ) : (
        <p className="text-sm font-medium text-foreground mt-0.5 min-h-[28px] flex items-center">{displayValue}</p>
      )}
    </div>
  );
};

interface SwitchFieldProps {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  editing: boolean;
  onChange?: (v: boolean) => void;
}

const SwitchField = ({ label, icon, checked, editing, onChange }: SwitchFieldProps) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2 text-xs text-foreground">
      {icon}
      {label}
    </div>
    {editing ? (
      <Switch checked={checked} onCheckedChange={onChange} />
    ) : (
      <Badge variant={checked ? "default" : "secondary"} className="text-[10px]">
        {checked ? "Inquilino" : "Propietario"}
      </Badge>
    )}
  </div>
);

type UtilityPayer = "inquilino" | "propietario" | "comunidad";

interface TriStateFieldProps {
  label: string;
  icon: React.ReactNode;
  value: UtilityPayer;
  editing: boolean;
  onChange?: (v: UtilityPayer) => void;
}

const TriStateField = ({ label, icon, value, editing, onChange }: TriStateFieldProps) => {
  const labels: Record<UtilityPayer, string> = { inquilino: "Inquilino", propietario: "Propietario", comunidad: "Comunidad" };
  const variants: Record<UtilityPayer, "default" | "secondary" | "outline"> = { inquilino: "default", propietario: "secondary", comunidad: "outline" };
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-xs text-foreground">
        {icon}
        {label}
      </div>
      {editing ? (
        <Select value={value} onValueChange={(v) => onChange?.(v as UtilityPayer)}>
          <SelectTrigger className="h-7 w-[120px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inquilino">Inquilino</SelectItem>
            <SelectItem value="propietario">Propietario</SelectItem>
            <SelectItem value="comunidad">Comunidad</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge variant={variants[value]} className="text-[10px]">
          {labels[value]}
        </Badge>
      )}
    </div>
  );
};

const ContratoDetailSheet = ({ contrato, open, onClose, properties, inquilinos, onSave, onUploadArchivo, onUploadDocumentoOriginal, onCreateCalendarEvents, onUpdateContratoWithHistory, initialIpcInfo }: ContratoDetailSheetProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regularizarOpen, setRegularizarOpen] = useState(false);
  const [form, setForm] = useState<Partial<Contrato>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [uploadingOriginal, setUploadingOriginal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const originalFileRef = useRef<HTMLInputElement>(null);

  // Modificaciones
  const { modificaciones, loading: loadingMods, addModificacion, addComunicacion, markConfirmado } = useContratoModificaciones(contrato?.id);

  // Personas vinculadas al contrato (multiinquilino / avalistas)
  const { personas, createPersona, updatePersona, deletePersona, reorderPersonas } = useContratoPersonas(contrato?.id || null);
  const [addingPersona, setAddingPersona] = useState(false);
  const [newPersona, setNewPersona] = useState<{ nombre: string; dni: string; telefono: string; email: string; rol: Exclude<ContratoPersonaRol, "titular_principal"> }>({
    nombre: "", dni: "", telefono: "", email: "", rol: "cotitular",
  });

  // IPC state
  const [showIpc, setShowIpc] = useState(false);
  const [ipcPercent, setIpcPercent] = useState("2.3");
  const [ipcApplying, setIpcApplying] = useState(false);
  const [ipcConfirmStep, setIpcConfirmStep] = useState<"none" | "legal" | "notify">("none");
  const [activeIpcInfo, setActiveIpcInfo] = useState<IpcEditInfo | null>(null);
  const [ipcAutoOpened, setIpcAutoOpened] = useState(false);

  // Auto-open in edit mode when initialIpcInfo is provided
  const ipcInfoKey = initialIpcInfo ? `${initialIpcInfo.oldRenta}-${initialIpcInfo.newRenta}-${initialIpcInfo.percent}` : null;
  if (initialIpcInfo && contrato && open && !ipcAutoOpened) {
    setIpcAutoOpened(true);
    setActiveIpcInfo(initialIpcInfo);
    setForm({
      titulo: contrato.titulo,
      property_id: contrato.property_id,
      inquilino_id: contrato.inquilino_id || undefined,
      fecha_inicio: contrato.fecha_inicio,
      fecha_fin: contrato.fecha_fin,
      renta_mensual: initialIpcInfo.newRenta,
      fianza_importe: contrato.fianza_importe,
      deposito_garantia: contrato.deposito_garantia,
      duracion_anos: contrato.duracion_anos,
      prorroga_anos: contrato.prorroga_anos,
      preaviso_meses: contrato.preaviso_meses,
      estado: contrato.estado,
      notas: contrato.notas,
      tiene_inventario: contrato.tiene_inventario,
      renovacion_automatica: contrato.renovacion_automatica,
      agua_paga_inquilino: contrato.agua_paga_inquilino,
      luz_paga_inquilino: contrato.luz_paga_inquilino,
      gas_paga_inquilino: contrato.gas_paga_inquilino,
      internet_paga_inquilino: contrato.internet_paga_inquilino,
      ibi_paga_inquilino: contrato.ibi_paga_inquilino,
      basuras_paga_inquilino: contrato.basuras_paga_inquilino,
      comunidad_paga_inquilino: contrato.comunidad_paga_inquilino,
      cuota_comunidad: contrato.cuota_comunidad,
    });
    setUploadFile(null);
    setEditing(true);
  }

  // Reset ipcAutoOpened when sheet closes
  if (!open && ipcAutoOpened) {
    setIpcAutoOpened(false);
    setActiveIpcInfo(null);
  }

  const startEditing = () => {
    if (!contrato) return;
    setForm({
      titulo: contrato.titulo,
      property_id: contrato.property_id,
      inquilino_id: contrato.inquilino_id || undefined,
      fecha_inicio: contrato.fecha_inicio,
      fecha_fin: contrato.fecha_fin,
      renta_mensual: contrato.renta_mensual,
      fianza_importe: contrato.fianza_importe,
      deposito_garantia: contrato.deposito_garantia,
      duracion_anos: contrato.duracion_anos,
      prorroga_anos: contrato.prorroga_anos,
      preaviso_meses: contrato.preaviso_meses,
      estado: contrato.estado,
      notas: contrato.notas,
      tiene_inventario: contrato.tiene_inventario,
      renovacion_automatica: contrato.renovacion_automatica,
      agua_paga_inquilino: contrato.agua_paga_inquilino,
      luz_paga_inquilino: contrato.luz_paga_inquilino,
      gas_paga_inquilino: contrato.gas_paga_inquilino,
      internet_paga_inquilino: contrato.internet_paga_inquilino,
      ibi_paga_inquilino: contrato.ibi_paga_inquilino,
      basuras_paga_inquilino: contrato.basuras_paga_inquilino,
      comunidad_paga_inquilino: contrato.comunidad_paga_inquilino,
      cuota_comunidad: contrato.cuota_comunidad,
    });
    setUploadFile(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm({});
    setUploadFile(null);
    setActiveIpcInfo(null);
  };

  const handleSaveClick = () => {
    setShowConfirmDialog(true);
  };

  const handleFirstConfirm = () => {
    setShowConfirmDialog(false);
    setShowNotifyDialog(true);
  };

  const handleConfirmedSave = async () => {
    setShowNotifyDialog(false);
    if (!contrato) return;
    setSaving(true);
    try {
      // If this is an IPC update, use history-tracking save
      if (activeIpcInfo && onUpdateContratoWithHistory) {
        await onUpdateContratoWithHistory(
          contrato,
          { ...form, revisado_por_usuario: true },
          `Actualización IPC: ${activeIpcInfo.percent > 0 ? "+" : ""}${activeIpcInfo.percent}%`,
          `Renta actualizada de ${activeIpcInfo.oldRenta} €/mes a ${activeIpcInfo.newRenta} €/mes (IPC ${activeIpcInfo.percent}%)`,
          `${activeIpcInfo.oldRenta} €/mes`,
          `${activeIpcInfo.newRenta} €/mes`
        );
      } else {
        await onSave(contrato.id, { ...form, revisado_por_usuario: true } as any);
      }
      if (uploadFile) await onUploadArchivo(contrato.id, uploadFile);
      if (form.fecha_fin !== contrato.fecha_fin || form.fecha_inicio !== contrato.fecha_inicio) {
        await onCreateCalendarEvents({ ...contrato, ...form, property_id: form.property_id || contrato.property_id } as Contrato);
      }

      // Notify tenant in portal + via email
      const inqForNotify = contrato.inquilino_id ? inquilinos.find(i => i.id === contrato.inquilino_id) : null;
      if (inqForNotify?.auth_user_id) {
        const prop = properties.find(p => p.id === contrato.property_id);
        const notifMsg = activeIpcInfo
          ? `Se ha actualizado la renta del contrato "${contrato.titulo}" de ${activeIpcInfo.oldRenta} €/mes a ${activeIpcInfo.newRenta} €/mes (IPC ${activeIpcInfo.percent > 0 ? "+" : ""}${activeIpcInfo.percent}%) en el inmueble ${prop?.nombre_interno || prop?.direccion_completa || ""}.`
          : `Se han realizado modificaciones en el contrato "${contrato.titulo}" del inmueble ${prop?.nombre_interno || prop?.direccion_completa || ""}. Revise los cambios en su portal.`;
        await supabase.from("notifications").insert({
          user_id: inqForNotify.auth_user_id,
          tipo: "contrato",
          titulo: activeIpcInfo ? "Actualización de renta por IPC" : "Modificación en su contrato de arrendamiento",
          mensaje: notifMsg,
          referencia_id: contrato.id,
          referencia_tipo: "contrato_modificacion",
        } as any);
      }

      // Send email to tenant if they have email
      if (inqForNotify?.email) {
        const prop = properties.find(p => p.id === contrato.property_id);
        try {
          await supabase.functions.invoke("notify-contrato-change", {
            body: {
              to: inqForNotify.email,
              tenantName: `${inqForNotify.nombre}${inqForNotify.apellidos ? ` ${inqForNotify.apellidos}` : ""}`,
              contractTitle: contrato.titulo,
              propertyName: prop?.nombre_interno || prop?.direccion_completa || "el activo",
            },
          });
        } catch (emailErr) {
          console.error("Error sending contract change email:", emailErr);
        }
      }

      toast({ title: "Contrato actualizado", description: activeIpcInfo ? `Renta actualizada a ${activeIpcInfo.newRenta} €/mes. Se ha notificado al inquilino.` : "Los cambios se han guardado y se ha notificado al inquilino." });
      setEditing(false);
      setForm({});
      setUploadFile(null);
      setActiveIpcInfo(null);
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleIpcApply = () => {
    const pct = parseFloat(ipcPercent);
    if (isNaN(pct) || !contrato?.renta_mensual) return;
    setShowIpc(false);
    setIpcConfirmStep("legal");
  };

  const handleIpcFirstConfirm = () => {
    setIpcConfirmStep("notify");
  };

  const handleIpcConfirmedApply = async () => {
    setIpcConfirmStep("none");
    if (!contrato || !contrato.renta_mensual || !onUpdateContratoWithHistory) return;
    const pct = parseFloat(ipcPercent);
    if (isNaN(pct)) return;
    setIpcApplying(true);
    const oldRenta = contrato.renta_mensual;
    const newRenta = Math.round((oldRenta * (1 + pct / 100)) * 100) / 100;
    await onUpdateContratoWithHistory(
      contrato,
      { renta_mensual: newRenta },
      `Actualización IPC: ${pct > 0 ? "+" : ""}${pct}%`,
      `Renta actualizada de ${oldRenta} €/mes a ${newRenta} €/mes (IPC ${pct}%)`,
      `${oldRenta} €/mes`,
      `${newRenta} €/mes`
    );

    // Create a modification record — NOT auto-marked as comunicado.
    // The portal notification and email are sent below, but the propietario
    // decides which channels to register via the modifications panel.
    await addModificacion({
      contrato_id: contrato.id,
      property_id: contrato.property_id,
      naturaleza: "notificable",
      tipo_cambio: "ipc",
      campo_afectado: "renta_mensual",
      valor_anterior: `${oldRenta} €/mes`,
      valor_nuevo: `${newRenta} €/mes`,
      motivo: `Actualización IPC ${pct > 0 ? "+" : ""}${pct}%`,
      fecha_efectiva: new Date().toISOString().split("T")[0],
    });

    // Notify tenant
    const inq = contrato.inquilino_id ? inquilinos.find(i => i.id === contrato.inquilino_id) : null;
    if (inq?.auth_user_id) {
      const prop = properties.find(p => p.id === contrato.property_id);
      await supabase.from("notifications").insert({
        user_id: inq.auth_user_id,
        tipo: "contrato",
        titulo: "Actualización de renta por IPC",
        mensaje: `Se ha actualizado la renta del contrato "${contrato.titulo}" de ${oldRenta} €/mes a ${newRenta} €/mes (IPC ${pct > 0 ? "+" : ""}${pct}%) en el inmueble ${prop?.nombre_interno || prop?.direccion_completa || ""}.`,
        referencia_id: contrato.id,
        referencia_tipo: "contrato_modificacion",
      } as any);
    }
    if (inq?.email) {
      const prop = properties.find(p => p.id === contrato.property_id);
      try {
        await supabase.functions.invoke("notify-contrato-change", {
          body: {
            to: inq.email,
            tenantName: `${inq.nombre}${inq.apellidos ? ` ${inq.apellidos}` : ""}`,
            contractTitle: contrato.titulo,
            propertyName: prop?.nombre_interno || prop?.direccion_completa || "la vivienda",
          },
        });
      } catch (e) {
        console.error("Error sending IPC email:", e);
      }
    }

    setIpcApplying(false);
    setIpcPercent("2.3");
    toast({ title: "Renta actualizada", description: `Nueva renta: ${newRenta} €/mes (IPC ${pct > 0 ? "+" : ""}${pct}%)` });
  };

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  // Historial de actualizaciones de renta (para mostrar renta inicial vs actual)
  const { actualizaciones: rentaUpdates } = useRentaActualizaciones(contrato?.property_id);

  if (!contrato) return null;

  const c = editing ? { ...contrato, ...form } as Contrato : contrato;
  const prop = properties.find(p => p.id === c.property_id);
  const inq = c.inquilino_id ? inquilinos.find(i => i.id === c.inquilino_id) : null;
  const estado = ESTADO_MAP[c.estado] || ESTADO_MAP.vigente;
  const daysLeft = c.fecha_fin ? Math.ceil((new Date(c.fecha_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const originalDocument = resolveOriginalContractDocument(c);
  const generatedDocument = resolveGeneratedContractDocument(c);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) { cancelEditing(); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <ScrollText size={18} className="text-primary" />
              Ficha del contrato
            </SheetTitle>
            <div className="flex items-center gap-1.5">
              {!editing ? (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={startEditing}>
                  <Pencil size={12} /> Editar
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={cancelEditing} disabled={saving}>
                    <X size={12} className="mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveClick} disabled={saving}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Status bar */}
        <div className={`h-1.5 w-full rounded-full mt-2 ${estado.color}`} />

        {/* IPC update banner */}
        {activeIpcInfo && editing && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Renta {activeIpcInfo.percent > 0 ? "aumentada" : "reducida"} un {Math.abs(activeIpcInfo.percent)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {activeIpcInfo.oldRenta} €/mes → <strong className="text-foreground">{activeIpcInfo.newRenta} €/mes</strong>
                <span className="ml-1.5 text-emerald-600 font-medium">
                  ({activeIpcInfo.percent > 0 ? "+" : ""}{(activeIpcInfo.newRenta - activeIpcInfo.oldRenta).toFixed(2)} €)
                </span>
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] shrink-0">
              IPC {activeIpcInfo.percent > 0 ? "+" : ""}{activeIpcInfo.percent}%
            </Badge>
          </div>
        )}

        <div className="space-y-5 mt-4">
          {/* === SECCIÓN: Título y estado === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ScrollText size={12} /> Datos del contrato
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  {editing ? (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Título</Label>
                      <Input value={form.titulo || ""} onChange={(e) => update("titulo", e.target.value)} className="h-8 text-xs mt-0.5" />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Título</Label>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{c.titulo}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Estado</Label>
                  {editing ? (
                    <Select value={form.estado || "vigente"} onValueChange={(v) => update("estado", v)}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vigente">Vigente</SelectItem>
                        <SelectItem value="finalizado">Finalizado</SelectItem>
                        <SelectItem value="renovado">Renovado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1">
                      <Badge variant={c.estado === "vigente" ? "default" : c.estado === "finalizado" ? "secondary" : "outline"}>
                        {estado.label}
                      </Badge>
                      {daysLeft !== null && daysLeft > 0 && daysLeft <= 90 && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] border-amber-500/50 text-amber-600">
                          ⚠ {daysLeft} días
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Creado</Label>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(c.created_at)}</p>
                </div>
              </div>

              {/* Renovación automática e Inventario */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <RefreshCw size={12} className="text-muted-foreground" />
                    Renovación auto.
                  </div>
                  {editing ? (
                    <Switch checked={!!form.renovacion_automatica} onCheckedChange={(v) => update("renovacion_automatica", v)} />
                  ) : (
                    <Badge variant={c.renovacion_automatica ? "default" : "secondary"} className="text-[10px]">
                      {c.renovacion_automatica ? "Sí" : "No"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <ClipboardList size={12} className="text-muted-foreground" />
                    Inventario anexo
                  </div>
                  {editing ? (
                    <Switch checked={!!form.tiene_inventario} onCheckedChange={(v) => update("tiene_inventario", v)} />
                  ) : (
                    <Badge variant={c.tiene_inventario ? "default" : "secondary"} className="text-[10px]">
                      {c.tiene_inventario ? "Sí" : "No"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Inventory helper when toggling on */}
              {editing && !!form.tiene_inventario && !contrato?.tiene_inventario && (
                <p className="text-[11px] text-muted-foreground pt-1 px-1">
                  Al guardar, se marcará el contrato como "con inventario anexo". Podrás generar el PDF del inventario desde <strong>Documentación → Inventario</strong> o desde el generador de contratos.
                </p>
              )}
            </div>
          </section>

          {/* === SECCIÓN: Vivienda === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Home size={12} /> Vivienda
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              {editing ? (
                <div>
                  <Label className="text-[11px] text-muted-foreground">Activo</Label>
                  <Select value={form.property_id || ""} onValueChange={(v) => update("property_id", v)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{prop?.nombre_interno || "—"}</p>
                    {prop?.direccion_completa && <p className="text-xs text-muted-foreground">{prop.direccion_completa}</p>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* === SECCIÓN: Inquilino === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User size={12} /> Inquilino
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              {editing ? (
                <div>
                  <Label className="text-[11px] text-muted-foreground">Inquilino</Label>
                  <Select value={form.inquilino_id || "none"} onValueChange={(v) => update("inquilino_id", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {inquilinos.map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nombre}{i.apellidos ? ` ${i.apellidos}` : ""} {i.dni ? `(${i.dni})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : inq ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{inq.nombre}{inq.apellidos ? ` ${inq.apellidos}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {inq.dni && <p>DNI: <span className="text-foreground font-medium">{inq.dni}</span></p>}
                    {inq.email && <p>Email: <span className="text-foreground font-medium">{inq.email}</span></p>}
                    {inq.telefono && <p>Teléfono: <span className="text-foreground font-medium">{inq.telefono}</span></p>}
                    {inq.renta_mensual && <p>Renta inicial: <span className="text-foreground font-medium">{inq.renta_mensual} €</span></p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin asignar</p>
              )}
            </div>
          </section>

          {/* === SECCIÓN: Personas vinculadas === */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Users size={12} /> Personas del contrato
                {personas.length > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground normal-case">({personas.length})</span>
                )}
              </h3>
              {!addingPersona && (
                <button
                  type="button"
                  onClick={() => setAddingPersona(true)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Plus size={11} /> Añadir persona
                </button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              {(c.documento_original_url || (c as any).documento_original_path) && (
                <div className="flex items-center gap-2 text-[11px] text-primary mb-1">
                  <Paperclip size={11} />
                  <SecureFileLink
                    bucket="contratos"
                    path={(c as any).documento_original_path}
                    fallbackUrl={c.documento_original_url}
                    className="hover:underline text-left"
                  >
                    Contrato adjunto · {c.documento_original_nombre || "ver archivo"}
                  </SecureFileLink>
                </div>
              )}
              {personas.length === 0 && !addingPersona && (
                <p className="text-xs text-muted-foreground">
                  Solo el inquilino principal. Puedes añadir cotitulares, ocupantes o avalistas.
                </p>
              )}
              {(() => {
                const v = validarPorcentajesFiscales(personas as any);
                if (v.status === "ok" || v.status === "sin_arrendadores" || !v.mensaje) return null;
                const tone = v.status === "sin_datos"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-rose-50 border-rose-200 text-rose-800";
                return (
                  <div className={`flex items-start gap-2 rounded-md border p-2 text-[11px] ${tone}`}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{v.mensaje}</span>
                  </div>
                );
              })()}
              {personas.map((p, idx) => {
                const move = async (dir: -1 | 1) => {
                  const newOrder = [...personas];
                  const j = idx + dir;
                  if (j < 0 || j >= newOrder.length) return;
                  [newOrder[idx], newOrder[j]] = [newOrder[j], newOrder[idx]];
                  await reorderPersonas(newOrder.map(x => x.id));
                };
                return (
                <div key={p.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-2">
                  {personas.length > 1 && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button type="button" disabled={idx === 0} onClick={() => move(-1)} aria-label="Subir" title="Subir" className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronUp size={13} />
                      </button>
                      <button type="button" disabled={idx === personas.length - 1} onClick={() => move(1)} aria-label="Bajar" title="Bajar" className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.nombre}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{ROL_LABEL[p.rol as ContratoPersonaRol]}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-x-2">
                      {p.dni && <span>{p.dni}</span>}
                      {p.telefono && <span>· {p.telefono}</span>}
                      {p.email && <span>· {p.email}</span>}
                    </div>
                    {(p.parte === "arrendadora" || parteFromRol(p.rol as any) === "arrendadora") && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <label className="flex items-center gap-1 text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={!!p.afecta_fiscalidad}
                            onChange={(e) => updatePersona(p.id, { afecta_fiscalidad: e.target.checked })}
                            className="h-3 w-3"
                          />
                          Declara fiscalmente
                        </label>
                        {p.afecta_fiscalidad && (
                          <label className="flex items-center gap-1 text-muted-foreground">
                            % fiscal
                            <Input
                              type="number"
                              defaultValue={p.porcentaje_fiscal ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : Number(e.target.value);
                                if (v !== (p.porcentaje_fiscal ?? null)) updatePersona(p.id, { porcentaje_fiscal: v as any });
                              }}
                              placeholder="100"
                              className="h-6 w-16 text-[11px] px-1"
                              min={0} max={100}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  {p.rol !== "titular_principal" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deletePersona(p.id);
                        if (contrato && user) {
                          await supabase.from("contrato_historial").insert({
                            user_id: user.id,
                            contrato_id: contrato.id,
                            property_id: contrato.property_id,
                            tipo: "persona_eliminada",
                            titulo: `${ROL_LABEL[p.rol as ContratoPersonaRol]} eliminado`,
                            detalle: p.nombre,
                          } as any);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Quitar"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                );
              })}

              {addingPersona && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Select value={newPersona.rol} onValueChange={(v) => setNewPersona(p => ({ ...p, rol: v as typeof p.rol }))}>
                      <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arrendador">Arrendador</SelectItem>
                        <SelectItem value="coarrendador">Coarrendador</SelectItem>
                        <SelectItem value="subarrendador">Subarrendador</SelectItem>
                        <SelectItem value="arrendatario">Arrendatario</SelectItem>
                        <SelectItem value="coarrendatario">Coarrendatario</SelectItem>
                        <SelectItem value="subarrendatario">Subarrendatario</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="avalista">Avalista</SelectItem>
                        <SelectItem value="contacto_autorizado">Contacto autorizado</SelectItem>
                        <SelectItem value="cotitular">Cotitular (legado)</SelectItem>
                        <SelectItem value="ocupante">Ocupante (legado)</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => { setAddingPersona(false); setNewPersona({ nombre:"", dni:"", telefono:"", email:"", rol:"cotitular" }); }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <Input value={newPersona.nombre} onChange={e => setNewPersona(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre y apellidos" className="h-8 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newPersona.dni} onChange={e => setNewPersona(p => ({ ...p, dni: e.target.value }))} placeholder="DNI / NIE" className="h-8 text-xs" />
                    <Input value={newPersona.telefono} onChange={e => setNewPersona(p => ({ ...p, telefono: e.target.value }))} placeholder="Teléfono" className="h-8 text-xs" />
                  </div>
                  <Input type="email" value={newPersona.email} onChange={e => setNewPersona(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="h-8 text-xs" />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setAddingPersona(false); setNewPersona({ nombre:"", dni:"", telefono:"", email:"", rol:"cotitular" }); }}
                      className="h-7 text-xs"
                    >Cancelar</Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!newPersona.nombre.trim() || !contrato || !user) return;
                        await createPersona({
                          contrato_id: contrato.id,
                          property_id: contrato.property_id,
                          inquilino_id: null,
                          rol: newPersona.rol,
                          nombre: newPersona.nombre.trim(),
                          dni: newPersona.dni.trim() || null,
                          telefono: newPersona.telefono.trim() || null,
                          email: newPersona.email.trim() || null,
                        });
                        await supabase.from("contrato_historial").insert({
                          user_id: user.id,
                          contrato_id: contrato.id,
                          property_id: contrato.property_id,
                          tipo: "persona_anadida",
                          titulo: `${ROL_LABEL[newPersona.rol]} añadido`,
                          detalle: `${newPersona.nombre.trim()}${newPersona.dni ? ` · ${newPersona.dni}` : ""}`,
                        } as any);
                        setAddingPersona(false);
                        setNewPersona({ nombre:"", dni:"", telefono:"", email:"", rol:"cotitular" });
                      }}
                      disabled={!newPersona.nombre.trim()}
                      className="h-7 text-xs"
                    >Guardar</Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* === SECCIÓN: Período y duración === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays size={12} /> Período y duración
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha inicio" value={editing ? form.fecha_inicio : c.fecha_inicio} editing={editing} type="date"
                  onChange={(v) => update("fecha_inicio", v)} />
                <Field label="Fecha fin" value={editing ? form.fecha_fin : c.fecha_fin} editing={editing} type="date"
                  onChange={(v) => update("fecha_fin", v)} />
                <Field label="Duración inicial (años)" value={editing ? form.duracion_anos : c.duracion_anos} editing={editing} type="number" placeholder="5"
                  onChange={(v) => update("duracion_anos", v ? Number(v) : null)} />
                <Field label="Prórroga (años)" value={editing ? form.prorroga_anos : c.prorroga_anos} editing={editing} type="number" placeholder="3"
                  onChange={(v) => update("prorroga_anos", v ? Number(v) : null)} />
                <Field label="Preaviso (meses)" value={editing ? form.preaviso_meses : c.preaviso_meses} editing={editing} type="number" placeholder="2"
                  onChange={(v) => update("preaviso_meses", v ? Number(v) : null)} />
              </div>
              {!editing && c.fecha_inicio && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.fecha_inicio)} → {c.fecha_fin ? formatDate(c.fecha_fin) : "Sin fecha fin"}
                    {c.duracion_anos ? ` · ${c.duracion_anos} año${c.duracion_anos > 1 ? "s" : ""} inicial` : ""}
                    {c.prorroga_anos ? ` + ${c.prorroga_anos}a prórroga` : ""}
                  </p>
                </div>
              )}
            </div>

            {/* === Timeline de fechas clave === */}
            {!editing && c.fecha_fin && c.estado !== "finalizado" && !c.archivado && (() => {
              const tl = getContratoTimeline(c);
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Clock size={11} className="text-primary" /> Próximas fechas clave
                  </p>
                  <div className="space-y-2">
                    {/* Internal alert */}
                    {tl.fechaAvisoInterno && (
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tl.fechaAvisoInterno <= today ? "bg-orange-500/15" : "bg-muted"}`}>
                          <Bell size={12} className={tl.fechaAvisoInterno <= today ? "text-orange-600" : "text-muted-foreground"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">Aviso interno de la app</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateEs(tl.fechaAvisoInterno)}
                            {tl.fechaAvisoInterno <= today
                              ? <span className="ml-1 text-orange-600 font-medium">· Activo</span>
                              : <span className="ml-1">· en {daysBetween(today, tl.fechaAvisoInterno)} días</span>}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Preaviso deadline */}
                    {tl.fechaLimitePreaviso && (
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tl.fechaLimitePreaviso <= today ? "bg-red-500/15" : "bg-muted"}`}>
                          <Mail size={12} className={tl.fechaLimitePreaviso <= today ? "text-red-600" : "text-muted-foreground"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">Fecha límite preaviso</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateEs(tl.fechaLimitePreaviso)}
                            {tl.fechaLimitePreaviso <= today
                              ? <span className="ml-1 text-red-600 font-medium">· Plazo vencido</span>
                              : <span className="ml-1">· en {daysBetween(today, tl.fechaLimitePreaviso)} días</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Último día para comunicar no renovación al inquilino</p>
                        </div>
                      </div>
                    )}
                    {/* Renewal/end date */}
                    {tl.fechaFinEfectiva && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-muted">
                          <Calendar size={12} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {tl.isProrrogado ? "Próxima renovación automática" : "Fin del contrato"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateEs(tl.fechaFinEfectiva)}
                            <span className="ml-1">· en {daysBetween(today, tl.fechaFinEfectiva)} días</span>
                          </p>
                          {tl.isProrrogado && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Prorrogado automáticamente según LAU</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>

          {/* === SECCIÓN: Condiciones económicas === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Euro size={12} /> Condiciones económicas
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Renta vigente</Label>
                  {editing ? (
                    <Input type="number" value={form.renta_mensual ?? ""} onChange={(e) => update("renta_mensual", e.target.value ? Number(e.target.value) : null)} className="h-8 text-xs mt-0.5" />
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5 min-h-[28px]">
                      <p className="text-sm font-medium text-foreground">{c.renta_mensual != null ? `${c.renta_mensual} €/mes` : "—"}</p>
                      {c.renta_mensual != null && c.estado !== "finalizado" && !c.archivado && onUpdateContratoWithHistory && (
                        <Popover open={showIpc} onOpenChange={(open) => { setShowIpc(open); if (open) setIpcPercent("2.3"); }}>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-emerald-700 text-[10px] font-medium" title="Actualizar renta por IPC (BOE)">
                              <TrendingUp size={10} />
                              IPC
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-4" align="start">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp size={16} className="text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">Actualizar renta por IPC</p>
                                <p className="text-[11px] text-muted-foreground">Según publicación del BOE</p>
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2.5 mb-3">
                              <p className="text-[11px] text-muted-foreground">
                                Renta actual: <strong className="text-foreground">{c.renta_mensual} €/mes</strong>
                              </p>
                            </div>
                            <Label className="text-xs mb-1.5 block">Porcentaje IPC (%)</Label>
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-2">
                              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                📋 <strong>Referencia BOE:</strong> 2,3% (último dato publicado). Puede modificar este valor según la cláusula de su contrato.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <Input type="number" step="0.1" value={ipcPercent} onChange={(e) => setIpcPercent(e.target.value)} className="h-9 text-sm pr-7" placeholder="2.3" />
                                <Percent size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-3">
                              Consulta el IPC vigente en el <a href="https://www.ine.es/varipc/" target="_blank" rel="noopener noreferrer" className="text-primary underline">INE</a>
                            </p>
                            {ipcPercent && !isNaN(parseFloat(ipcPercent)) && (
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 mb-3">
                                <p className="text-xs text-foreground">
                                  Nueva renta: <strong>
                                    {Math.round((c.renta_mensual! * (1 + parseFloat(ipcPercent) / 100)) * 100) / 100} €/mes
                                  </strong>
                                  <span className="ml-1.5 text-emerald-600 font-medium">({parseFloat(ipcPercent) > 0 ? "+" : ""}{parseFloat(ipcPercent)}%)</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Diferencia: {parseFloat(ipcPercent) > 0 ? "+" : ""}{Math.round((c.renta_mensual! * parseFloat(ipcPercent) / 100) * 100) / 100} €/mes
                                </p>
                              </div>
                            )}
                            <Button size="sm" className="w-full" disabled={ipcApplying || !ipcPercent} onClick={handleIpcApply}>
                              {ipcApplying ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <TrendingUp size={14} className="mr-1.5" />}
                              Aplicar actualización
                            </Button>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}
                </div>
                <Field label="Fianza (según contrato)" value={editing ? form.fianza_importe : c.fianza_importe} editing={editing} type="number"
                  suffix={!editing ? " €" : undefined} placeholder="0" onChange={(v) => update("fianza_importe", v ? Number(v) : null)} />
                <Field label="Depósito de garantía" value={editing ? form.deposito_garantia : c.deposito_garantia} editing={editing} type="number"
                  suffix={!editing ? " €" : undefined} placeholder="0" onChange={(v) => update("deposito_garantia", v ? Number(v) : null)} />
                <Field label="Cuota comunidad" value={editing ? form.cuota_comunidad : c.cuota_comunidad} editing={editing} type="number"
                  suffix={!editing ? " €/mes" : undefined} placeholder="0" onChange={(v) => update("cuota_comunidad", v ? Number(v) : null)} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
                <Shield size={11} className="shrink-0 mt-0.5 text-muted-foreground" />
                La fianza es una garantía depositada en el organismo público. <strong>No forma parte de la deuda de renta</strong> ni se descuenta de cobros mensuales.
              </p>
            </div>

            {/* Renta inicial vs Renta actual + historial de actualizaciones */}
            {(() => {
              const updatesForContrato = rentaUpdates.filter(
                (u) => !u.contrato_id || u.contrato_id === c.id
              );
              const ordered = [...updatesForContrato].sort(
                (a, b) => new Date(a.fecha_efectiva).getTime() - new Date(b.fecha_efectiva).getTime()
              );
              const first = ordered[0];
              const last = ordered[ordered.length - 1];
              const rentaInicial =
                first && first.importe_anterior != null
                  ? Number(first.importe_anterior)
                  : c.renta_mensual ?? null;
              const rentaActual = c.renta_mensual ?? null;
              const desdeCuando = last?.fecha_efectiva ?? null;
              const haySubidas = ordered.length > 0;
              const difieren = haySubidas && rentaInicial != null && rentaActual != null && Number(rentaInicial) !== Number(rentaActual);

              return (
                <div className="rounded-xl border border-border bg-card p-3 space-y-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    <HistoryIcon size={12} className="text-muted-foreground" />
                    <h4 className="text-xs font-semibold text-foreground">Evolución de la renta</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Renta inicial</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {rentaInicial != null ? `${Number(rentaInicial).toLocaleString("es-ES")} €/mes` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Al firmar el contrato</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-primary/80">Renta vigente</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {rentaActual != null ? `${Number(rentaActual).toLocaleString("es-ES")} €/mes` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Aplicable hoy</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha efecto</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {desdeCuando ? formatDateEs(new Date(desdeCuando)) : (difieren ? "Sin fecha conocida" : "Desde el inicio")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {haySubidas ? `${ordered.length} actualización${ordered.length === 1 ? "" : "es"} registrada${ordered.length === 1 ? "" : "s"}` : "Sin actualizaciones"}
                      </p>
                    </div>
                  </div>

                  {difieren && (
                    <div className="flex gap-2 text-[11px] bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/50 rounded-md p-2">
                      <Info size={12} className="text-sky-600 shrink-0 mt-0.5" />
                      <p className="text-sky-800 dark:text-sky-200">
                        La renta histórica se calcula <strong>por tramos</strong>: cada mes se valora con la renta vigente en su fecha. <strong>No se genera deuda retroactiva automática</strong> al cambiar la renta actual.
                      </p>
                    </div>
                  )}

                  {ordered.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Historial de actualizaciones</p>
                      <ol className="space-y-1.5">
                        {ordered.slice().reverse().map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between gap-2 text-xs bg-muted/20 rounded-md px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar size={11} className="text-muted-foreground shrink-0" />
                              <span className="text-foreground">{formatDateEs(new Date(u.fecha_efectiva))}</span>
                              {u.motivo && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                                  {u.motivo}
                                </span>
                              )}
                            </div>
                            <div className="text-xs whitespace-nowrap">
                              {u.importe_anterior != null && (
                                <span className="text-muted-foreground line-through mr-1.5">
                                  {Number(u.importe_anterior).toLocaleString("es-ES")} €
                                </span>
                              )}
                              <span className="text-emerald-600 font-medium">
                                {Number(u.importe_nuevo).toLocaleString("es-ES")} €
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="flex gap-2 text-[11px] text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-md p-2">
                    <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-800 dark:text-amber-200">
                      Cambiar la renta actual <strong>no modifica</strong> automáticamente la fianza, las garantías ni la fecha de inicio del contrato. Estos datos se mantienen tal como se firmaron originalmente.
                    </p>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* === SECCIÓN: Suministros === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <PackageCheck size={12} /> Suministros — ¿Quién paga?
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
              <TriStateField label="Agua" icon={<Droplets size={12} className="text-blue-500" />}
                value={c.agua_paga_inquilino ? "inquilino" : (properties.find(p => p.id === c.property_id)?.agua_incluida_comunidad ? "comunidad" : "propietario")}
                editing={editing}
                onChange={(v) => {
                  update("agua_paga_inquilino", v === "inquilino");
                }} />
              <TriStateField label="Luz" icon={<Zap size={12} className="text-yellow-500" />}
                value={c.luz_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("luz_paga_inquilino", v === "inquilino")} />
              <TriStateField label="Gas" icon={<Flame size={12} className="text-orange-500" />}
                value={c.gas_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("gas_paga_inquilino", v === "inquilino")} />
              <TriStateField label="Internet" icon={<Wifi size={12} className="text-indigo-500" />}
                value={c.internet_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("internet_paga_inquilino", v === "inquilino")} />
              <TriStateField label="IBI" icon={<Receipt size={12} className="text-emerald-600" />}
                value={c.ibi_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("ibi_paga_inquilino", v === "inquilino")} />
              <TriStateField label="Basuras" icon={<Trash2 size={12} className="text-stone-500" />}
                value={c.basuras_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("basuras_paga_inquilino", v === "inquilino")} />
              <TriStateField label="Comunidad" icon={<Building2 size={12} className="text-violet-500" />}
                value={c.comunidad_paga_inquilino ? "inquilino" : "propietario"}
                editing={editing}
                onChange={(v) => update("comunidad_paga_inquilino", v === "inquilino")} />
            </div>
          </section>

          {/* === SECCIÓN: Modificaciones === */}
          {!editing && contrato && (
            <ContratoModificacionesPanel
              modificaciones={modificaciones}
              loading={loadingMods}
              contratoId={contrato.id}
              propertyId={contrato.property_id}
              onAdd={addModificacion}
              onAddComunicacion={addComunicacion}
              onMarkConfirmado={markConfirmado}
            />
          )}

          {/* === SECCIÓN: Historial del contrato + Regularizar === */}
          {!editing && contrato && (
            <section className="space-y-3 rounded-xl border border-border bg-muted/10 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h3>
                <Button
                  size="sm"
                  variant={contrato.estado === "pendiente_regularizacion" ? "default" : "outline"}
                  onClick={() => setRegularizarOpen(true)}
                >
                  <HistoryIcon size={14} className="mr-1" />
                  Regularizar histórico
                </Button>
              </div>
              <HistorialContratoSection contrato={contrato} />
            </section>
          )}

          {/* === SECCIÓN: Histórico económico === */}
          {!editing && contrato && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico económico</h3>
              <HistoricoEconomicoSection contrato={contrato} />
            </section>
          )}

          {/* === SECCIÓN: Fianza y garantías (separadas de la renta) === */}
          {!editing && contrato && (
            <FianzaGarantiasSection contrato={contrato} />
          )}

          {/* === SECCIÓN: Notas / Cláusulas === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas y cláusulas</h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              {editing ? (
                <Textarea value={form.notas || ""} onChange={(e) => update("notas", e.target.value)} rows={4} className="text-xs" placeholder="Cláusulas especiales, observaciones…" />
              ) : (
                <p className="text-xs text-foreground whitespace-pre-line">{c.notas || "Sin notas."}</p>
              )}
            </div>
          </section>

           {/* === SECCIÓN: Documento original (PDF subido por el usuario) === */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={12} /> Documento original
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              {originalDocument ? (
                <button
                  onClick={async () => {
                    const opened = await openContractDocumentFromRef(originalDocument);
                    if (!opened) {
                      toast({ title: "Error", description: "No se pudo abrir el documento.", variant: "destructive" });
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-foreground">{originalDocument.fileName || "Documento original"}</p>
                    <p className="text-xs text-muted-foreground">Pulsa para abrir el PDF original</p>
                  </div>
                  <ExternalLink size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center py-1">No se ha subido el documento original</p>
                  <input ref={originalFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !onUploadDocumentoOriginal) return;
                      setUploadingOriginal(true);
                      await onUploadDocumentoOriginal(c.id, f);
                      setUploadingOriginal(false);
                      e.target.value = "";
                    }} />
                  {onUploadDocumentoOriginal && (
                    <Button variant="outline" size="sm" className="w-full h-9 text-xs gap-1.5 font-semibold" onClick={() => originalFileRef.current?.click()} disabled={uploadingOriginal}>
                      {uploadingOriginal ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Subir documento original (PDF)
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* === SECCIÓN: Contrato generado === */}
          {generatedDocument && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ScrollText size={12} /> Contrato generado
              </h3>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <button
                  onClick={async () => {
                    const opened = await openContractDocumentFromRef(generatedDocument);
                    if (!opened) {
                      toast({ title: "Error", description: "No se pudo abrir el documento.", variant: "destructive" });
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ScrollText size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-foreground">{c.archivo_nombre || "Contrato generado"}</p>
                    <p className="text-xs text-muted-foreground">Pulsa para ver el contrato generado</p>
                  </div>
                  <ExternalLink size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
                {editing && (
                  <div className="mt-3">
                    <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.odt,.pages,.md"
                      onChange={(e) => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
                      <Upload size={12} /> {uploadFile ? uploadFile.name : "Reemplazar documento generado"}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Sticky save button at bottom when editing */}
        {editing && (
          <div className="sticky bottom-0 left-0 right-0 pt-3 pb-2 mt-4 border-t border-border bg-background">
            <Button className="w-full gap-2" onClick={handleSaveClick} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando…" : activeIpcInfo ? "Guardar actualización de renta" : "Guardar cambios"}
            </Button>
          </div>
        )}
      </SheetContent>

      {/* Step 1: Legal confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Confirmar modificación del contrato
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-3">
              <span className="block">
                Conforme a la legislación vigente en materia de arrendamientos urbanos, cualquier modificación, ampliación o incorporación de anexos a un contrato de arrendamiento deberá ser acordada de forma consensuada por todas las partes firmantes.
              </span>
              <span className="block font-medium text-foreground">
                Las alteraciones unilaterales del contrato carecen de validez legal y podrían derivar en la nulidad de las cláusulas modificadas.
              </span>
              <span className="block text-muted-foreground text-xs">
                Al continuar, confirmas que los cambios realizados han sido debidamente comunicados y aceptados por todas las partes implicadas en el contrato.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              Sí, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: Notification warning dialog */}
      <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send size={18} className="text-primary" />
              Notificación al inquilino
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-3">
              <span className="block">
                Al confirmar, se notificará automáticamente al inquilino de las modificaciones realizadas a través de los siguientes canales:
              </span>
              <span className="block">
                <span className="flex items-center gap-2 mt-2 text-foreground font-medium">
                  <Mail size={14} className="text-primary shrink-0" /> Correo electrónico al inquilino
                </span>
                <span className="flex items-center gap-2 mt-1.5 text-foreground font-medium">
                  <FileText size={14} className="text-primary shrink-0" /> Notificación en su portal de inquilino
                </span>
              </span>
              <span className="block font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs leading-relaxed">
                ⚠️ <strong>Importante:</strong> La notificación digital no sustituye la comunicación fehaciente exigida por ley. Es responsabilidad del arrendador notificar formalmente al inquilino mediante <strong>correo postal certificado</strong> o <strong>burofax</strong> cualquier modificación contractual, a efectos de garantizar su validez probatoria.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSave} disabled={saving}>
              {saving ? "Guardando…" : "Confirmar, guardar y notificar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* IPC Step 1: Legal */}
      <AlertDialog open={ipcConfirmStep === "legal"} onOpenChange={(open) => { if (!open) setIpcConfirmStep("none"); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Confirmar actualización de renta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-3">
              <span className="block">
                Conforme a la legislación vigente en materia de arrendamientos urbanos, cualquier modificación, ampliación o incorporación de anexos a un contrato de arrendamiento deberá ser acordada de forma consensuada por todas las partes firmantes.
              </span>
              <span className="block font-medium text-foreground">
                Las alteraciones unilaterales del contrato carecen de validez legal y podrían derivar en la nulidad de las cláusulas modificadas.
              </span>
              <span className="block text-muted-foreground text-xs">
                Al continuar, confirmas que la actualización de renta por IPC ha sido debidamente comunicada y aceptada por todas las partes implicadas en el contrato.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleIpcFirstConfirm}>Sí, continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* IPC Step 2: Notification */}
      <AlertDialog open={ipcConfirmStep === "notify"} onOpenChange={(open) => { if (!open) setIpcConfirmStep("none"); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send size={18} className="text-primary" />
              Notificación al inquilino
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-3">
              <span className="block">
                Al confirmar, se notificará automáticamente al inquilino de la actualización de renta a través de los siguientes canales:
              </span>
              <span className="block">
                <span className="flex items-center gap-2 mt-2 text-foreground font-medium">
                  <Mail size={14} className="text-primary shrink-0" /> Correo electrónico al inquilino
                </span>
                <span className="flex items-center gap-2 mt-1.5 text-foreground font-medium">
                  <FileText size={14} className="text-primary shrink-0" /> Notificación en su portal de inquilino
                </span>
              </span>
              <span className="block font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs leading-relaxed">
                ⚠️ <strong>Importante:</strong> La notificación digital no sustituye la comunicación fehaciente exigida por ley. Es responsabilidad del arrendador notificar formalmente al inquilino mediante <strong>correo postal certificado</strong> o <strong>burofax</strong> cualquier modificación contractual, a efectos de garantizar su validez probatoria.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleIpcConfirmedApply} disabled={ipcApplying}>
              {ipcApplying ? "Aplicando…" : "Confirmar, aplicar y notificar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {contrato && (
        <RegularizarHistoricoDialog
          contrato={contrato}
          open={regularizarOpen}
          onOpenChange={setRegularizarOpen}
        />
      )}
    </Sheet>
  );
};

export default ContratoDetailSheet;
