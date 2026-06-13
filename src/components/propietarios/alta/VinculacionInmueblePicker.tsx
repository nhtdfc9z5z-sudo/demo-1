import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Home, Search, PlusCircle } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (propertyId: string) => void;
  /** CTA cuando no hay inmuebles aún. */
  onAltaInmueble: () => void;
}

/**
 * Selector visual y buscable de inmueble existente. Usado en la intención
 * `vinculacion` para preseleccionar el activo antes de abrir el wizard.
 */
const VinculacionInmueblePicker = ({ open, onOpenChange, onSelect, onAltaInmueble }: Props) => {
  const { properties, loading } = useProperties();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => {
      const blob = [
        p.nombre_interno,
        p.direccion_completa,
        p.tipo_via,
        p.nombre_via,
        p.ciudad,
        p.municipio,
        p.tipo_inmueble,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [properties, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Elige el inmueble</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sobre cuál quieres vincular.
          </p>
        </div>

        {!loading && properties.length === 0 ? (
          <div className="px-6 pb-6 text-center space-y-3">
            <p className="text-sm text-foreground">
              Primero da de alta un inmueble.
            </p>
            <Button onClick={onAltaInmueble} className="rounded-xl gap-2">
              <PlusCircle size={16} /> Dar de alta un inmueble
            </Button>
          </div>
        ) : (
          <>
            <div className="px-6 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, dirección o tipo…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="px-3 pb-4 max-h-[55vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No hay coincidencias.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map((p) => {
                    const direccion = (
                      p.direccion_completa ||
                      [p.tipo_via, p.nombre_via].filter(Boolean).join(" ") ||
                      ""
                    ).trim();
                    const ciudad = [p.ciudad || p.municipio].filter(Boolean).join("");
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(p.id)}
                          className="w-full text-left rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors p-3 flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Home size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground truncate">
                              {p.nombre_interno || "Sin nombre"}
                            </span>
                            {(direccion || ciudad) && (
                              <span className="block text-xs text-muted-foreground truncate">
                                {[direccion, ciudad].filter(Boolean).join(" · ")}
                              </span>
                            )}
                            {p.tipo_inmueble && (
                              <span className="mt-1 inline-block text-[11px] uppercase tracking-wide text-primary font-medium">
                                {p.tipo_inmueble}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VinculacionInmueblePicker;