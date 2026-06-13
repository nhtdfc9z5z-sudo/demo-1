import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User as UserIcon, Search, PlusCircle } from "lucide-react";
import { useInquilinos } from "@/hooks/useInquilinos";
import { useProperties } from "@/hooks/useProperties";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, filtra los inquilinos por el inmueble seleccionado. */
  propertyIdFiltro?: string | null;
  onSelect: (inquilinoId: string) => void;
  /** CTA cuando no hay inquilinos aún. */
  onAltaInquilino: () => void;
}

/**
 * Selector visual y buscable de inquilino existente. Muestra nombre
 * completo, DNI e inmueble vinculado.
 */
const VinculacionInquilinoPicker = ({
  open,
  onOpenChange,
  onSelect,
  onAltaInquilino,
  propertyIdFiltro,
}: Props) => {
  const { inquilinos, loading } = useInquilinos();
  const { properties } = useProperties();
  const [query, setQuery] = useState("");

  const propsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p.id, p.nombre_interno || "Inmueble");
    return m;
  }, [properties]);

  const filtered = useMemo(() => {
    let list = inquilinos;
    if (propertyIdFiltro) {
      list = list.filter((i) => i.property_id === propertyIdFiltro);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => {
      const blob = [i.nombre, i.apellidos, i.dni, i.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [inquilinos, query, propertyIdFiltro]);

  const isEmpty = !loading && inquilinos.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Elige el inquilino</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {propertyIdFiltro
              ? "Mostramos solo los del inmueble seleccionado."
              : "Selecciona un inquilino ya registrado."}
          </p>
        </div>

        {isEmpty ? (
          <div className="px-6 pb-6 text-center space-y-3">
            <p className="text-sm text-foreground">Primero da de alta un inquilino.</p>
            <Button onClick={onAltaInquilino} className="rounded-xl gap-2">
              <PlusCircle size={16} /> Crear inquilino con alquiler
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
                  placeholder="Buscar por nombre, apellidos o DNI…"
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
                  {filtered.map((i) => {
                    const nombreCompleto = [i.nombre, i.apellidos]
                      .filter(Boolean)
                      .join(" ")
                      .trim() || "Sin nombre";
                    const inmuebleNombre = i.property_id
                      ? propsById.get(i.property_id)
                      : null;
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(i.id)}
                          className="w-full text-left rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors p-3 flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                            <UserIcon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground truncate">
                              {nombreCompleto}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {i.dni || "Sin DNI"}
                              {inmuebleNombre ? ` · ${inmuebleNombre}` : ""}
                            </span>
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

export default VinculacionInquilinoPicker;