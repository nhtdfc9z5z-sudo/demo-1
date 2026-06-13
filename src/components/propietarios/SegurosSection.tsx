import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

interface Seguro {
  id?: string;
  tipo: string;
  compania: string;
  num_poliza: string;
  tomador: string;
  fecha_inicio: string;
  periodicidad: string;
  fecha_renovacion: string;
  prima: number | null;
  estado: string;
  telefono: string;
  email: string;
  observaciones: string;
}

const TIPOS_SEGURO = [
  { value: "hogar", label: "Hogar" },
  { value: "responsabilidad_civil", label: "Responsabilidad civil" },
  { value: "comunidad", label: "Comunidad" },
  { value: "otro", label: "Otro" },
];

const TOMADORES = [
  { value: "propietario", label: "Propietario" },
  { value: "inquilino", label: "Inquilino" },
  { value: "comunidad", label: "Comunidad" },
  { value: "otro", label: "Otro" },
];

const PERIODICIDADES = [
  { value: "anual", label: "Anual" },
  { value: "semestral", label: "Semestral" },
  { value: "mensual", label: "Mensual" },
];

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "cancelado", label: "Cancelado" },
];

const emptySeguro = (): Seguro => ({
  tipo: "hogar",
  compania: "",
  num_poliza: "",
  tomador: "propietario",
  fecha_inicio: "",
  periodicidad: "anual",
  fecha_renovacion: "",
  prima: null,
  estado: "activo",
  telefono: "",
  email: "",
  observaciones: "",
});

interface Props {
  propertyId: string;
}

export default function SegurosSection({ propertyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Seguro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    if (!propertyId || !user) return;
    const { data } = await supabase
      .from("property_seguros" as any)
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .order("created_at");
    if (data) {
      setItems(
        (data as any[]).map((d) => ({
          id: d.id,
          tipo: d.tipo ?? "hogar",
          compania: d.compania ?? "",
          num_poliza: d.num_poliza ?? "",
          tomador: d.tomador ?? "propietario",
          fecha_inicio: d.fecha_inicio ?? "",
          periodicidad: d.periodicidad ?? "anual",
          fecha_renovacion: d.fecha_renovacion ?? "",
          prima: d.prima,
          estado: d.estado ?? "activo",
          telefono: d.telefono ?? "",
          email: d.email ?? "",
          observaciones: d.observaciones ?? "",
        }))
      );
    }
    setLoading(false);
  }, [propertyId, user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = () => {
    const newItems = [...items, emptySeguro()];
    setItems(newItems);
    setExpandedIdx(newItems.length - 1);
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item.id) {
      await supabase.from("property_seguros" as any).delete().eq("id", item.id);
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setExpandedIdx(null);
    toast({ title: "Eliminado", description: "Seguro eliminado." });
  };

  const calcRenovacion = (fechaInicio: string, periodicidad: string): string => {
    if (!fechaInicio) return "";
    const start = new Date(fechaInicio);
    if (isNaN(start.getTime())) return "";
    const months = periodicidad === "semestral" ? 6 : periodicidad === "mensual" ? 1 : 12;
    const next = new Date(start);
    next.setMonth(next.getMonth() + months);
    // If the calculated date is in the past, advance until future
    const now = new Date();
    while (next < now) {
      next.setMonth(next.getMonth() + months);
    }
    return next.toISOString().split("T")[0];
  };

  const updateItem = (idx: number, field: keyof Seguro, value: any) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Auto-calculate fecha_renovacion when fecha_inicio or periodicidad changes
      if (field === "fecha_inicio" || field === "periodicidad") {
        const fi = field === "fecha_inicio" ? value : item.fecha_inicio;
        const per = field === "periodicidad" ? value : item.periodicidad;
        updated.fecha_renovacion = calcRenovacion(fi, per);
      }
      return updated;
    }));
  };

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    for (const item of items) {
      const payload = {
        property_id: propertyId,
        user_id: user.id,
        tipo: item.tipo,
        compania: item.compania || null,
        num_poliza: item.num_poliza || null,
        tomador: item.tomador,
        fecha_inicio: item.fecha_inicio || null,
        periodicidad: item.periodicidad,
        fecha_renovacion: item.fecha_renovacion || null,
        prima: item.prima,
        estado: item.estado,
        telefono: item.telefono || null,
        email: item.email || null,
        observaciones: item.observaciones || null,
      };
      if (item.id) {
        await supabase.from("property_seguros" as any).update(payload).eq("id", item.id);
      } else {
        const { data } = await supabase.from("property_seguros" as any).insert(payload).select().single();
        if (data) item.id = (data as any).id;
      }
    }
    setSaving(false);
    toast({ title: "Guardado", description: "Seguros actualizados." });
  };

  const tipoLabel = (tipo: string) => TIPOS_SEGURO.find((t) => t.value === tipo)?.label ?? tipo;
  const periodicidadLabel = (p: string) => PERIODICIDADES.find((x) => x.value === p)?.label ?? p;

  if (loading) return <p className="text-sm text-muted-foreground">Cargando seguros…</p>;

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay seguros registrados.</p>
      )}

      {items.map((item, idx) => {
        const isExpanded = expandedIdx === idx;
        const isCancelled = item.estado === "cancelado";
        return (
          <div key={idx} className={`border rounded-xl overflow-hidden ${isCancelled ? "border-destructive/30 opacity-70" : "border-border"}`}>
            <button
              type="button"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className={isCancelled ? "text-muted-foreground" : "text-primary"} />
                <span className="text-sm font-medium text-foreground">{tipoLabel(item.tipo)}</span>
                {item.compania && <span className="text-xs text-muted-foreground">· {item.compania}</span>}
                {item.prima != null && (
                  <span className="text-xs text-muted-foreground">{item.prima.toLocaleString("es-ES")} €/{periodicidadLabel(item.periodicidad).toLowerCase()}</span>
                )}
                {isCancelled && <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Cancelado</span>}
              </div>
              {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="p-4 space-y-4 bg-background">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo de seguro</Label>
                    <Select value={item.tipo} onValueChange={(v) => updateItem(idx, "tipo", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_SEGURO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Select value={item.tomador} onValueChange={(v) => updateItem(idx, "tomador", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TOMADORES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
                        {PERIODICIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <Select value={item.estado} onValueChange={(v) => updateItem(idx, "estado", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
          <Plus size={14} className="mr-1" /> Añadir seguro
        </Button>
        {items.length > 0 && (
          <Button type="button" size="sm" onClick={saveAll} disabled={saving} className="rounded-xl">
            {saving ? "Guardando…" : "Guardar seguros"}
          </Button>
        )}
      </div>
    </div>
  );
}
