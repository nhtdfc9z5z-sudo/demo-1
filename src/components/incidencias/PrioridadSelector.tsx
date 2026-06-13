import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRIORIDADES } from "@/hooks/useIncidencias";

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const PrioridadSelector = ({ value, onChange, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const prio = PRIORIDADES.find(p => p.value === (value ?? 3));
  if (!prio) return null;

  if (disabled) {
    return (
      <Badge variant="outline" className={`text-[10px] ${prio.color} border-0`}>
        {prio.label}
      </Badge>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className="focus:outline-none"
        >
          <Badge
            variant="outline"
            className={`text-[10px] ${prio.color} border-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all`}
          >
            {prio.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5" align="start" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          {PRIORIDADES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={e => {
                e.stopPropagation();
                onChange(p.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                p.value === value
                  ? `${p.color} ring-1 ring-primary/30`
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PrioridadSelector;