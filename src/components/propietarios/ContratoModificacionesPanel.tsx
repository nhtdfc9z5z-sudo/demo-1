import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronUp, History, Check, Send, FileText, MessageSquare, Phone, Mail, Globe, Pencil } from "lucide-react";
import type {
  ContratoModificacion,
  CreateModificacionData,
  NaturalezaCambio,
  TipoCambio,
  SoporteCambio,
  CanalComunicacion,
} from "@/hooks/useContratoModificaciones";
import {
  NATURALEZA_LABELS,
  TIPO_CAMBIO_LABELS,
  SOPORTE_LABELS,
  CANAL_LABELS,
} from "@/hooks/useContratoModificaciones";

interface Props {
  modificaciones: ContratoModificacion[];
  loading: boolean;
  contratoId: string;
  propertyId: string;
  onAdd: (data: CreateModificacionData) => Promise<any>;
  onAddComunicacion: (id: string, canal: CanalComunicacion) => Promise<void>;
  onMarkConfirmado: (id: string) => Promise<void>;
}

const CAMPO_LABELS: Record<string, string> = {
  renta_mensual: "Renta mensual",
  agua_paga_inquilino: "Agua",
  luz_paga_inquilino: "Luz",
  gas_paga_inquilino: "Gas",
  internet_paga_inquilino: "Internet",
  ibi_paga_inquilino: "IBI",
  basuras_paga_inquilino: "Basuras",
  comunidad_paga_inquilino: "Comunidad",
  fianza_importe: "Fianza",
  deposito_garantia: "Depósito de garantía",
  duracion_anos: "Duración",
  prorroga_anos: "Prórroga",
  preaviso_meses: "Preaviso",
  fecha_fin: "Fecha fin",
};

const canalIcons: Record<string, React.ReactNode> = {
  portal: <Globe size={10} />,
  email: <Mail size={10} />,
  whatsapp: <MessageSquare size={10} />,
  presencial: <Phone size={10} />,
  burofax: <FileText size={10} />,
  otro: <Send size={10} />,
};

function formatDateEs(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContratoModificacionesPanel({
  modificaciones,
  loading,
  contratoId,
  propertyId,
  onAdd,
  onAddComunicacion,
  onMarkConfirmado,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comunicarId, setComunicarId] = useState<string | null>(null);
  const [comunicarCanal, setComunicarCanal] = useState<CanalComunicacion>("portal");

  // Form state
  const [formData, setFormData] = useState<Partial<CreateModificacionData>>({
    naturaleza: "notificable",
    tipo_cambio: "otro",
  });

  const handleSubmit = async () => {
    if (!formData.tipo_cambio) return;
    await onAdd({
      contrato_id: contratoId,
      property_id: propertyId,
      naturaleza: formData.naturaleza as NaturalezaCambio,
      tipo_cambio: formData.tipo_cambio as TipoCambio,
      campo_afectado: formData.campo_afectado,
      valor_anterior: formData.valor_anterior,
      valor_nuevo: formData.valor_nuevo,
      motivo: formData.motivo,
      fecha_efectiva: formData.fecha_efectiva,
      soporte: formData.soporte as SoporteCambio | undefined,
      notas: formData.notas,
    });
    setFormData({ naturaleza: "notificable", tipo_cambio: "otro" });
    setShowForm(false);
  };

  const handleComunicar = async () => {
    if (!comunicarId) return;
    await onAddComunicacion(comunicarId, comunicarCanal);
    setComunicarId(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <History size={12} /> Historial de modificaciones
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowForm(true)}>
          <Plus size={11} /> Registrar cambio
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Cargando...</p>
      ) : modificaciones.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">Sin modificaciones registradas</p>
          <p className="text-[10px] text-muted-foreground mt-1">Los cambios relevantes quedarán aquí registrados con trazabilidad completa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modificaciones.map((mod) => {
            const nat = NATURALEZA_LABELS[mod.naturaleza];
            const isExpanded = expandedId === mod.id;
            const isCorrection = mod.naturaleza === "correccion_interna";
            return (
              <Collapsible key={mod.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : mod.id)}>
                <div className={`rounded-xl border overflow-hidden ${isCorrection ? "border-border/50 bg-muted/10" : "border-border bg-muted/20"}`}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2.5 p-3 hover:bg-muted/40 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${nat.color}`}>
                            {nat.label}
                          </Badge>
                          <span className={`text-xs font-medium ${isCorrection ? "text-muted-foreground" : "text-foreground"}`}>
                            {TIPO_CAMBIO_LABELS[mod.tipo_cambio]}
                          </span>
                          {mod.campo_afectado && (
                            <span className="text-[10px] text-muted-foreground">
                              · {CAMPO_LABELS[mod.campo_afectado] || mod.campo_afectado}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{formatDateEs(mod.fecha_registro)}</span>
                          {mod.valor_anterior && mod.valor_nuevo && (
                            <span className="text-[10px] text-muted-foreground">
                              {mod.valor_anterior} → <span className="text-foreground font-medium">{mod.valor_nuevo}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCorrection && (
                          mod.comunicado ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                              <Check size={8} className="mr-0.5" /> Comunicado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                              Pendiente
                            </Badge>
                          )
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                      {mod.motivo && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Motivo:</span>
                          <p className="text-xs text-foreground">{mod.motivo}</p>
                        </div>
                      )}
                      {mod.fecha_efectiva && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Fecha efectiva:</span>
                          <p className="text-xs text-foreground">{formatDateEs(mod.fecha_efectiva)}</p>
                        </div>
                      )}
                      {mod.soporte && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Soporte:</span>
                          <p className="text-xs text-foreground">{SOPORTE_LABELS[mod.soporte]}</p>
                        </div>
                      )}
                      {mod.comunicado && mod.canal_comunicacion && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Último canal:</span>
                          <p className="text-xs text-foreground flex items-center gap-1">
                            {canalIcons[mod.canal_comunicacion]}
                            {CANAL_LABELS[mod.canal_comunicacion]} · {formatDateEs(mod.fecha_comunicacion)}
                          </p>
                        </div>
                      )}
                      {mod.confirmado_por_inquilino && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Confirmado por inquilino:</span>
                          <p className="text-xs text-foreground flex items-center gap-1">
                            <Check size={10} className="text-emerald-600" /> {formatDateEs(mod.fecha_confirmacion)}
                          </p>
                        </div>
                      )}
                      {mod.notas && (
                        <div>
                          <span className="text-[10px] text-muted-foreground">Notas:</span>
                          <p className="text-xs text-foreground whitespace-pre-line">{mod.notas}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {!isCorrection && (
                        <div className="flex gap-1.5 pt-1 flex-wrap">
                          {/* Always allow adding/updating communication channel */}
                          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => { setComunicarId(mod.id); setComunicarCanal("portal"); }}>
                            <Send size={10} /> {mod.comunicado ? "Añadir canal" : "Marcar comunicado"}
                          </Button>
                          {mod.naturaleza === "requiere_acuerdo" && !mod.confirmado_por_inquilino && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onMarkConfirmado(mod.id)}>
                              <Check size={10} /> Marcar confirmado
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* New modification form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil size={16} className="text-primary" />
              Registrar modificación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Naturaleza</Label>
                <Select value={formData.naturaleza || "notificable"} onValueChange={(v) => setFormData(f => ({ ...f, naturaleza: v as NaturalezaCambio }))}>
                  <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correccion_interna">Corrección interna</SelectItem>
                    <SelectItem value="notificable">Notificable</SelectItem>
                    <SelectItem value="requiere_acuerdo">Requiere acuerdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Tipo de cambio</Label>
                <Select value={formData.tipo_cambio || "otro"} onValueChange={(v) => setFormData(f => ({ ...f, tipo_cambio: v as TipoCambio }))}>
                  <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipc">Actualización IPC</SelectItem>
                    <SelectItem value="renta_manual">Cambio de renta</SelectItem>
                    <SelectItem value="suministro">Suministro/gasto</SelectItem>
                    <SelectItem value="condicion">Condición contractual</SelectItem>
                    <SelectItem value="anexo">Anexo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px]">Campo afectado</Label>
              <Input value={formData.campo_afectado || ""} onChange={(e) => setFormData(f => ({ ...f, campo_afectado: e.target.value }))} className="h-8 text-xs mt-0.5" placeholder="Ej: renta_mensual, luz, duración..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Valor anterior</Label>
                <Input value={formData.valor_anterior || ""} onChange={(e) => setFormData(f => ({ ...f, valor_anterior: e.target.value }))} className="h-8 text-xs mt-0.5" placeholder="850 €/mes" />
              </div>
              <div>
                <Label className="text-[11px]">Valor nuevo</Label>
                <Input value={formData.valor_nuevo || ""} onChange={(e) => setFormData(f => ({ ...f, valor_nuevo: e.target.value }))} className="h-8 text-xs mt-0.5" placeholder="892.50 €/mes" />
              </div>
            </div>

            <div>
              <Label className="text-[11px]">Motivo</Label>
              <Input value={formData.motivo || ""} onChange={(e) => setFormData(f => ({ ...f, motivo: e.target.value }))} className="h-8 text-xs mt-0.5" placeholder="Actualización IPC anual 2025" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Fecha efectiva</Label>
                <Input type="date" value={formData.fecha_efectiva || ""} onChange={(e) => setFormData(f => ({ ...f, fecha_efectiva: e.target.value }))} className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[11px]">Soporte</Label>
                <Select value={formData.soporte || ""} onValueChange={(v) => setFormData(f => ({ ...f, soporte: v as SoporteCambio }))}>
                  <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anexo_firmado">Anexo firmado</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="verbal">Verbal</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px]">Notas</Label>
              <Textarea value={formData.notas || ""} onChange={(e) => setFormData(f => ({ ...f, notas: e.target.value }))} rows={2} className="text-xs mt-0.5" placeholder="Observaciones adicionales..." />
            </div>

            <Button className="w-full" size="sm" onClick={handleSubmit}>
              Registrar modificación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark as communicated dialog */}
      <Dialog open={!!comunicarId} onOpenChange={(open) => { if (!open) setComunicarId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Canal de comunicación</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Indica por qué medio se ha comunicado este cambio al inquilino.</p>
          <div className="space-y-3">
            <Select value={comunicarCanal} onValueChange={(v) => setComunicarCanal(v as CanalComunicacion)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portal">Portal inquilino</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="burofax">Burofax</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" size="sm" onClick={handleComunicar}>
              <Check size={12} className="mr-1.5" /> Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
