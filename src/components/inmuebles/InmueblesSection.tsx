import { useState } from "react";
import { Plus, Home, BedDouble, Car, Archive, Briefcase, Store, Mountain, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import InmuebleCard from "./InmuebleCard";
import InmuebleDetailSheet from "./InmuebleDetailSheet";
import type { FieldConfig } from "./InmuebleDetailSheet";

interface InmueblesSectionProps {
  items: Array<Record<string, any>>;
  loading: boolean;
  tipoLabel: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
  extraInfo?: (item: Record<string, any>) => string;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const InmueblesSection = ({ items, loading, tipoLabel, icon, fields, extraInfo, onAdd, onUpdate, onDelete }: InmueblesSectionProps) => {
  const [editingItem, setEditingItem] = useState<Record<string, any> | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          {tipoLabel}s ({items.length})
        </h2>
        <Button size="sm" onClick={onAdd} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          <Plus size={16} />
          {tipoLabel}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-card rounded-2xl border border-border shadow-sm animate-pulse h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <div className="flex justify-center mb-3 text-muted-foreground">{icon}</div>
          <p className="text-muted-foreground text-sm">No tienes {tipoLabel.toLowerCase()}s registrados.</p>
          <Button size="sm" onClick={onAdd} className="mt-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
            <Plus size={16} /> Añadir {tipoLabel.toLowerCase()}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(item => (
            <InmuebleCard
              key={item.id}
              item={item}
              tipoLabel={tipoLabel}
              icon={icon}
              extraInfo={extraInfo?.(item)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </div>
      )}

      <InmuebleDetailSheet
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        item={editingItem}
        tipoLabel={tipoLabel}
        fields={fields}
        onSave={onUpdate}
      />
    </section>
  );
};

export default InmueblesSection;
