import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Impuesto {
  id?: string;
  tipo: string;
  importe_anual: number | null;
  forma_pago: string;
  responsable: string;
  periodo_pago: string;
  observaciones: string;
}

const TIPOS = [
  { value: "ibi", label: "IBI" },
  { value: "basuras", label: "Tasa de basuras" },
  { value: "alcantarillado", label: "Alcantarillado" },
  { value: "vado", label: "Vado" },
  { value: "otro", label: "Otro" },
];

const FORMAS_PAGO = [
  { value: "anual", label: "Anual" },
  { value: "semestral", label: "Semestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "mensual", label: "Mensual" },
];

const RESPONSABLES = [
  { value: "propietario", label: "Propietario" },
  { value: "inquilino", label: "Inquilino" },
  { value: "comunidad", label: "Comunidad" },
  { value: "otro", label: "Otro" },
];

const MESES = [
  { value: "enero", label: "Enero" },
  { value: "febrero", label: "Febrero" },
  { value: "marzo", label: "Marzo" },
  { value: "abril", label: "Abril" },
  { value: "mayo", label: "Mayo" },
  { value: "junio", label: "Junio" },
  { value: "julio", label: "Julio" },
  { value: "agosto", label: "Agosto" },
  { value: "septiembre", label: "Septiembre" },
  { value: "octubre", label: "Octubre" },
  { value: "noviembre", label: "Noviembre" },
  { value: "diciembre", label: "Diciembre" },
];

const TRIMESTRES = [
  { value: "1er_trimestre", label: "1er trimestre" },
  { value: "2do_trimestre", label: "2º trimestre" },
  { value: "3er_trimestre", label: "3er trimestre" },
  { value: "4to_trimestre", label: "4º trimestre" },
];

const SEMESTRES = [
  { value: "1er_semestre", label: "1er semestre" },
  { value: "2do_semestre", label: "2º semestre" },
];

const getPeriodos = (formaPago: string) => {
  switch (formaPago) {
    case "mensual": return MESES;
    case "trimestral": return TRIMESTRES;
    case "semestral": return SEMESTRES;
    case "anual": return MESES; // month when the annual payment is due
    default: return MESES;
  }
};

const emptyImpuesto = (): Impuesto => ({
  tipo: "ibi",
  importe_anual: null,
  forma_pago: "anual",
  responsable: "propietario",
  periodo_pago: "",
  observaciones: "",
});

interface Props {
  propertyId: string;
}

export default function ImpuestosSection({ propertyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Impuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    if (!propertyId || !user) return;
    const { data } = await supabase
      .from("property_impuestos" as any)
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .order("created_at");
    if (data && (data as any[]).length > 0) {
      setItems(
        (data as any[]).map((d) => ({
          id: d.id,
          tipo: d.tipo ?? "ibi",
          importe_anual: d.importe_anual,
          forma_pago: d.forma_pago ?? "anual",
          responsable: d.responsable ?? "propietario",
          periodo_pago: d.periodo_pago ?? "",
          observaciones: d.observaciones ?? "",
        }))
      );
    } else {
      // Seed IBI and Basuras by default
      setItems([
        { ...emptyImpuesto(), tipo: "ibi" },
        { ...emptyImpuesto(), tipo: "basuras" },
      ]);
    }
    setLoading(false);
  }, [propertyId, user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const usedTipos = items.map((i) => i.tipo);

  const addItem = () => {
    const availableTipo = TIPOS.find((t) => !usedTipos.includes(t.value))?.value ?? "otro";
    const newItems = [...items, { ...emptyImpuesto(), tipo: availableTipo }];
    setItems(newItems);
    setExpandedIdx(newItems.length - 1);
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item.id) {
      await supabase.from("property_impuestos" as any).delete().eq("id", item.id);
    }
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    setExpandedIdx(null);
    toast({ title: "Eliminado", description: "Impuesto eliminado." });
  };

  const updateItem = (idx: number, field: keyof Impuesto, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    for (const item of items) {
      const payload = {
        property_id: propertyId,
        user_id: user.id,
        tipo: item.tipo,
        importe_anual: item.importe_anual,
        forma_pago: item.forma_pago,
        responsable: item.responsable,
        periodo_pago: item.periodo_pago || null,
        observaciones: item.observaciones || null,
      };
      if (item.id) {
        await supabase.from("property_impuestos" as any).update(payload).eq("id", item.id);
      } else {
        const { data } = await supabase.from("property_impuestos" as any).insert(payload).select().single();
        if (data) item.id = (data as any).id;
      }
    }
    setSaving(false);
    toast({ title: "Guardado", description: "Impuestos actualizados." });
  };

  const tipoLabel = (tipo: string) => TIPOS.find((t) => t.value === tipo)?.label ?? tipo;

  if (loading) return <p className="text-sm text-muted-foreground">Cargando impuestos…</p>;

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay impuestos registrados.</p>
      )}

      {items.map((item, idx) => {
        const isExpanded = expandedIdx === idx;
        return (
          <div key={idx} className="border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              type="button"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{tipoLabel(item.tipo)}</span>
                {item.importe_anual != null && (
                  <span className="text-xs text-muted-foreground">{item.importe_anual.toLocaleString("es-ES")} €/año</span>
                )}
              </div>
              {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="p-4 space-y-4 bg-background">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo de impuesto o tasa</Label>
                    <Select value={item.tipo} onValueChange={(v) => updateItem(idx, "tipo", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.filter((t) => t.value === item.tipo || !usedTipos.includes(t.value) || t.value === "otro").map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Importe anual</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={item.importe_anual ?? ""}
                        onChange={(e) => updateItem(idx, "importe_anual", e.target.value ? Number(e.target.value) : null)}
                        placeholder="450"
                        className="h-10 rounded-xl text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Forma de pago</Label>
                    <Select value={item.forma_pago} onValueChange={(v) => updateItem(idx, "forma_pago", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Responsable del pago</Label>
                    <Select value={item.responsable} onValueChange={(v) => updateItem(idx, "responsable", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESPONSABLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Periodo de pago</Label>
                  {item.forma_pago === "mensual" ? (
                    <p className="text-sm text-foreground h-10 flex items-center px-3 bg-muted/30 rounded-xl border border-input">Todos los meses</p>
                  ) : (
                    <Select value={item.periodo_pago || undefined} onValueChange={(v) => updateItem(idx, "periodo_pago", v)}>
                      <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Seleccionar periodo" /></SelectTrigger>
                      <SelectContent>
                        {getPeriodos(item.forma_pago).map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Observaciones</Label>
                  <Textarea
                    value={item.observaciones}
                    onChange={(e) => updateItem(idx, "observaciones", e.target.value)}
                    placeholder="Notas adicionales..."
                    className="rounded-xl text-sm min-h-[60px]"
                  />
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
          <Plus size={14} className="mr-1" /> Añadir impuesto
        </Button>
        {items.length > 0 && (
          <Button type="button" size="sm" onClick={saveAll} disabled={saving} className="rounded-xl">
            {saving ? "Guardando…" : "Guardar impuestos"}
          </Button>
        )}
      </div>
    </div>
  );
}
