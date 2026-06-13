import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useContratos } from "@/hooks/useContratos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, ShieldCheck, ScrollText, Users, Upload, Loader2 } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface SeguroImpago {
  id?: string;
  contrato_id: string | null;
  property_id: string | null;
  compania: string;
  num_poliza: string;
  tomador: string;
  telefono: string;
  email: string;
  prima: number | null;
  periodicidad: string;
  fecha_inicio: string;
  fecha_renovacion: string;
  estado: string;
  observaciones: string;
  inquilino_ids: string[];
}

const PERIODICIDADES = [
  { value: "anual", label: "Anual" },
  { value: "semestral", label: "Semestral" },
  { value: "mensual", label: "Mensual" },
];

const emptySeguro = (): SeguroImpago => ({
  contrato_id: null,
  property_id: null,
  compania: "",
  num_poliza: "",
  tomador: "",
  telefono: "",
  email: "",
  prima: null,
  periodicidad: "anual",
  fecha_inicio: "",
  fecha_renovacion: "",
  estado: "activo",
  observaciones: "",
  inquilino_ids: [],
});

interface Props {
  properties: Property[];
  inquilinos?: Inquilino[];
  onBack: () => void;
}

export default function SegurosImpagoSection({ properties, inquilinos = [], onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { contratos } = useContratos();
  const [items, setItems] = useState<SeguroImpago[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("seguros_impago" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    if (data) {
      // Fetch linked inquilinos for each seguro
      const seguros: SeguroImpago[] = [];
      for (const d of data as any[]) {
        const { data: links } = await supabase
          .from("seguro_impago_inquilinos" as any)
          .select("inquilino_id")
          .eq("seguro_impago_id", d.id);
        seguros.push({
          id: d.id,
          contrato_id: d.contrato_id,
          property_id: d.property_id,
          compania: d.compania ?? "",
          num_poliza: d.num_poliza ?? "",
          tomador: d.tomador ?? "",
          telefono: d.telefono ?? "",
          email: d.email ?? "",
          prima: d.prima,
          periodicidad: d.periodicidad ?? "anual",
          fecha_inicio: d.fecha_inicio ?? "",
          fecha_renovacion: d.fecha_renovacion ?? "",
          estado: d.estado ?? "activo",
          observaciones: d.observaciones ?? "",
          inquilino_ids: (links as any[] || []).map((l: any) => l.inquilino_id),
        });
      }
      setItems(seguros);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = () => {
    const newItems = [...items, emptySeguro()];
    setItems(newItems);
    setExpandedIdx(newItems.length - 1);
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item.id) {
      await supabase.from("seguros_impago" as any).delete().eq("id", item.id);
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
    setExpandedIdx(null);
    toast({ title: "Eliminado", description: "Seguro de impago eliminado." });
  };

  const updateItem = (idx: number, field: keyof SeguroImpago, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "fecha_inicio" || field === "periodicidad") {
        const fi = field === "fecha_inicio" ? value : item.fecha_inicio;
        const per = field === "periodicidad" ? value : item.periodicidad;
        updated.fecha_renovacion = calcRenovacion(fi, per);
      }
      // When contrato changes, auto-set property_id and inquilinos
      if (field === "contrato_id" && value) {
        const contrato = contratos.find(c => c.id === value);
        if (contrato) {
          updated.property_id = contrato.property_id;
          const contratoInquilinos = inquilinos.filter(inq => inq.property_id === contrato.property_id && inq.rol_inquilino !== "avalista");
          updated.inquilino_ids = contratoInquilinos.map(inq => inq.id);
        }
      }
      return updated;
    }));
  };

  const toggleInquilino = (idx: number, inquilinoId: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const ids = item.inquilino_ids.includes(inquilinoId)
        ? item.inquilino_ids.filter(id => id !== inquilinoId)
        : [...item.inquilino_ids, inquilinoId];
      return { ...item, inquilino_ids: ids };
    }));
  };

  const calcRenovacion = (fechaInicio: string, periodicidad: string): string => {
    if (!fechaInicio) return "";
    const start = new Date(fechaInicio);
    if (isNaN(start.getTime())) return "";
    const months = periodicidad === "semestral" ? 6 : periodicidad === "mensual" ? 1 : 12;
    const next = new Date(start);
    next.setMonth(next.getMonth() + months);
    const now = new Date();
    while (next < now) next.setMonth(next.getMonth() + months);
    return next.toISOString().split("T")[0];
  };

  const analyzeFile = async (idx: number, file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Formato no soportado", description: "Sube un PDF o imagen (JPG, PNG, WebP).", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "El máximo es 20 MB.", variant: "destructive" });
      return;
    }
    setAnalyzingIdx(idx);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const { data, error } = await supabase.functions.invoke("analyze-seguro-impago", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setItems(prev => prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item };
        if (data.compania) updated.compania = data.compania;
        if (data.num_poliza) updated.num_poliza = data.num_poliza;
        if (data.tomador) updated.tomador = data.tomador;
        if (data.prima) updated.prima = data.prima;
        if (data.periodicidad) updated.periodicidad = data.periodicidad;
        if (data.fecha_inicio) updated.fecha_inicio = data.fecha_inicio;
        if (data.fecha_renovacion) updated.fecha_renovacion = data.fecha_renovacion;
        if (data.telefono) updated.telefono = data.telefono;
        if (data.email) updated.email = data.email;
        if (data.observaciones) updated.observaciones = data.observaciones;
        return updated;
      }));
      toast({ title: "Documento analizado", description: "Se han rellenado los campos automáticamente. Revisa los datos." });
    } catch (e: any) {
      console.error("Error analyzing seguro:", e);
      toast({ title: "Error al analizar", description: e?.message || "No se pudo analizar el documento.", variant: "destructive" });
    } finally {
      setAnalyzingIdx(null);
    }
  };

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    for (const item of items) {
      const payload = {
        user_id: user.id,
        contrato_id: item.contrato_id || null,
        property_id: item.property_id || null,
        compania: item.compania || null,
        num_poliza: item.num_poliza || null,
        tomador: item.tomador || null,
        telefono: item.telefono || null,
        email: item.email || null,
        prima: item.prima,
        periodicidad: item.periodicidad,
        fecha_inicio: item.fecha_inicio || null,
        fecha_renovacion: item.fecha_renovacion || null,
        estado: item.estado,
        observaciones: item.observaciones || null,
      };
      let seguroId = item.id;
      if (item.id) {
        await supabase.from("seguros_impago" as any).update(payload).eq("id", item.id);
      } else {
        const { data } = await supabase.from("seguros_impago" as any).insert(payload).select().single();
        if (data) { seguroId = (data as any).id; item.id = seguroId; }
      }
      // Sync inquilino links
      if (seguroId) {
        await supabase.from("seguro_impago_inquilinos" as any).delete().eq("seguro_impago_id", seguroId);
        if (item.inquilino_ids.length > 0) {
          await supabase.from("seguro_impago_inquilinos" as any).insert(
            item.inquilino_ids.map(iid => ({ seguro_impago_id: seguroId, inquilino_id: iid }))
          );
        }
      }
    }
    setSaving(false);
    toast({ title: "Guardado", description: "Seguros de impago actualizados." });
  };

  // Vigent contracts only
  const vigentContratos = contratos.filter(c => c.estado === "vigente" && !c.archivado);

  const getContratoLabel = (contratoId: string | null) => {
    if (!contratoId) return "Sin contrato";
    const c = contratos.find(x => x.id === contratoId);
    if (!c) return "Contrato no encontrado";
    const prop = properties.find(p => p.id === c.property_id);
    return `${c.titulo} — ${prop?.nombre_interno || ""}`;
  };

  const getInquilinosForItem = (item: SeguroImpago): Inquilino[] => {
    if (item.contrato_id) {
      const contrato = contratos.find(c => c.id === item.contrato_id);
      if (contrato) {
        return inquilinos.filter(inq => inq.property_id === contrato.property_id && inq.rol_inquilino !== "avalista");
      }
    }
    return inquilinos.filter(inq => inq.rol_inquilino !== "avalista");
  };

  const periodicidadLabel = (p: string) => PERIODICIDADES.find(x => x.value === p)?.label ?? p;

  if (loading) return <p className="text-sm text-muted-foreground">Cargando seguros de impago…</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Seguros de impago</h2>
          <p className="text-sm text-muted-foreground">Vincula cada póliza a un contrato y a sus inquilinos.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay seguros de impago registrados.</p>
        )}

        {items.map((item, idx) => {
          const isExpanded = expandedIdx === idx;
          const isCancelled = item.estado === "cancelado";
          const availableInquilinos = getInquilinosForItem(item);

          return (
            <div key={idx} className={`border rounded-xl overflow-hidden ${isCancelled ? "border-destructive/30 opacity-70" : "border-border"}`}>
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ShieldCheck size={16} className={isCancelled ? "text-muted-foreground" : "text-primary"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.compania || "Nuevo seguro de impago"}
                      </span>
                      {item.num_poliza && <span className="text-xs text-muted-foreground">· {item.num_poliza}</span>}
                      {isCancelled && <Badge variant="destructive" className="text-[10px] h-5">Cancelado</Badge>}
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {getContratoLabel(item.contrato_id)}
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="p-4 space-y-4 bg-background">
                  {/* AI analyze from file */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) analyzeFile(idx, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={analyzingIdx === idx}
                      onClick={() => fileInputRefs.current[idx]?.click()}
                    >
                      {analyzingIdx === idx ? (
                        <><Loader2 size={14} className="mr-1.5 animate-spin" /> Analizando…</>
                      ) : (
                        <><Upload size={14} className="mr-1.5" /> Rellenar desde documento</>
                      )}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">PDF o imagen de la póliza</span>
                  </div>

                  {/* Contract selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ScrollText size={12} /> Contrato vinculado
                    </Label>
                    <Select value={item.contrato_id || "_none"} onValueChange={(v) => updateItem(idx, "contrato_id", v === "_none" ? null : v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin vincular</SelectItem>
                        {vigentContratos.map(c => {
                          const prop = properties.find(p => p.id === c.property_id);
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              {c.titulo} — {prop?.nombre_interno || "Sin vivienda"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Inquilinos */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users size={12} /> Inquilinos vinculados
                    </Label>
                    {availableInquilinos.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Selecciona un contrato para ver los inquilinos disponibles.</p>
                    ) : (
                      <div className="space-y-2">
                        {availableInquilinos.map(inq => (
                          <label key={inq.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={item.inquilino_ids.includes(inq.id)}
                              onCheckedChange={() => toggleInquilino(idx, inq.id)}
                            />
                            <span className="text-sm">{[inq.nombre, inq.apellidos].filter(Boolean).join(" ")}</span>
                            {inq.dni && <span className="text-xs text-muted-foreground">({inq.dni})</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Compañía aseguradora</Label>
                      <Input value={item.compania} onChange={(e) => updateItem(idx, "compania", e.target.value)} placeholder="Mapfre, Zurich..." className="h-10 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Número de póliza</Label>
                      <Input value={item.num_poliza} onChange={(e) => updateItem(idx, "num_poliza", e.target.value)} placeholder="POL-12345" className="h-10 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Tomador del seguro</Label>
                      <Input value={item.tomador} onChange={(e) => updateItem(idx, "tomador", e.target.value)} placeholder="Nombre del tomador" className="h-10 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado</Label>
                      <Select value={item.estado} onValueChange={(v) => updateItem(idx, "estado", v)}>
                        <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activo">Activo</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fecha de inicio</Label>
                      <Input type="date" value={item.fecha_inicio} onChange={(e) => updateItem(idx, "fecha_inicio", e.target.value)} className="h-10 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Renovación</Label>
                      <Select value={item.periodicidad} onValueChange={(v) => updateItem(idx, "periodicidad", v)}>
                        <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERIODICIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fecha de renovación</Label>
                      <Input type="date" value={item.fecha_renovacion} onChange={(e) => updateItem(idx, "fecha_renovacion", e.target.value)} className="h-10 rounded-xl text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Prima del seguro</Label>
                      <div className="relative">
                        <Input type="number" value={item.prima ?? ""} onChange={(e) => updateItem(idx, "prima", e.target.value ? Number(e.target.value) : null)} placeholder="350" className="h-10 rounded-xl text-sm" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/{periodicidadLabel(item.periodicidad).toLowerCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Teléfono aseguradora</Label>
                      <Input value={item.telefono} onChange={(e) => updateItem(idx, "telefono", e.target.value)} placeholder="+34 900..." className="h-10 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Email de contacto</Label>
                      <Input type="email" value={item.email} onChange={(e) => updateItem(idx, "email", e.target.value)} placeholder="contacto@aseguradora.es" className="h-10 rounded-xl text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Observaciones</Label>
                    <Textarea value={item.observaciones} onChange={(e) => updateItem(idx, "observaciones", e.target.value)} placeholder="Notas adicionales..." className="rounded-xl text-sm min-h-[60px]" />
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive">
                      <Trash2 size={14} className="mr-1" /> Eliminar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="rounded-xl">
            <Plus size={14} className="mr-1" /> Añadir seguro de impago
          </Button>
          {items.length > 0 && (
            <Button type="button" size="sm" onClick={saveAll} disabled={saving} className="rounded-xl">
              {saving ? "Guardando…" : "Guardar seguros"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
