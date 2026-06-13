import { useState, useCallback, useRef, useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Camera, MapPin, X, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import {
  RESPONSABLES_POR_CAUSANTE, RESPONSABLES_PAGO,
  RESPONSABLES_GESTION, ORIGEN_TO_RESPONSABLE, ORIGEN_TO_GESTION,
  PRIORIDADES, TIPOS_INCIDENCIA, TIME_SLOTS,
} from "@/hooks/useIncidencias";
import {
  CAUSANTES_QUICK, CAUSANTE_TO_ORIGEN,
  getContactForRole, autoFillSeguroFields, autoFillOrigenFromCausante,
  handlePropertyChangeShared, handleCausanteChangeShared, getPlaceholder,
  getCanonicalCausante,
} from "@/lib/incidenciaAutoFill";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface Props {
  properties: Property[];
  inquilinos: Inquilino[];
  onSave: (data: Record<string, any>, files: File[]) => Promise<void>;
  onBack: () => void;
}

const IncidenciaQuickCreate = ({ properties, inquilinos, onSave, onBack }: Props) => {
  const { profile } = useProfile();
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, any>>({
    prioridad: 3,
    estado: "Abierta",
    fecha_hora_incidencia: new Date().toISOString().slice(0, 10),
  });
  const [fechaDate, setFechaDate] = useState(new Date().toISOString().slice(0, 10));
  const [fechaTime, setFechaTime] = useState("");
  const [noSeHora, setNoSeHora] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onChange = useCallback((field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const selectedProperty = useMemo(
    () => properties.find(p => p.id === data.property_id) || null,
    [data.property_id, properties]
  );

  const propertyInquilino = useMemo(
    () => inquilinos.find(i => i.property_id === data.property_id && i.rol_inquilino !== "avalista") || null,
    [data.property_id, inquilinos]
  );

  const [causanteOtroTexto, setCausanteOtroTexto] = useState("");
  const [gestionOtroTexto, setGestionOtroTexto] = useState("");

  const handlePropertyChange = (propertyId: string) => {
    handlePropertyChangeShared(propertyId, properties, inquilinos, onChange, {
      fillInquilino: true,
      fillDomicilios: true,
    });
  };

  const handleCausanteChange = (causante: string) => {
    if (causante !== "Otro") setCausanteOtroTexto("");
    handleCausanteChangeShared(causante, selectedProperty, propertyInquilino, profile, onChange, {
      RESPONSABLES_POR_CAUSANTE,
      ORIGEN_TO_RESPONSABLE,
      ORIGEN_TO_GESTION,
    });
  };

  const handleDateChange = (date: string) => {
    setFechaDate(date);
    updateDateTime(date, fechaTime, noSeHora);
  };

  const handleTimeChange = (time: string) => {
    setFechaTime(time);
    updateDateTime(fechaDate, time, false);
    setNoSeHora(false);
  };

  const handleNoSeHora = (checked: boolean) => {
    setNoSeHora(checked);
    if (checked) {
      setFechaTime("");
      updateDateTime(fechaDate, "", true);
    }
  };

  const updateDateTime = (date: string, time: string, noTime: boolean) => {
    if (noTime || !time) {
      onChange("fecha_hora_incidencia", date ? `${date}T00:00` : "");
    } else {
      onChange("fecha_hora_incidencia", `${date}T${time}`);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(prev => [...prev, ...Array.from(fileList)]);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!data.property_id) missing.push("Inmueble");
    if (!data.concepto?.trim()) missing.push("Asunto");
    if (missing.length > 0) {
      toast({
        title: "Faltan datos obligatorios",
        description: `Rellena: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    await onSave({ ...data }, files);
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <h2 className="text-base font-semibold text-foreground">Alta rápida de incidencia</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save size={14} /> {saving ? "Creando..." : "Crear incidencia"}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Inmueble + Prioridad */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Inmueble *</label>
              <Select value={data.property_id || ""} onValueChange={handlePropertyChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar inmueble" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prioridad</label>
              <div className="flex gap-2 flex-wrap">
                {PRIORIDADES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onChange("prioridad", p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      data.prioridad === p.value
                        ? `${p.color} ring-2 ring-offset-1 ring-primary/30`
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {data.direccion && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} /> {data.direccion}
            </p>
          )}
          {propertyInquilino && (
            <p className="text-xs text-muted-foreground">
              Inquilino: <span className="font-medium text-foreground">{propertyInquilino.nombre} {propertyInquilino.apellidos || ""}</span>
            </p>
          )}
        </div>

        {/* Tipo de incidencia, tipo y descripción */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Asunto *</label>
              <Input
                value={data.concepto || ""}
                onChange={e => onChange("concepto", e.target.value)}
                placeholder="Ej: Fuga de agua en baño"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Categoría</label>
              <Select value={data.tipo_incidencia || ""} onValueChange={v => onChange("tipo_incidencia", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Ej: Fontanería, Electricidad..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_INCIDENCIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Descripción</label>
            <Textarea
              value={data.inquilino_observaciones || ""}
              onChange={e => onChange("inquilino_observaciones", e.target.value)}
              placeholder="Ej: Se ha detectado una fuga de agua debajo del fregadero de la cocina..."
              rows={3}
              className="mt-1.5"
            />
          </div>

          {/* Fecha + Hora */}
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Fecha y hora</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2 gap-1"
                onClick={() => {
                  const now = new Date();
                  const date = now.toISOString().slice(0, 10);
                  const hours = String(now.getHours()).padStart(2, "0");
                  const mins = now.getMinutes() < 30 ? "00" : "30";
                  const time = `${hours}:${mins}`;
                  setFechaDate(date);
                  setFechaTime(time);
                  setNoSeHora(false);
                  updateDateTime(date, time, false);
                }}
              >
                <Clock size={11} /> Ahora
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
              <div>
                <label className="text-xs text-muted-foreground">Fecha</label>
                <Input type="date" value={fechaDate} onChange={e => handleDateChange(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hora</label>
                <Select value={fechaTime} onValueChange={handleTimeChange} disabled={noSeHora}>
                  <SelectTrigger>
                    <SelectValue placeholder={noSeHora ? "Sin hora" : "Seleccionar hora"} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={noSeHora} onCheckedChange={(v) => handleNoSeHora(!!v)} />
              <Clock size={12} /> No sé la hora exacta
            </label>
          </div>
        </div>

        {/* Origen de la incidencia */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <label className="text-sm font-medium text-foreground">Origen de la incidencia</label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Causante *</label>
              <Select value={data.causante || ""} onValueChange={handleCausanteChange}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="¿Qué o quién lo ha causado?" /></SelectTrigger>
                <SelectContent>
                  {CAUSANTES_QUICK.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {data.causante === "Otro" && (
              <div>
                <label className="text-xs text-muted-foreground">Especificar causante</label>
                <Input
                  value={causanteOtroTexto}
                  onChange={e => setCausanteOtroTexto(e.target.value)}
                  placeholder="Ej: Anterior inquilino, tercero..."
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Responsable de pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Responsable de pago</label>
              <Select value={data.responsable_pago || ""} onValueChange={v => {
                onChange("responsable_pago", v);
                autoFillSeguroFields(v, selectedProperty, onChange);
                const contact = getContactForRole(v, selectedProperty, propertyInquilino, profile);
                onChange("responsable_nombre", contact.nombre);
                onChange("responsable_telefono", contact.telefono);
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar responsable de pago" /></SelectTrigger>
                <SelectContent>
                  {RESPONSABLES_PAGO.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">¿Quién lo gestiona?</label>
              <Select value={data.responsable_gestion || ""} onValueChange={v => {
                onChange("responsable_gestion", v);
                if (v !== "Otro") setGestionOtroTexto("");
                autoFillSeguroFields(v, selectedProperty, onChange);
                const contact = getContactForRole(v, selectedProperty, propertyInquilino, profile);
                onChange("gestion_nombre", contact.nombre);
                onChange("gestion_telefono", contact.telefono);
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar quién gestiona" /></SelectTrigger>
                <SelectContent>
                  {RESPONSABLES_GESTION.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {data.responsable_gestion === "Otro" && (
            <div>
              <label className="text-xs text-muted-foreground">Especificar quién gestiona</label>
              <Input
                value={gestionOtroTexto}
                onChange={e => setGestionOtroTexto(e.target.value)}
                placeholder="Ej: Abogado, mediador..."
                className="mt-1"
              />
            </div>
          )}

          {/* Contact details - always show two separate cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border mt-2">
            {/* Responsable de pago */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Resp. pago{data.responsable_pago ? `: ${data.responsable_pago}` : ""}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input value={data.responsable_nombre || ""} onChange={e => onChange("responsable_nombre", e.target.value)} placeholder={getPlaceholder(data.responsable_pago || "", "nombre")} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input value={data.responsable_telefono || ""} onChange={e => onChange("responsable_telefono", e.target.value)} placeholder={getPlaceholder(data.responsable_pago || "", "telefono")} className="mt-1" />
              </div>
            </div>
            {/* Quien gestiona */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Gestiona{data.responsable_gestion ? `: ${data.responsable_gestion}` : ""}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input value={data.gestion_nombre || ""} onChange={e => onChange("gestion_nombre", e.target.value)} placeholder={getPlaceholder(data.responsable_gestion || "", "nombre")} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input value={data.gestion_telefono || ""} onChange={e => onChange("gestion_telefono", e.target.value)} placeholder={getPlaceholder(data.responsable_gestion || "", "telefono")} className="mt-1" />
              </div>
            </div>
          </div>

          {/* Domicilio y lugar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border mt-2">
            <div>
              <label className="text-xs text-muted-foreground">Dirección del causante de la incidencia</label>
              <Input value={data.origen_domicilio || ""} onChange={e => onChange("origen_domicilio", e.target.value)} placeholder="Ej: Calle Mayor 5, 2ºA" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ubicación dentro del inmueble</label>
              <Input value={data.origen_lugar || ""} onChange={e => onChange("origen_lugar", e.target.value)} placeholder="Ej: Baño, cocina, salón, terraza..." className="mt-1" />
            </div>
          </div>

          {/* Auto-filled origen info */}
          {data.origen_nombre_responsable && (
            <div className="bg-primary/5 rounded-lg border border-primary/20 p-3 flex items-start gap-2">
              <Info size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-foreground">{data.origen_nombre_responsable}</p>
                {data.origen_telefono_responsable && <p className="text-muted-foreground">Tel: {data.origen_telefono_responsable}</p>}
                <p className="text-muted-foreground/70 mt-0.5">Datos precargados automáticamente</p>
              </div>
            </div>
          )}

        </div>

        {/* Afectado (single) */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="text-sm font-medium text-foreground">Afectado (opcional)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={data.afectado_nombre || ""} onChange={e => onChange("afectado_nombre", e.target.value)} placeholder="Ej: Juan García" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={data.afectado_telefono || ""} onChange={e => onChange("afectado_telefono", e.target.value)} placeholder="Ej: 612 345 678" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Dirección</label>
              <Input value={data.afectado_domicilio || ""} onChange={e => onChange("afectado_domicilio", e.target.value)} placeholder="Ej: Calle Mayor 5, 3ºB" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rol</label>
              <Input value={data.afectado_responsable || ""} onChange={e => onChange("afectado_responsable", e.target.value)} placeholder="Ej: Afectado, Vecino..." />
            </div>
          </div>
          {propertyInquilino && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
              onChange("afectado_nombre", `${propertyInquilino.nombre} ${propertyInquilino.apellidos || ""}`.trim());
              onChange("afectado_telefono", propertyInquilino.telefono || "");
              onChange("afectado_domicilio", selectedProperty?.direccion_completa || "");
            }}>
              Cargar inquilino como afectado
            </Button>
          )}
        </div>

        {/* Evidencias */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="text-sm font-medium text-foreground">Fotos / Evidencias (opcional)</label>
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={20} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Haz clic o arrastra fotos aquí</p>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="relative group">
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-16 h-16 object-cover rounded-lg border border-border" />
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom create button */}
        <div className="pt-2 pb-8">
          <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5 h-12 text-base">
            <Save size={16} /> {saving ? "Creando..." : "Crear incidencia"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default IncidenciaQuickCreate;
