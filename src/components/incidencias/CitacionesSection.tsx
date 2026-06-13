import { useState } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsappUtils";
import { CalendarClock, Plus, Trash2, Pencil, Mail, MessageSquare, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import SectionCard, { FormRow } from "./SectionCard";
import { toast } from "sonner";

export interface Citacion {
  id: string;
  incidencia_id: string;
  user_id: string;
  visitante_nombre: string;
  visitante_telefono: string | null;
  visitante_email: string | null;
  visitante_rol: string;
  visitante_empresa: string | null;
  fecha_hora: string;
  receptor_nombre: string;
  receptor_telefono: string | null;
  receptor_email: string | null;
  receptor_rol: string;
  estado: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

const ROLES_VISITANTE = ["Técnico", "Fontanero", "Electricista", "Albañil", "Perito", "Administrador", "Otro"];
const ROLES_RECEPTOR = ["Inquilino", "Propietario", "Familiar", "Vecino", "Otro"];
const ESTADOS_CITACION = ["Pendiente", "Confirmada", "Realizada", "Cancelada"];

const estadoColors: Record<string, string> = {
  "Pendiente": "bg-amber-100 text-amber-800",
  "Confirmada": "bg-blue-100 text-blue-800",
  "Realizada": "bg-emerald-100 text-emerald-800",
  "Cancelada": "bg-red-100 text-red-800",
};

interface Props {
  incidenciaId: string | null;
  citaciones: Citacion[];
  incidenciaData: Record<string, any>;
  onRefresh: () => void;
  onCreate: (data: Partial<Citacion>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Citacion>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogMessage?: (autor: string, mensaje: string) => Promise<void>;
}

const emptyForm = (): Partial<Citacion> => ({
  visitante_nombre: "",
  visitante_telefono: "",
  visitante_email: "",
  visitante_rol: "Técnico",
  visitante_empresa: "",
  fecha_hora: "",
  receptor_nombre: "",
  receptor_telefono: "",
  receptor_email: "",
  receptor_rol: "Inquilino",
  notas: "",
});

const CitacionesSection = ({ incidenciaId, citaciones, incidenciaData, onRefresh, onCreate, onUpdate, onDelete, onLogMessage }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Citacion>>(emptyForm());
  const [notifTarget, setNotifTarget] = useState<Citacion | null>(null);
  const [copied, setCopied] = useState(false);

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const prefillReceptor = () => {
    setForm(prev => ({
      ...prev,
      receptor_nombre: incidenciaData.inquilino_nombre || "",
      receptor_telefono: incidenciaData.inquilino_telefono || "",
      receptor_email: incidenciaData.inquilino_email || "",
      receptor_rol: "Inquilino",
    }));
  };

  const handleSave = async () => {
    if (!form.visitante_nombre || !form.fecha_hora || !form.receptor_nombre) {
      toast.error("Completa visitante, fecha/hora y receptor");
      return;
    }
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    await onRefresh();
    setForm(emptyForm());
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (c: Citacion) => {
    setForm({ ...c });
    setEditingId(c.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setForm(emptyForm());
    setShowForm(false);
    setEditingId(null);
  };

  const generateMessage = async (c: Citacion, channel: "email" | "whatsapp") => {
    const fechaStr = c.fecha_hora ? new Date(c.fecha_hora).toLocaleString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }) : "fecha pendiente";

    const direccion = incidenciaData.direccion || "la vivienda";
    const concepto = incidenciaData.concepto || "la incidencia";

    const body = `Estimado/a ${c.receptor_nombre},

Le informamos de que se ha programado una visita a ${direccion} en relación con: ${concepto}.

📅 Fecha y hora: ${fechaStr}
👷 Visitante: ${c.visitante_nombre} (${c.visitante_rol})${c.visitante_empresa ? ` — ${c.visitante_empresa}` : ""}${c.visitante_telefono ? `\n📞 Teléfono del visitante: ${c.visitante_telefono}` : ""}

Por favor, asegúrese de estar disponible para recibir al visitante.${c.notas ? `\n\nNotas: ${c.notas}` : ""}

Un saludo.`;

    const logEntry = channel === "whatsapp"
      ? `📲 WhatsApp enviado a ${c.receptor_nombre} (${c.receptor_rol}) sobre citación del ${fechaStr} con ${c.visitante_nombre} (${c.visitante_rol})${c.visitante_empresa ? ` — ${c.visitante_empresa}` : ""}`
      : `📧 Email enviado a ${c.receptor_nombre} (${c.receptor_rol}) sobre citación del ${fechaStr} con ${c.visitante_nombre} (${c.visitante_rol})${c.visitante_empresa ? ` — ${c.visitante_empresa}` : ""}`;

    if (channel === "whatsapp") {
      const phone = (c.receptor_telefono || "").replace(/\D/g, "");
      const fullPhone = phone.startsWith("34") ? phone : "34" + phone;
      window.open(buildWhatsAppUrl(fullPhone, body), "_blank");
      toast.success("WhatsApp abierto");
    } else {
      const subject = `Citación: ${concepto} - ${fechaStr}`;
      const mailtoUrl = `mailto:${c.receptor_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");
      toast.success("Email abierto");
    }

    if (onLogMessage) {
      await onLogMessage("Administrador", logEntry);
      onRefresh();
    }
  };

  const copyMessage = (c: Citacion) => {
    const fechaStr = c.fecha_hora ? new Date(c.fecha_hora).toLocaleString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }) : "fecha pendiente";
    const direccion = incidenciaData.direccion || "la vivienda";
    const concepto = incidenciaData.concepto || "la incidencia";
    const body = `Estimado/a ${c.receptor_nombre},\n\nSe ha programado una visita a ${direccion} en relación con: ${concepto}.\n\n📅 Fecha y hora: ${fechaStr}\n👷 Visitante: ${c.visitante_nombre} (${c.visitante_rol})${c.visitante_empresa ? ` — ${c.visitante_empresa}` : ""}${c.visitante_telefono ? `\n📞 Teléfono: ${c.visitante_telefono}` : ""}${c.notas ? `\n\nNotas: ${c.notas}` : ""}\n\nUn saludo.`;
    navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success("Mensaje copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!incidenciaId) {
    return (
      <SectionCard title="Citaciones" icon={CalendarClock}>
        <p className="text-sm text-muted-foreground">Guarda la incidencia primero para gestionar citaciones.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Citaciones" icon={CalendarClock}>
      {/* List */}
      {citaciones.length > 0 && (
        <div className="space-y-3 mb-4">
          {citaciones.map(c => (
            <div key={c.id} className="border border-border rounded-xl p-4 bg-secondary/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${estadoColors[c.estado] || "bg-zinc-100 text-zinc-600"}`}>
                      {c.estado}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.fecha_hora ? new Date(c.fecha_hora).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                      }) : ""}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    👷 {c.visitante_nombre} <span className="text-muted-foreground font-normal">({c.visitante_rol})</span>
                    {c.visitante_empresa && <span className="text-muted-foreground font-normal"> — {c.visitante_empresa}</span>}
                  </p>
                  <p className="text-sm text-foreground">
                    🏠 Recibe: {c.receptor_nombre} <span className="text-muted-foreground">({c.receptor_rol})</span>
                  </p>
                  {c.notas && <p className="text-xs text-muted-foreground mt-1">{c.notas}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
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
                          <AlertDialogTitle>¿Eliminar citación?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => { await onDelete(c.id); await onRefresh(); }} className="bg-destructive text-destructive-foreground">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {/* Notification buttons */}
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" title={c.receptor_email ? "Enviar email" : "Sin email"} disabled={!c.receptor_email} onClick={() => generateMessage(c, "email")}>
                      <Mail size={12} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" title={c.receptor_telefono ? "Enviar WhatsApp" : "Sin teléfono"} disabled={!c.receptor_telefono} onClick={() => generateMessage(c, "whatsapp")}>
                      <MessageSquare size={12} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" title="Copiar mensaje" onClick={() => copyMessage(c)}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm ? (
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{editingId ? "Editar citación" : "Nueva citación"}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelForm}>
              <X size={14} />
            </Button>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visitante</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre *</label>
              <Input value={form.visitante_nombre || ""} onChange={e => updateField("visitante_nombre", e.target.value)} placeholder="Nombre del visitante" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rol</label>
              <Select value={form.visitante_rol || "Técnico"} onValueChange={v => updateField("visitante_rol", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_VISITANTE.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={form.visitante_telefono || ""} onChange={e => updateField("visitante_telefono", e.target.value)} placeholder="Teléfono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Empresa</label>
              <Input value={form.visitante_empresa || ""} onChange={e => updateField("visitante_empresa", e.target.value)} placeholder="Nombre de la empresa" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" value={form.visitante_email || ""} onChange={e => updateField("visitante_email", e.target.value)} placeholder="Email" />
            </div>
          </div>

          <FormRow label="Fecha y hora *">
            <Input type="datetime-local" value={form.fecha_hora || ""} onChange={e => updateField("fecha_hora", e.target.value)} />
          </FormRow>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receptor</p>
            <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={prefillReceptor}>
              Cargar datos inquilino
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre *</label>
              <Input value={form.receptor_nombre || ""} onChange={e => updateField("receptor_nombre", e.target.value)} placeholder="Nombre del receptor" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rol</label>
              <Select value={form.receptor_rol || "Inquilino"} onValueChange={v => updateField("receptor_rol", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_RECEPTOR.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={form.receptor_telefono || ""} onChange={e => updateField("receptor_telefono", e.target.value)} placeholder="Teléfono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" value={form.receptor_email || ""} onChange={e => updateField("receptor_email", e.target.value)} placeholder="Email" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Estado</label>
            <Select value={form.estado || "Pendiente"} onValueChange={v => updateField("estado", v)}>
              <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS_CITACION.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <FormRow label="Notas">
            <Textarea value={form.notas || ""} onChange={e => updateField("notas", e.target.value)} placeholder="Observaciones adicionales" className="min-h-[50px]" />
          </FormRow>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} size="sm" className="gap-1.5">
              {editingId ? "Actualizar" : "Crear citación"}
            </Button>
            <Button variant="outline" size="sm" onClick={cancelForm}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(true)}>
          <Plus size={13} /> Nueva citación
        </Button>
      )}
    </SectionCard>
  );
};

export default CitacionesSection;
