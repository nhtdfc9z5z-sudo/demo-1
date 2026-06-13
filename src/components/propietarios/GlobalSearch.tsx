import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Home, User, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { PanelTab } from "./PanelHeader";

interface SearchResult {
  type: "property" | "inquilino" | "incidencia";
  id: string;
  title: string;
  subtitle: string;
  tab: PanelTab;
}

interface GlobalSearchProps {
  properties: Property[];
  inquilinos: Inquilino[];
  incidencias: Incidencia[];
  onNavigate: (tab: PanelTab, id?: string) => void;
}

const typeIcon = {
  property: <Home size={14} className="text-primary shrink-0" />,
  inquilino: <User size={14} className="text-primary shrink-0" />,
  incidencia: <AlertTriangle size={14} className="text-amber-500 shrink-0" />,
};

const typeLabel = {
  property: "Propiedad",
  inquilino: "Inquilino",
  incidencia: "Incidencia",
};

export default function GlobalSearch({ properties, inquilinos, incidencias, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const res: SearchResult[] = [];

    for (const p of properties) {
      const searchable = `${p.nombre_interno} ${p.direccion_completa || ""} ${p.ciudad || ""} ${p.referencia_catastral || ""}`.toLowerCase();
      if (searchable.includes(q)) {
        res.push({
          type: "property", id: p.id, tab: "propiedades",
          title: p.nombre_interno,
          subtitle: p.direccion_completa || p.ciudad || "",
        });
      }
    }

    for (const i of inquilinos) {
      const searchable = `${i.nombre} ${i.apellidos || ""} ${i.email || ""} ${i.telefono || ""} ${i.dni || ""}`.toLowerCase();
      if (searchable.includes(q)) {
        const propName = properties.find(p => p.id === i.property_id)?.nombre_interno || "";
        res.push({
          type: "inquilino", id: i.id, tab: "inquilinos",
          title: `${i.nombre} ${i.apellidos || ""}`.trim(),
          subtitle: propName,
        });
      }
    }

    for (const inc of incidencias) {
      const searchable = `${inc.concepto || ""} ${inc.direccion || ""} #${inc.numero_incidencia} ${inc.inquilino_nombre || ""}`.toLowerCase();
      if (searchable.includes(q)) {
        res.push({
          type: "incidencia", id: inc.id, tab: "incidencias",
          title: `#${inc.numero_incidencia} · ${inc.concepto || "Sin concepto"}`,
          subtitle: inc.direccion || inc.inquilino_nombre || "",
        });
      }
    }

    return res.slice(0, 8);
  }, [query, properties, inquilinos, incidencias]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (r: SearchResult) => {
    onNavigate(r.tab, r.id);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar... ⌘K"
          className="h-8 w-[200px] lg:w-[260px] pl-8 pr-8 text-xs rounded-lg bg-secondary border-none focus-visible:ring-1 focus-visible:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 w-[320px] bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map((r, idx) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                idx === selectedIdx ? "bg-accent/10" : "hover:bg-muted/50"
              }`}
            >
              {typeIcon[r.type]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.subtitle}</p>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase shrink-0">{typeLabel[r.type]}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 w-[320px] bg-popover border border-border rounded-xl shadow-lg z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">Sin resultados para "{query}"</p>
        </div>
      )}
    </div>
  );
}
