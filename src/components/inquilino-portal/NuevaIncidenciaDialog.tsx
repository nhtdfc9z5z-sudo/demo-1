import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Clock } from "lucide-react";
import { TIME_SLOTS, PRIORIDADES } from "@/hooks/useIncidencias";

interface Props {
  onSubmit: (data: {
    concepto: string;
    direccion: string;
    inquilino_observaciones: string;
    prioridad: number;
    disponibilidad_parte_dia: string;
    disponibilidad_comentarios: string;
    fecha_hora_incidencia: string;
  }) => Promise<void>;
  direccion?: string;
}

const URGENCIAS = PRIORIDADES.map(p => ({
  value: p.value,
  label: `${p.value === 1 ? "🟢" : p.value === 2 ? "🟡" : p.value === 3 ? "🟠" : "🔴"} ${p.label}`,
  description: p.value === 1 ? "No urgente" : p.value === 2 ? "Atención pronto" : p.value === 3 ? "Necesita atención" : "Requiere atención inmediata",
}));

const NuevaIncidenciaDialog = ({ onSubmit, direccion }: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fechaDate, setFechaDate] = useState(new Date().toISOString().slice(0, 10));
  const [fechaTime, setFechaTime] = useState("");
  const [noSeHora, setNoSeHora] = useState(false);
  const [form, setForm] = useState({
    concepto: "",
    inquilino_observaciones: "",
    prioridad: 2,
    disponibilidad_parte_dia: "",
    disponibilidad_comentarios: "",
  });

  const buildDateTime = () => {
    if (noSeHora || !fechaTime) return `${fechaDate}T00:00`;
    return `${fechaDate}T${fechaTime}`;
  };

  const handleSubmit = async () => {
    if (!form.concepto.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        direccion: direccion || "",
        fecha_hora_incidencia: buildDateTime(),
      });
      setForm({
        concepto: "", inquilino_observaciones: "", prioridad: 2,
        disponibilidad_parte_dia: "", disponibilidad_comentarios: "",
      });
      setFechaDate(new Date().toISOString().slice(0, 10));
      setFechaTime("");
      setNoSeHora(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Nueva incidencia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar incidencia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">¿Qué ha pasado? *</label>
            <Input
              placeholder="Ej: Fuga de agua en el baño"
              value={form.concepto}
              onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descripción detallada</label>
            <Textarea
              placeholder="Describe el problema con detalle..."
              value={form.inquilino_observaciones}
              onChange={e => setForm(p => ({ ...p, inquilino_observaciones: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Fecha + hora mejorada */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">¿Cuándo ocurrió?</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground">Fecha</label>
                <Input type="date" value={fechaDate} onChange={e => setFechaDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Hora</label>
                <Select value={fechaTime} onValueChange={v => { setFechaTime(v); setNoSeHora(false); }} disabled={noSeHora}>
                  <SelectTrigger><SelectValue placeholder={noSeHora ? "Sin hora" : "Hora"} /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={noSeHora} onCheckedChange={(v) => { setNoSeHora(!!v); if (v) setFechaTime(""); }} />
              <Clock size={11} /> No sé la hora exacta
            </label>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">¿Cómo de urgente es?</label>
            <div className="grid grid-cols-2 gap-2">
              {URGENCIAS.map(u => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, prioridad: u.value }))}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.prioridad === u.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-medium">{u.label}</p>
                  <p className="text-[10px] text-muted-foreground">{u.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Disponibilidad para visita</label>
            <Select
              value={form.disponibilidad_parte_dia}
              onValueChange={v => setForm(p => ({ ...p, disponibilidad_parte_dia: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Mañana">Mañana</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Indiferente">Indiferente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Comentarios</label>
            <Input
              placeholder="Ej: Mejor entre 10-12h"
              value={form.disponibilidad_comentarios}
              onChange={e => setForm(p => ({ ...p, disponibilidad_comentarios: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving || !form.concepto.trim()}>
            {saving ? "Enviando..." : "Enviar incidencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuevaIncidenciaDialog;
