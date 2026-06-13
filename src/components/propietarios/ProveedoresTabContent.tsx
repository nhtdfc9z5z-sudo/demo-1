import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Star, Filter, ArrowLeft, Trash2, Heart, Phone, Mail, Globe, MapPin, Building2, Wrench, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Proveedor } from "@/hooks/useProveedores";
import { ESPECIALIDADES_PROVEEDOR } from "@/hooks/useProveedores";

type View = "list" | "create" | "edit";

interface Props {
  proveedores: Proveedor[];
  loading: boolean;
  createProveedor: (d: Partial<Proveedor>) => Promise<Proveedor | null>;
  updateProveedor: (id: string, d: Partial<Proveedor>) => Promise<void>;
  deleteProveedor: (id: string) => Promise<void>;
}

const emptyForm = (): Partial<Proveedor> => ({
  nombre: "",
  nombre_comercial: "",
  cif: "",
  direccion: "",
  codigo_postal: "",
  municipio: "",
  provincia: "",
  telefono: "",
  email: "",
  web: "",
  persona_contacto: "",
  especialidad: "",
  valoracion: null,
  es_habitual: false,
  notas: "",
  activo: true,
});

function ProveedorForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  isEdit,
}: {
  form: Partial<Proveedor>;
  onChange: (f: Partial<Proveedor>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const set = (k: string, v: any) => onChange({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft size={18} /></Button>
        <h2 className="text-lg font-semibold text-foreground">{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</h2>
      </div>

      {/* Datos básicos */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos básicos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Razón social / Nombre *</Label>
            <Input value={form.nombre || ""} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Fontanería López S.L." />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre comercial</Label>
            <Input value={form.nombre_comercial || ""} onChange={e => set("nombre_comercial", e.target.value)} placeholder="Ej: FontaRápid" />
          </div>
        </div>
      </section>

      {/* Datos fiscales */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos fiscales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>CIF / NIF</Label>
            <Input value={form.cif || ""} onChange={e => set("cif", e.target.value)} placeholder="B12345678" />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input value={form.direccion || ""} onChange={e => set("direccion", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Código postal</Label>
            <Input value={form.codigo_postal || ""} onChange={e => set("codigo_postal", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Municipio</Label>
            <Input value={form.municipio || ""} onChange={e => set("municipio", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Provincia</Label>
            <Input value={form.provincia || ""} onChange={e => set("provincia", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contacto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Persona de contacto</Label>
            <Input value={form.persona_contacto || ""} onChange={e => set("persona_contacto", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={form.telefono || ""} onChange={e => set("telefono", e.target.value)} type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email || ""} onChange={e => set("email", e.target.value)} type="email" />
          </div>
          <div className="space-y-1.5">
            <Label>Web</Label>
            <Input value={form.web || ""} onChange={e => set("web", e.target.value)} placeholder="https://" />
          </div>
        </div>
      </section>

      {/* Clasificación */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clasificación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Especialidad</Label>
            <Select value={form.especialidad || ""} onValueChange={v => set("especialidad", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {ESPECIALIDADES_PROVEEDOR.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valoración (1-5)</Label>
            <Select value={form.valoracion != null ? String(form.valoracion) : ""} onValueChange={v => set("valoracion", v ? Number(v) : null)}>
              <SelectTrigger><SelectValue placeholder="Sin valorar" /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {"★".repeat(n)}{"☆".repeat(5 - n)} ({n})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={form.es_habitual || false} onCheckedChange={v => set("es_habitual", v)} />
            <Label>Proveedor habitual</Label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={form.activo !== false} onCheckedChange={v => set("activo", v)} />
            <Label>Activo</Label>
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notas internas</h3>
        <Textarea value={form.notas || ""} onChange={e => set("notas", e.target.value)} rows={3} placeholder="Notas privadas sobre este proveedor..." />
      </section>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave} disabled={saving || !form.nombre?.trim()}>
          {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </div>
  );
}

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="text-amber-500 text-xs tracking-tight">
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  );
}

export default function ProveedoresTabContent({ proveedores, loading, createProveedor, updateProveedor, deleteProveedor }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [filterEsp, setFilterEsp] = useState<string>("all");
  const [filterHabitual, setFilterHabitual] = useState<string>("all");
  const [filterActivo, setFilterActivo] = useState<string>("all");
  const [form, setForm] = useState<Partial<Proveedor>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let list = proveedores;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.nombre_comercial || "").toLowerCase().includes(q) ||
        (p.cif || "").toLowerCase().includes(q) ||
        (p.especialidad || "").toLowerCase().includes(q) ||
        (p.persona_contacto || "").toLowerCase().includes(q)
      );
    }
    if (filterEsp !== "all") list = list.filter(p => p.especialidad === filterEsp);
    if (filterHabitual === "si") list = list.filter(p => p.es_habitual);
    if (filterHabitual === "no") list = list.filter(p => !p.es_habitual);
    if (filterActivo === "si") list = list.filter(p => p.activo);
    if (filterActivo === "no") list = list.filter(p => !p.activo);
    return list;
  }, [proveedores, search, filterEsp, filterHabitual, filterActivo]);

  const hasFilters = filterEsp !== "all" || filterHabitual !== "all" || filterActivo !== "all";

  const handleSave = async () => {
    if (!form.nombre?.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateProveedor(editId, form);
        toast({ title: "Proveedor actualizado" });
      } else {
        await createProveedor(form);
      }
      setView("list");
      setForm(emptyForm());
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: Proveedor) => {
    setForm({ ...p });
    setEditId(p.id);
    setView("edit");
  };

  const handleDelete = async (id: string) => {
    await deleteProveedor(id);
    if (editId === id) {
      setView("list");
      setEditId(null);
    }
  };

  const clearFilters = () => {
    setFilterEsp("all");
    setFilterHabitual("all");
    setFilterActivo("all");
  };

  if (view === "create" || view === "edit") {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <ProveedorForm
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onCancel={() => { setView("list"); setForm(emptyForm()); setEditId(null); }}
          saving={saving}
          isEdit={view === "edit"}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Proveedores</h2>
          <p className="text-sm text-muted-foreground">{proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""} registrado{proveedores.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setEditId(null); setView("create"); }} className="gap-2">
          <Plus size={16} /> Nuevo proveedor
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, CIF, especialidad..." className="pl-9" />
        </div>
        <Select value={filterEsp} onValueChange={setFilterEsp}>
          <SelectTrigger className="w-[180px]"><Filter size={14} className="mr-1.5 text-muted-foreground" /><SelectValue placeholder="Especialidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {ESPECIALIDADES_PROVEEDOR.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterHabitual} onValueChange={setFilterHabitual}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Habitual" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="si">Habituales</SelectItem>
            <SelectItem value="no">No habituales</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterActivo} onValueChange={setFilterActivo}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="si">Activos</SelectItem>
            <SelectItem value="no">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtros activos:</span>
          {filterEsp !== "all" && <Badge variant="secondary" className="text-xs gap-1">{filterEsp} <X size={10} className="cursor-pointer" onClick={() => setFilterEsp("all")} /></Badge>}
          {filterHabitual !== "all" && <Badge variant="secondary" className="text-xs gap-1">{filterHabitual === "si" ? "Habituales" : "No habituales"} <X size={10} className="cursor-pointer" onClick={() => setFilterHabitual("all")} /></Badge>}
          {filterActivo !== "all" && <Badge variant="secondary" className="text-xs gap-1">{filterActivo === "si" ? "Activos" : "Inactivos"} <X size={10} className="cursor-pointer" onClick={() => setFilterActivo("all")} /></Badge>}
          <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-1">Limpiar todos</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando proveedores...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Wrench size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {proveedores.length === 0 ? "Aún no tienes proveedores registrados" : "No se encontraron proveedores con esos filtros"}
          </p>
          {proveedores.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => { setForm(emptyForm()); setView("create"); }} className="gap-1.5">
              <Plus size={14} /> Añadir el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={`group bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${!p.activo ? "opacity-60" : ""}`}
                onClick={() => handleEdit(p)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{p.nombre}</span>
                      {p.es_habitual && (
                        <Heart size={14} className="text-rose-500 fill-rose-500 shrink-0" />
                      )}
                      {!p.activo && <Badge variant="outline" className="text-[10px] shrink-0">Inactivo</Badge>}
                    </div>
                    {p.nombre_comercial && <p className="text-xs text-muted-foreground mb-1">{p.nombre_comercial}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.especialidad && (
                        <span className="flex items-center gap-1"><Wrench size={12} /> {p.especialidad}</span>
                      )}
                      {p.telefono && (
                        <span className="flex items-center gap-1"><Phone size={12} /> {p.telefono}</span>
                      )}
                      {p.email && (
                        <span className="flex items-center gap-1"><Mail size={12} /> {p.email}</span>
                      )}
                      {p.municipio && (
                        <span className="flex items-center gap-1"><MapPin size={12} /> {p.municipio}</span>
                      )}
                      {p.cif && (
                        <span className="flex items-center gap-1"><Building2 size={12} /> {p.cif}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StarRating value={p.valoracion} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={e => e.stopPropagation()}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminará «{p.nombre}» de tu lista de proveedores. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
