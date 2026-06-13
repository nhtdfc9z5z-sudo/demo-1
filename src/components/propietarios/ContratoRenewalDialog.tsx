import { useState, useRef } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsappUtils";
import { TrendingUp, FileText, XCircle, Send, Printer, Mail, MessageSquare, Loader2, ArrowLeft, Clock, CheckCircle2, AlertTriangle, Copy, Download } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Contrato } from "@/hooks/useContratos";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface ContratoRenewalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: Contrato | null;
  property: Property | null;
  inquilino: Inquilino | null;
  profile: { nombre?: string | null; apellidos?: string | null; nif?: string | null; email?: string | null; telefono?: string | null } | null;
  onIpcApplied?: (contratoId: string, newRenta: number, pct: number) => Promise<void>;
  onNavigateToNewContract?: (data: { propertyId: string; inquilinoId?: string; renta?: string; fianza?: string; duracion?: string }) => void;
  onCreateReminder?: (fecha: string, titulo: string, descripcion: string, propertyId: string) => Promise<void>;
}

type Step = "options" | "ipc" | "ipc_letter" | "new_contract" | "no_renew" | "no_renew_questionnaire" | "no_renew_letter" | "devolucion_questionnaire" | "resolved_survey" | "remind_later";

interface ExtraData {
  propietario_domicilio?: string;
  fecha_efectiva?: string;
  fecha_entrega?: string;
  motivo_no_renovacion?: string;
}

const ContratoRenewalDialog = ({
  open, onOpenChange, contrato, property, inquilino, profile,
  onIpcApplied, onNavigateToNewContract, onCreateReminder,
}: ContratoRenewalDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("options");
  const [ipcPercent, setIpcPercent] = useState("2.3");
  const [generatedText, setGeneratedText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [ipcApplying, setIpcApplying] = useState(false);
  const [ipcConfirmStep, setIpcConfirmStep] = useState<"none" | "legal" | "notify">("none");
  const [remindDays, setRemindDays] = useState("30");
  const [resolvedAction, setResolvedAction] = useState<string>("");
  const [resolvedNotes, setResolvedNotes] = useState("");
  const [extraData, setExtraData] = useState<ExtraData>({ fecha_entrega: contrato?.fecha_fin || "" });
  const textRef = useRef<HTMLTextAreaElement>(null);

  const resetState = () => {
    setStep("options");
    setGeneratedText("");
    setGenerating(false);
    setIpcApplying(false);
    setIpcConfirmStep("none");
    setResolvedAction("");
    setResolvedNotes("");
    setExtraData({ fecha_entrega: contrato?.fecha_fin || "" });
  };

  // Detect missing data for questionnaires
  const missingPropietarioDomicilio = !property?.direccion_completa || !profile?.nombre;
  const missingInquilinoData = !inquilino?.nombre;
  const missingContratoFechaFin = !contrato?.fecha_fin;

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const rentaActual = contrato?.renta_mensual || 0;
  const pct = parseFloat(ipcPercent) || 0;
  const nuevaRenta = Math.round((rentaActual * (1 + pct / 100)) * 100) / 100;
  const diferencia = Math.round((nuevaRenta - rentaActual) * 100) / 100;

  const generateComunicacion = async (tipo: "ipc" | "no_renovacion" | "devolucion_llaves", overrideExtra?: ExtraData) => {
    if (!contrato) return;
    setGenerating(true);
    const extra = overrideExtra || extraData;
    try {
      const body: any = {
        tipo,
        datos: {
          contrato: {
            titulo: contrato.titulo,
            fecha_inicio: contrato.fecha_inicio,
            fecha_fin: contrato.fecha_fin,
            renta_mensual: contrato.renta_mensual,
            duracion_anos: contrato.duracion_anos,
            prorroga_anos: contrato.prorroga_anos,
            preaviso_meses: contrato.preaviso_meses,
            fianza_importe: contrato.fianza_importe,
            deposito_garantia: contrato.deposito_garantia,
          },
          vivienda: property ? {
            nombre_interno: property.nombre_interno,
            direccion_completa: property.direccion_completa,
            ciudad: property.ciudad,
            provincia: property.provincia,
            codigo_postal: property.codigo_postal,
            referencia_catastral: property.referencia_catastral,
          } : null,
          inquilino: inquilino ? {
            nombre: inquilino.nombre,
            apellidos: inquilino.apellidos,
            dni: inquilino.dni,
            email: inquilino.email,
            telefono: inquilino.telefono,
          } : null,
          propietario: profile ? {
            nombre: profile.nombre,
            apellidos: profile.apellidos,
            nif: profile.nif,
            email: profile.email,
            telefono: profile.telefono,
            domicilio: extra.propietario_domicilio || "",
          } : null,
        },
      };

      if (tipo === "ipc") {
        body.datos.renta_actual = rentaActual;
        body.datos.ipc_porcentaje = pct;
        body.datos.nueva_renta = nuevaRenta;
        body.datos.fecha_efectiva = extra.fecha_efectiva || "";
      }

      if (tipo === "no_renovacion") {
        body.datos.motivo_no_renovacion = extra.motivo_no_renovacion || "";
      }

      if (tipo === "devolucion_llaves") {
        body.datos.fecha_entrega = extra.fecha_entrega || "";
      }

      const { data, error } = await supabase.functions.invoke("generate-comunicacion-contrato", { body });
      if (error) throw error;
      setGeneratedText(data.texto || "");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo generar la comunicación.", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleIpcApply = async () => {
    if (!contrato || !onIpcApplied) return;
    // Show confirmation dialog first
    setIpcConfirmStep("legal");
  };

  const handleIpcFirstConfirm = () => {
    setIpcConfirmStep("notify");
  };

  const handleIpcConfirmedApply = async () => {
    setIpcConfirmStep("none");
    if (!contrato || !onIpcApplied) return;
    setIpcApplying(true);
    await onIpcApplied(contrato.id, nuevaRenta, pct);
    setIpcApplying(false);
    // Generate the letter
    await generateComunicacion("ipc");
    setStep("ipc_letter");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    toast({ title: "Copiado", description: "Texto copiado al portapapeles." });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Comunicación</title>
      <style>body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.7; font-size: 14px; white-space: pre-wrap; }</style>
      </head><body>${generatedText.replace(/\n/g, "<br>")}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleWhatsApp = () => {
    const phone = inquilino?.telefono || "";
    window.open(buildWhatsAppUrl(phone, generatedText), "_blank");
  };

  const handleEmail = () => {
    const email = inquilino?.email || "";
    const subject = encodeURIComponent(
      step === "ipc_letter" ? "Actualización de renta - IPC" : "Comunicación sobre contrato de arrendamiento"
    );
    const body = encodeURIComponent(generatedText);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleRemindLater = async () => {
    if (!contrato || !property || !onCreateReminder) return;
    const days = parseInt(remindDays) || 30;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + days);
    const fechaStr = fecha.toISOString().split("T")[0];
    await onCreateReminder(
      fechaStr,
      `🔔 Recordatorio: Renovación contrato — ${property.nombre_interno}`,
      `Recordatorio automático para gestionar la renovación del contrato "${contrato.titulo}". ¿Deseas actualizar IPC, cambiar condiciones o no renovar?`,
      property.id,
    );
    toast({ title: "Recordatorio creado", description: `Se te recordará en ${days} días.` });
    handleClose(false);
  };

  const isUrgent = contrato?.preaviso_meses
    ? (() => {
        const endDate = new Date(contrato.fecha_fin || "");
        const preavisoDate = new Date(endDate);
        preavisoDate.setMonth(preavisoDate.getMonth() - contrato.preaviso_meses);
        return new Date() >= preavisoDate;
      })()
    : false;

  const daysUntilEnd = contrato?.fecha_fin
    ? Math.ceil((new Date(contrato.fecha_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const renderSendOptions = () => (
    <div className="space-y-3 mt-4">
      <Label className="text-xs font-semibold">Enviar comunicación:</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleEmail}>
          <Mail size={14} /> Email
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleWhatsApp}>
          <MessageSquare size={14} /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handlePrint}>
          <Printer size={14} /> Imprimir
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleCopy}>
          <Copy size={14} /> Copiar
        </Button>
      </div>
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {step === "options" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle size={18} className={isUrgent ? "text-red-500" : "text-amber-500"} />
                {isUrgent ? "⚠️ Preaviso en curso" : "Próximo vencimiento de contrato"}
              </DialogTitle>
              <DialogDescription>
                {property?.nombre_interno && <span className="font-medium text-foreground">{property.nombre_interno}</span>}
                {contrato?.fecha_fin && <> · Fin: <span className="font-medium">{contrato.fecha_fin}</span></>}
                {daysUntilEnd != null && (
                  <Badge variant={daysUntilEnd < 90 ? "destructive" : "secondary"} className="ml-2 text-[10px]">
                    {daysUntilEnd > 0 ? `${daysUntilEnd} días` : "Vencido"}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            {isUrgent && contrato?.preaviso_meses && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle size={14} className="inline mr-1" />
                <strong>Atención:</strong> El plazo de preaviso de {contrato.preaviso_meses} meses ya ha comenzado.
                Debes comunicar tu decisión al inquilino lo antes posible.
              </div>
            )}

            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground mb-3">
                {isUrgent
                  ? "¿Ya has gestionado la renovación?"
                  : "El contrato vence próximamente. ¿Qué deseas hacer?"}
              </p>

              {/* Option 1: Update IPC */}
              <button
                onClick={() => setStep("ipc")}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Actualizar renta (IPC)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Aplica la subida del IPC y genera una carta formal para el inquilino</p>
                </div>
              </button>

              {/* Option 2: New contract */}
              <button
                onClick={() => setStep("new_contract")}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FileText size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Cambiar condiciones (nuevo contrato)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Propón un nuevo contrato con condiciones actualizadas</p>
                </div>
              </button>

              {/* Option 3: Don't renew */}
              <button
                onClick={() => setStep("no_renew")}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-border hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <XCircle size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No renovar</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Comunica tu decisión y genera el acta de devolución de llaves</p>
                </div>
              </button>

              {/* Already resolved */}
              <div className="pt-2 border-t border-border mt-2">
                <button
                  onClick={() => setStep("resolved_survey")}
                  className="w-full flex items-center gap-2 p-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Ya lo he resuelto
                </button>
                <button
                  onClick={() => setStep("remind_later")}
                  className="w-full flex items-center gap-2 p-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                >
                  <Clock size={14} />
                  Recuérdamelo más tarde
                </button>
              </div>
            </div>
          </>
        )}

        {step === "ipc" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-500" />
                Actualización de renta por IPC
              </DialogTitle>
            </DialogHeader>
            <button onClick={() => setStep("options")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>

            <div className="space-y-4">
              {/* Auto-filled data summary */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 border border-border">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-1.5">Datos auto-rellenados</p>
                <p>🏠 <span className="text-muted-foreground">Vivienda:</span> {property?.direccion_completa || property?.nombre_interno || <span className="text-destructive">No disponible</span>}</p>
                <p>👤 <span className="text-muted-foreground">Inquilino:</span> {inquilino ? `${inquilino.nombre}${inquilino.apellidos ? ` ${inquilino.apellidos}` : ""}` : <span className="text-destructive">No disponible</span>}
                  {inquilino?.dni && <span className="text-muted-foreground"> · {inquilino.dni}</span>}
                </p>
                <p>🏷️ <span className="text-muted-foreground">Propietario:</span> {profile?.nombre ? `${profile.nombre}${profile.apellidos ? ` ${profile.apellidos}` : ""}` : <span className="text-destructive">No disponible</span>}
                  {profile?.nif && <span className="text-muted-foreground"> · {profile.nif}</span>}
                </p>
                <p>📄 <span className="text-muted-foreground">Contrato:</span> {contrato?.titulo || "—"} · Inicio: {contrato?.fecha_inicio || "—"} · Fin: {contrato?.fecha_fin || "—"}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Renta actual</span>
                  <span className="font-semibold">{rentaActual.toFixed(2)} €/mes</span>
                </div>
                <div>
                  <Label className="text-xs">Porcentaje IPC (%)</Label>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mt-1.5 mb-1.5">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                      📋 <strong>Referencia BOE:</strong> 2,3% (último dato publicado). Puede modificar este valor según la cláusula de su contrato.
                    </p>
                  </div>
                  <Input
                    type="number" step="0.1" value={ipcPercent}
                    onChange={(e) => setIpcPercent(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Consulta el IPC vigente en el <a href="https://www.ine.es/varipc/" target="_blank" rel="noopener noreferrer" className="text-primary underline">INE</a>
                  </p>
                </div>
                <div className="border-t border-border pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nueva renta</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{nuevaRenta.toFixed(2)} €/mes</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Diferencia</span>
                    <span className="text-emerald-600 dark:text-emerald-400">+{diferencia.toFixed(2)} €/mes</span>
                  </div>
                </div>
              </div>

              {/* Missing data fields */}
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Datos adicionales para la carta</p>
                <div>
                  <Label className="text-xs">Fecha efectiva del cambio</Label>
                  <Input
                    type="date"
                    value={extraData.fecha_efectiva || ""}
                    onChange={(e) => setExtraData(prev => ({ ...prev, fecha_efectiva: e.target.value }))}
                    className="mt-1"
                    placeholder="Primer día del mes siguiente"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Si no se indica, se usará el primer día del mes siguiente.</p>
                </div>
                <div>
                  <Label className="text-xs">Domicilio del propietario (para carta)</Label>
                  <Input
                    value={extraData.propietario_domicilio || ""}
                    onChange={(e) => setExtraData(prev => ({ ...prev, propietario_domicilio: e.target.value }))}
                    className="mt-1"
                    placeholder="Dirección del propietario para el encabezado"
                  />
                </div>
              </div>

              <Button onClick={handleIpcApply} disabled={ipcApplying || !pct} className="w-full gap-2">
                {ipcApplying ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                Aplicar IPC y generar carta
              </Button>
            </div>
          </>
        )}

        {step === "ipc_letter" && (
          <>
            <DialogHeader>
              <DialogTitle>Carta de actualización IPC</DialogTitle>
              <DialogDescription>Revisa y envía la comunicación al inquilino.</DialogDescription>
            </DialogHeader>
            <button onClick={() => setStep("ipc")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>
            {generating ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Loader2 size={24} className="animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Generando carta formal…</p>
              </div>
            ) : (
              <>
                <Textarea ref={textRef} value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} rows={14} className="text-xs font-mono" />
                {renderSendOptions()}
              </>
            )}
          </>
        )}

        {step === "new_contract" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                Nuevo contrato con condiciones actualizadas
              </DialogTitle>
            </DialogHeader>
            <button onClick={() => setStep("options")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Se abrirá el generador de contratos con los datos actuales de la vivienda, inquilino y propietario ya pre-rellenados.
                Podrás modificar las condiciones según la legislación vigente.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p><strong>Datos actuales:</strong></p>
                {property && <p>🏠 {property.nombre_interno} — {property.direccion_completa}</p>}
                {inquilino && <p>👤 {inquilino.nombre} {inquilino.apellidos || ""}</p>}
                {contrato && <p>💶 Renta: {contrato.renta_mensual} €/mes</p>}
              </div>
              <Button
                onClick={() => {
                  if (property && onNavigateToNewContract) {
                    onNavigateToNewContract({
                      propertyId: property.id,
                      inquilinoId: contrato?.inquilino_id || undefined,
                      renta: contrato?.renta_mensual ? String(contrato.renta_mensual) : undefined,
                      fianza: contrato?.fianza_importe ? `${contrato.fianza_importe} €` : undefined,
                      duracion: contrato?.duracion_anos ? `${contrato.duracion_anos} años` : undefined,
                    });
                    handleClose(false);
                  }
                }}
                className="w-full gap-2"
              >
                <FileText size={14} />
                Crear nuevo contrato
              </Button>
            </div>
          </>
        )}

        {step === "no_renew" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle size={18} className="text-red-500" />
                No renovar contrato
              </DialogTitle>
            </DialogHeader>
            <button onClick={() => setStep("options")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>

            <div className="space-y-3">
              {contrato?.preaviso_meses && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                  <Clock size={14} className="inline mr-1" />
                  <strong>Plazo de preaviso:</strong> Debes comunicar la no renovación con al menos {contrato.preaviso_meses} meses de antelación
                  a la fecha de finalización ({contrato.fecha_fin}).
                </div>
              )}

              {/* Auto-filled data summary */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 border border-border">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-1.5">Datos auto-rellenados</p>
                <p>🏠 <span className="text-muted-foreground">Vivienda:</span> {property?.direccion_completa || property?.nombre_interno || <span className="text-destructive">No disponible</span>}</p>
                <p>👤 <span className="text-muted-foreground">Inquilino:</span> {inquilino ? `${inquilino.nombre}${inquilino.apellidos ? ` ${inquilino.apellidos}` : ""}` : <span className="text-destructive">No disponible</span>}
                  {inquilino?.dni && <span className="text-muted-foreground"> · {inquilino.dni}</span>}
                </p>
                <p>🏷️ <span className="text-muted-foreground">Propietario:</span> {profile?.nombre ? `${profile.nombre}${profile.apellidos ? ` ${profile.apellidos}` : ""}` : <span className="text-destructive">No disponible</span>}
                  {profile?.nif && <span className="text-muted-foreground"> · {profile.nif}</span>}
                </p>
                <p>📄 <span className="text-muted-foreground">Fin contrato:</span> {contrato?.fecha_fin || <span className="text-destructive">No disponible</span>}
                  {contrato?.fianza_importe && <span className="text-muted-foreground"> · Fianza: {contrato.fianza_importe} €</span>}
                </p>
              </div>

              {/* Missing data questionnaire */}
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Datos adicionales para la carta</p>
                <div>
                  <Label className="text-xs">Domicilio del propietario (remitente)</Label>
                  <Input
                    value={extraData.propietario_domicilio || ""}
                    onChange={(e) => setExtraData(prev => ({ ...prev, propietario_domicilio: e.target.value }))}
                    className="mt-1"
                    placeholder="Dirección del propietario"
                  />
                </div>
                <div>
                  <Label className="text-xs">Motivo de no renovación</Label>
                  <Select
                    value={extraData.motivo_no_renovacion || ""}
                    onValueChange={(v) => setExtraData(prev => ({ ...prev, motivo_no_renovacion: v }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona el motivo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fin del plazo contractual (no renovación)">Fin del plazo contractual (no renovación)</SelectItem>
                      <SelectItem value="Venta del inmueble">Venta del inmueble</SelectItem>
                      <SelectItem value="Recuperación para uso propio">Recuperación para uso propio</SelectItem>
                      <SelectItem value="Reforma o rehabilitación">Reforma o rehabilitación</SelectItem>
                      <SelectItem value="Incumplimiento contractual">Incumplimiento contractual</SelectItem>
                      <SelectItem value="Mutuo acuerdo">Mutuo acuerdo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fecha prevista de entrega de llaves</Label>
                  <Input
                    type="date"
                    value={extraData.fecha_entrega || ""}
                    onChange={(e) => setExtraData(prev => ({ ...prev, fecha_entrega: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Se generarán dos documentos: carta de no renovación y acta de devolución de llaves.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await generateComunicacion("no_renovacion");
                    setStep("no_renew_letter");
                  }}
                  disabled={generating}
                  className="flex-1 gap-2"
                  variant="destructive"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  Generar carta de no renovación
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "no_renew_letter" && (
          <>
            <DialogHeader>
              <DialogTitle>Carta de no renovación</DialogTitle>
              <DialogDescription>Revisa y envía al inquilino. También puedes generar el acta de devolución de llaves.</DialogDescription>
            </DialogHeader>
            <button onClick={() => setStep("no_renew")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>
            {generating ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Loader2 size={24} className="animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Generando comunicación…</p>
              </div>
            ) : (
              <>
                <Textarea ref={textRef} value={generatedText} onChange={(e) => setGeneratedText(e.target.value)} rows={14} className="text-xs font-mono" />
                {renderSendOptions()}
                <div className="border-t border-border pt-3 mt-3 space-y-2">
                  <div>
                    <Label className="text-xs">Fecha prevista de entrega de llaves</Label>
                    <Input
                      type="date"
                      value={extraData.fecha_entrega || ""}
                      onChange={(e) => setExtraData(prev => ({ ...prev, fecha_entrega: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    onClick={async () => {
                      await generateComunicacion("devolucion_llaves");
                    }}
                    disabled={generating}
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Generar acta de devolución de llaves
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {step === "resolved_survey" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                ¿Qué acción realizaste?
              </DialogTitle>
            </DialogHeader>
            <button onClick={() => setStep("options")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>

            <div className="space-y-3">
              <Select value={resolvedAction} onValueChange={setResolvedAction}>
                <SelectTrigger><SelectValue placeholder="Selecciona la acción realizada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipc">Actualicé la renta (IPC)</SelectItem>
                  <SelectItem value="nuevo_contrato">Firmé un nuevo contrato</SelectItem>
                  <SelectItem value="no_renovar">Comuniqué la no renovación</SelectItem>
                  <SelectItem value="prorroga">El contrato se prorrogó automáticamente</SelectItem>
                  <SelectItem value="otro">Otra acción</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <Label className="text-xs">Notas (opcional)</Label>
                <Textarea value={resolvedNotes} onChange={(e) => setResolvedNotes(e.target.value)} rows={3} placeholder="Detalles adicionales…" />
              </div>

              <Button
                onClick={() => {
                  toast({ title: "Registrado", description: "Se ha registrado la acción realizada." });
                  handleClose(false);
                }}
                disabled={!resolvedAction}
                className="w-full"
              >
                Guardar y cerrar
              </Button>
            </div>
          </>
        )}

        {step === "remind_later" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                ¿Cuándo quieres que te recuerde?
              </DialogTitle>
            </DialogHeader>
            <button onClick={() => setStep("options")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2">
              <ArrowLeft size={14} /> Volver
            </button>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "1 semana", days: "7" },
                  { label: "2 semanas", days: "14" },
                  { label: "1 mes", days: "30" },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setRemindDays(opt.days)}
                    className={`p-3 rounded-lg border text-xs font-medium transition-all ${
                      remindDays === opt.days
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs">O especifica los días:</Label>
                <Input type="number" value={remindDays} onChange={(e) => setRemindDays(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleRemindLater} className="w-full gap-2">
                <Clock size={14} />
                Crear recordatorio
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* IPC Confirmation Step 1: Legal */}
    <AlertDialog open={ipcConfirmStep === "legal"} onOpenChange={(open) => { if (!open) setIpcConfirmStep("none"); }}>
      <AlertDialogContent style={{ pointerEvents: "auto" }}>
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
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleIpcFirstConfirm();
            }}
          >
            Sí, continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* IPC Confirmation Step 2: Notification */}
    <AlertDialog open={ipcConfirmStep === "notify"} onOpenChange={(open) => { if (!open) setIpcConfirmStep("none"); }}>
      <AlertDialogContent style={{ pointerEvents: "auto" }}>
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
    </>
  );
};

export default ContratoRenewalDialog;
