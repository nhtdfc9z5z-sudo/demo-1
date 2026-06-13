import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, Copy, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useMemo, useCallback } from "react";
import { useProfile } from "@/hooks/useProfile";
import {
  ORIGENES_INCIDENCIA, CAUSANTES, RESPONSABLES_PAGO,
  RESPONSABLES_GESTION, ORIGEN_TO_CAUSANTE, ORIGEN_TO_RESPONSABLE, ORIGEN_TO_GESTION,
  RESPONSABLES_POR_CAUSANTE,
  PRIORIDADES, TIPOS_INCIDENCIA, TIME_SLOTS, ROLES_AFECTADO,
} from "@/hooks/useIncidencias";
import {
  getContactForRole, autoFillSeguroFields, autoFillOrigenFromCausante as autoFillOrigenFn,
  handlePropertyChangeShared, handleCausanteChangeShared, getPlaceholder,
} from "@/lib/incidenciaAutoFill";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import ProveedorSection from "../ProveedorSection";
import FacturaSection from "../FacturaSection";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  properties: Property[];
  inquilinos: Inquilino[];
}

const ResumenTab = ({ data, onChange, properties, inquilinos }: Props) => {
  const { profile } = useProfile();
  const [showOrigen, setShowOrigen] = useState(!!data.origen_domicilio || !!data.origen_tipo);
  const [showAfectados, setShowAfectados] = useState(!!data.afectado_nombre);
  const [showProveedor, setShowProveedor] = useState(!!data.proveedor_nombre);
  const [showFactura, setShowFactura] = useState(!!data.factura_numero);
  const [noSeHora, setNoSeHora] = useState(false);

  const selectedProperty = useMemo(
    () => properties.find(p => p.id === data.property_id) || null,
    [data.property_id, properties]
  );

  const propertyInquilino = useMemo(
    () => inquilinos.find(i => i.property_id === data.property_id && i.rol_inquilino !== "avalista") || null,
    [data.property_id, inquilinos]
  );

  const responsableOptions = RESPONSABLES_PAGO;

  const handlePropertyChange = (propertyId: string) => {
    handlePropertyChangeShared(propertyId, properties, inquilinos, onChange, {
      fillInquilino: false,
      fillDomicilios: false,
    });
  };

  const handleCausanteChange = (causante: string) => {
    handleCausanteChangeShared(causante, selectedProperty, propertyInquilino, profile, onChange, {
      RESPONSABLES_POR_CAUSANTE,
      ORIGEN_TO_RESPONSABLE,
      ORIGEN_TO_GESTION,
    });
  };

  const handleOrigenTipoChange = (origen: string) => {
    onChange("origen_tipo", origen);
    const causante = ORIGEN_TO_CAUSANTE[origen] || "";
    const responsable = ORIGEN_TO_RESPONSABLE[origen] || "";
    const gestion = ORIGEN_TO_GESTION[origen] || "";
    onChange("causante", causante);
    onChange("responsable_pago", responsable);
    onChange("responsable_gestion", gestion);
    if (responsable) {
      const contact = getContactForRole(responsable, selectedProperty, propertyInquilino, profile);
      onChange("responsable_nombre", contact.nombre);
      onChange("responsable_telefono", contact.telefono);
    }
    if (gestion) {
      const gestionContact = getContactForRole(gestion, selectedProperty, propertyInquilino, profile);
      onChange("gestion_nombre", gestionContact.nombre);
      onChange("gestion_telefono", gestionContact.telefono);
    }
    autoFillOrigenFn(causante, selectedProperty, propertyInquilino, onChange);
  };

  const isHighlighted = (section: string) => {
    const estado = data.estado;
    if (estado === "Abierta" && (section === "concepto" || section === "origen" || section === "prioridad")) return true;
    if (estado === "Cerrada" && section === "responsable") return true;
    return false;
  };

  const currentDate = data.fecha_hora_incidencia?.slice(0, 10) || "";
  const currentTime = data.fecha_hora_incidencia?.slice(11, 16) || "";

  const handleDateChange = (date: string) => {
    const time = noSeHora ? "" : currentTime;
    onChange("fecha_hora_incidencia", time ? `${date}T${time}` : `${date}T00:00`);
  };

  const handleTimeChange = (time: string) => {
    setNoSeHora(false);
    onChange("fecha_hora_incidencia", `${currentDate}T${time}`);
  };

  const handleNoSeHora = (checked: boolean) => {
    setNoSeHora(checked);
    if (checked) {
      onChange("fecha_hora_incidencia", currentDate ? `${currentDate}T00:00` : "");
    }
  };

  return (
    <div className="space-y-5">
      {/* Datos principales */}
      <div className={`bg-card rounded-xl border p-5 ${isHighlighted("concepto") ? "border-primary/30 shadow-sm" : "border-border"}`}>
        <h4 className="text-sm font-semibold text-foreground mb-4">Datos principales</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Inmueble</label>
            <Select value={data.property_id || ""} onValueChange={handlePropertyChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar inmueble" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Categoría</label>
            <Select value={data.tipo_incidencia || ""} onValueChange={v => onChange("tipo_incidencia", v)}>
              <SelectTrigger><SelectValue placeholder="Ej: Fontanería, Electricidad..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_INCIDENCIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fecha</label>
            <div className="flex items-center gap-2">
              <Input type="date" value={currentDate} onChange={e => handleDateChange(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2 gap-1 shrink-0"
                onClick={() => {
                  const now = new Date();
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const val = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                  onChange("fecha_hora_incidencia", val);
                }}
              >
                <Clock size={12} /> Ahora
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hora</label>
            <Select value={noSeHora ? "" : currentTime} onValueChange={handleTimeChange} disabled={noSeHora}>
              <SelectTrigger><SelectValue placeholder={noSeHora ? "Sin hora" : "Seleccionar hora"} /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={noSeHora} onCheckedChange={(v) => handleNoSeHora(!!v)} />
              <Clock size={11} /> No sé la hora exacta
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Asunto</label>
            <Input value={data.concepto || ""} onChange={e => onChange("concepto", e.target.value)} placeholder="Ej: Fuga de agua en baño" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Descripción completa</label>
            <Textarea value={data.inquilino_observaciones || ""} onChange={e => onChange("inquilino_observaciones", e.target.value)} rows={3} placeholder="Ej: Se ha detectado una fuga de agua debajo del fregadero..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dirección</label>
            <Input value={data.direccion || ""} onChange={e => onChange("direccion", e.target.value)} placeholder="Ej: Calle Mayor 5, 2ºA" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Referencia interna</label>
            <Input value={data.referencia_interna || ""} onChange={e => onChange("referencia_interna", e.target.value)} placeholder="Ej: REF-001" />
          </div>
        </div>

        {/* Prioridad */}
        {data.estado !== "Cerrada" && (
          <div className={`mt-4 ${isHighlighted("prioridad") ? "p-3 rounded-lg bg-primary/5" : ""}`}>
            <label className="text-xs text-muted-foreground mb-2 block">Prioridad</label>
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
        )}
      </div>

      {/* Causante + Responsables */}
      <div className={`bg-card rounded-xl border p-5 ${isHighlighted("responsable") ? "border-primary/30 shadow-sm" : "border-border"}`}>
        <h4 className="text-sm font-semibold text-foreground mb-4">Causante y responsables</h4>
        
        {/* Causante */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground">¿Qué o quién lo ha causado?</label>
          <Select value={data.causante || ""} onValueChange={handleCausanteChange}>
            <SelectTrigger><SelectValue placeholder="Seleccionar causante" /></SelectTrigger>
            <SelectContent>
              {CAUSANTES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Two-column: Responsable de pago + Quien gestiona */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
          {/* Responsable de pago */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Responsable de pago</p>
            </div>
            <Select value={data.responsable_pago || ""} onValueChange={v => {
              onChange("responsable_pago", v);
              const contact = getContactForRole(v, selectedProperty, propertyInquilino, profile);
              onChange("responsable_nombre", contact.nombre);
              onChange("responsable_telefono", contact.telefono);
            }}>
              <SelectTrigger><SelectValue placeholder="¿Quién paga?" /></SelectTrigger>
              <SelectContent>
                {responsableOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={data.responsable_nombre || ""} onChange={e => onChange("responsable_nombre", e.target.value)} placeholder={getPlaceholder(data.responsable_pago || "", "nombre")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={data.responsable_telefono || ""} onChange={e => onChange("responsable_telefono", e.target.value)} placeholder={getPlaceholder(data.responsable_pago || "", "telefono")} />
            </div>
          </div>

          {/* Quien gestiona */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Quien gestiona</p>
            </div>
            <Select value={data.responsable_gestion || ""} onValueChange={v => {
              onChange("responsable_gestion", v);
              const contact = getContactForRole(v, selectedProperty, propertyInquilino, profile);
              onChange("gestion_nombre", contact.nombre);
              onChange("gestion_telefono", contact.telefono);
            }}>
              <SelectTrigger><SelectValue placeholder="¿Quién lo gestiona?" /></SelectTrigger>
              <SelectContent>
                {RESPONSABLES_GESTION.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={data.gestion_nombre || ""} onChange={e => onChange("gestion_nombre", e.target.value)} placeholder={getPlaceholder(data.responsable_gestion || "", "nombre")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={data.gestion_telefono || ""} onChange={e => onChange("gestion_telefono", e.target.value)} placeholder={getPlaceholder(data.responsable_gestion || "", "telefono")} />
            </div>
          </div>
        </div>
      </div>

      {/* Inquilino quick info */}
      {propertyInquilino && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Inquilino vinculado</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Nombre</span>
              <p className="font-medium text-foreground">{propertyInquilino.nombre} {propertyInquilino.apellidos || ""}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Teléfono</span>
              <p className="font-medium text-foreground">{propertyInquilino.telefono || "—"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Email</span>
              <p className="font-medium text-foreground">{propertyInquilino.email || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Origen de la incidencia - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOrigen(!showOrigen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Origen de la incidencia</span>
          <div className="flex items-center gap-2">
            {data.origen_tipo && <Badge variant="outline" className="text-[10px]">{data.origen_tipo}</Badge>}
            {showOrigen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showOrigen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo de origen</label>
              <Select value={data.origen_tipo || ""} onValueChange={handleOrigenTipoChange}>
                <SelectTrigger><SelectValue placeholder="¿Qué ha causado la incidencia?" /></SelectTrigger>
                <SelectContent>
                  {ORIGENES_INCIDENCIA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Auto-filled info */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dirección del causante de la incidencia</label>
                <Input value={data.origen_domicilio || ""} onChange={e => onChange("origen_domicilio", e.target.value)} placeholder="Ej: Calle Mayor 5, 2ºA" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ubicación dentro del inmueble</label>
                <Input value={data.origen_lugar || ""} onChange={e => onChange("origen_lugar", e.target.value)} placeholder="Ej: Baño, cocina, salón, terraza..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nombre del responsable</label>
                <Input value={data.origen_nombre_responsable || ""} onChange={e => onChange("origen_nombre_responsable", e.target.value)} placeholder="Ej: Juan García" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input value={data.origen_telefono_responsable || ""} onChange={e => onChange("origen_telefono_responsable", e.target.value)} placeholder="Ej: 612 345 678" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Afectado (single) - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAfectados(!showAfectados)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Afectado</span>
          <div className="flex items-center gap-2">
            {data.afectado_nombre && <Badge variant="outline" className="text-[10px]">{data.afectado_nombre}</Badge>}
            {showAfectados ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showAfectados && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <div className="flex gap-2 mb-2">
              {propertyInquilino && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => {
                  onChange("afectado_nombre", `${propertyInquilino.nombre} ${propertyInquilino.apellidos || ""}`.trim());
                  onChange("afectado_telefono", propertyInquilino.telefono || "");
                  onChange("afectado_domicilio", selectedProperty?.direccion_completa || "");
                }}>
                  <Copy size={12} /> Inquilino
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Nombre</label><Input value={data.afectado_nombre || ""} onChange={e => onChange("afectado_nombre", e.target.value)} placeholder="Ej: Juan García" /></div>
              <div><label className="text-xs text-muted-foreground">Teléfono</label><Input value={data.afectado_telefono || ""} onChange={e => onChange("afectado_telefono", e.target.value)} placeholder="Ej: 612 345 678" /></div>
              <div><label className="text-xs text-muted-foreground">Domicilio</label><Input value={data.afectado_domicilio || ""} onChange={e => onChange("afectado_domicilio", e.target.value)} placeholder="Ej: Calle Mayor 5, 3ºB" /></div>
              <div><label className="text-xs text-muted-foreground">Rol</label>
                <Select value={data.afectado_responsable || ""} onValueChange={v => onChange("afectado_responsable", v)}>
                  <SelectTrigger><SelectValue placeholder="Ej: Afectado, Origen..." /></SelectTrigger>
                  <SelectContent>
                    {ROLES_AFECTADO.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proveedor y presupuesto - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowProveedor(!showProveedor)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Proveedor y presupuesto</span>
          <div className="flex items-center gap-2">
            {data.proveedor_nombre && <Badge variant="outline" className="text-[10px]">{data.proveedor_nombre}</Badge>}
            {showProveedor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showProveedor && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <ProveedorSection data={data} onChange={onChange} />
          </div>
        )}
      </div>

      {/* Factura - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFactura(!showFactura)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Factura</span>
          <div className="flex items-center gap-2">
            {data.factura_numero && <Badge variant="outline" className="text-[10px]">Nº {data.factura_numero}</Badge>}
            {showFactura ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showFactura && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <FacturaSection data={data} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenTab;
