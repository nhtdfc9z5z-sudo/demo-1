import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField, NumberField } from "./FormFields";
import type { InsuranceEntry } from "@/hooks/useProperties";

const emptyInsurance: InsuranceEntry = {
  tipo: "",
  compania: "",
  num_poliza: "",
  contacto: "",
  importe: null,
  vencimiento: "",
};

interface InsuranceSectionProps {
  seguros: InsuranceEntry[];
  onChange: (seguros: InsuranceEntry[]) => void;
}

const InsuranceSection = ({ seguros, onChange }: InsuranceSectionProps) => {
  const add = () => onChange([...seguros, { ...emptyInsurance }]);
  const remove = (i: number) => onChange(seguros.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof InsuranceEntry, value: string | number | null) => {
    const updated = [...seguros];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {seguros.map((s, i) => (
        <div key={i} className="bg-secondary/50 rounded-xl p-4 space-y-3 relative">
          <button
            onClick={() => remove(i)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition"
          >
            <Trash2 size={14} />
          </button>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Tipo de seguro" value={s.tipo} onChange={(v) => update(i, "tipo", v)} placeholder="Hogar, Impago..." />
            <TextField label="Compañía" value={s.compania} onChange={(v) => update(i, "compania", v)} placeholder="Mapfre, AXA..." />
            <TextField label="Nº Póliza" value={s.num_poliza} onChange={(v) => update(i, "num_poliza", v)} placeholder="POL-12345" />
            <TextField label="Contacto" value={s.contacto} onChange={(v) => update(i, "contacto", v)} placeholder="Teléfono o email" />
            <NumberField label="Importe anual" value={s.importe} onChange={(v) => update(i, "importe", v)} placeholder="300" suffix="€" />
            <TextField label="Vencimiento" value={s.vencimiento} onChange={(v) => update(i, "vencimiento", v)} placeholder="15/03/2026" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="rounded-xl gap-1.5">
        <Plus size={14} />
        Añadir seguro
      </Button>
    </div>
  );
};

export default InsuranceSection;
