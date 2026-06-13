import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, User, Home, Phone, Mail, ArrowUpDown, ChevronDown, X, Search, LinkIcon, UserCheck, Info, ScrollText, FileText, Upload, Loader2, Sparkles, CheckCircle2, ChevronUp } from "lucide-react";
import { useAltaAlquiler } from "./AltaAlquilerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { TextField, NumberField, SelectField, Field } from "./FormFields";
import { Textarea } from "@/components/ui/textarea";
import InquilinoDetailPanel from "./InquilinoDetailPanel";
import type { Inquilino, InquilinoDocumento } from "@/hooks/useInquilinos";
import type { Property } from "@/hooks/useProperties";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { Contrato, ContratoAnalysis } from "@/hooks/useContratos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { resolveRentaEsperada } from "@/lib/rentaUtils";

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "finalizado", label: "Finalizado" },
  { value: "moroso", label: "Moroso" },
];

const TIPOS = [
  { value: "asalariado", label: "Asalariado" },
  { value: "autonomo", label: "Autónomo" },
  { value: "pensionista", label: "Pensionista" },
];

const statusStyle: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800",
  finalizado: "bg-zinc-100 text-zinc-600",
  moroso: "bg-red-100 text-red-800",
};

type SortField = "nombre" | "vivienda" | "estado" | "fecha_entrada" | "renta";
type SortDir = "asc" | "desc";

const sortLabels: Record<SortField, string> = {
  nombre: "Nombre",
  vivienda: "Activo",
  estado: "Estado",
  fecha_entrada: "Fecha entrada",
  renta: "Renta",
};

interface InquilinosSectionProps {
  inquilinos: Inquilino[];
  properties: Property[];
  incidencias?: Incidencia[];
  loading: boolean;
  onCreate: (data: Partial<Inquilino>) => Promise<Inquilino | null>;
  onUpdate: (id: string, data: Partial<Inquilino>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (orderedIds: string[]) => Promise<void>;
  fetchDocumentos: (inquilinoId: string) => Promise<InquilinoDocumento[]>;
  uploadDocumento: (inquilinoId: string, file: File, categoria: string) => Promise<InquilinoDocumento | null>;
  deleteDocumento: (doc: InquilinoDocumento) => Promise<void>;
  prefilledPropertyId?: string | null;
  editInquilino?: Inquilino | null;
  onConsumeAction?: () => void;
  contratos?: Contrato[];
  onLinkContrato?: (inquilino: Inquilino) => void;
}

const InquilinosSection = ({
  inquilinos, properties, incidencias = [], loading, onCreate, onUpdate, onDelete,
  onReorder,
  fetchDocumentos, uploadDocumento, deleteDocumento,
  prefilledPropertyId, editInquilino, onConsumeAction, contratos = [], onLinkContrato,
}: InquilinosSectionProps) => {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Inquilino | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailInquilino, setDetailInquilino] = useState<Inquilino | null>(null);
  const [justCreatedInquilino, setJustCreatedInquilino] = useState<Inquilino | null>(null);

  // New tenant creation flow
  const [creationMode, setCreationMode] = useState<"choose" | "contract" | "manual">("choose");
  const [analyzingContract, setAnalyzingContract] = useState(false);
  const [contractAnalysis, setContractAnalysis] = useState<ContratoAnalysis | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  // Filter & sort state
  const [searchQuery, setSearchQuery] = useState("");
  const alta = useAltaAlquiler();
  const [sortField, setSortField] = useState<SortField>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [filterVivienda, setFilterVivienda] = useState<string | null>(null);

  const activeFilterCount = [filterEstado, filterVivienda, searchQuery.trim() ? "x" : null].filter(Boolean).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setFilterEstado(null);
    setFilterVivienda(null);
    setSearchQuery("");
  };

  const uniqueViviendas = useMemo(() => {
    const ids = [...new Set(inquilinos.map(i => i.property_id).filter(Boolean))];
    return ids.map(id => properties.find(p => p.id === id)).filter(Boolean) as Property[];
  }, [inquilinos, properties]);

  const processed = useMemo(() => {
    let list = [...inquilinos];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        `${i.nombre} ${i.apellidos || ""}`.toLowerCase().includes(q) ||
        (i.dni || "").toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q)
      );
    }

    if (filterEstado) list = list.filter(i => i.estado === filterEstado);
    if (filterVivienda) {
      // Include tenants currently or previously assigned to this property
      list = list.filter(i => i.property_id === filterVivienda);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "nombre":
          cmp = `${a.nombre} ${a.apellidos || ""}`.localeCompare(`${b.nombre} ${b.apellidos || ""}`);
          break;
        case "vivienda": {
          const pa = properties.find(p => p.id === a.property_id)?.nombre_interno || "zzz";
          const pb = properties.find(p => p.id === b.property_id)?.nombre_interno || "zzz";
          cmp = pa.localeCompare(pb);
          break;
        }
        case "estado": {
          const order = ["activo", "moroso", "finalizado"];
          cmp = order.indexOf(a.estado || "activo") - order.indexOf(b.estado || "activo");
          break;
        }
        case "fecha_entrada":
          cmp = new Date(a.fecha_entrada || 0).getTime() - new Date(b.fecha_entrada || 0).getTime();
          break;
        case "renta": {
          const rentaA = resolveRentaEsperada(a.property_id || "", inquilinos, contratos) ?? 0;
          const rentaB = resolveRentaEsperada(b.property_id || "", inquilinos, contratos) ?? 0;
          cmp = rentaA - rentaB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [inquilinos, searchQuery, filterEstado, filterVivienda, sortField, sortDir, properties]);

  const emptyForm = {
    nombre: "",
    apellidos: "",
    dni: "",
    telefono: "",
    email: "",
    property_id: "" as string | null,
    estado: "activo",
    tipo_inquilino: "asalariado",
    rol_inquilino: "inquilino",
    notas: "",
  };

  const [f, setF] = useState(emptyForm);

  useEffect(() => {
    if (prefilledPropertyId) {
      setEditing(null);
      setF({ ...emptyForm, property_id: prefilledPropertyId });
      setModalOpen(true);
      onConsumeAction?.();
    } else if (editInquilino) {
      openEdit(editInquilino);
      onConsumeAction?.();
    }
  }, [prefilledPropertyId, editInquilino]);

  const openNew = () => {
    setEditing(null);
    setF(emptyForm);
    setCreationMode("choose");
    setContractAnalysis(null);
    setContractFile(null);
    setModalOpen(true);
  };

  const openNewManual = () => {
    setCreationMode("manual");
  };

  const openNewFromContract = () => {
    setCreationMode("contract");
  };

  const handleContractUpload = async (file: File) => {
    setContractFile(file);
    setAnalyzingContract(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const { data, error } = await supabase.functions.invoke("analyze-contrato", {
        body: { imageBase64: base64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      setContractAnalysis(data as ContratoAnalysis);
      toast({ title: "Contrato analizado", description: "Se han extraído los datos. Pulsa 'Autocompletar' para rellenar el formulario." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error de análisis", description: "No se pudo analizar. Puedes rellenar manualmente.", variant: "destructive" });
    }
    setAnalyzingContract(false);
  };

  const applyContractAnalysis = () => {
    if (!contractAnalysis) return;
    const a = contractAnalysis;
    // Get first arrendatario data
    const tenant = a.arrendatarios?.[0] || {
      nombre: a.arrendatario_nombre || "",
      nif: a.arrendatario_nif || "",
      telefono: a.arrendatario_telefono || "",
      email: a.arrendatario_email || "",
    };
    const parts = (tenant.nombre || "").trim().split(/\s+/);
    const nombre = parts[0] || "";
    const apellidos = parts.slice(1).join(" ");

    // Find matching property by address
    let matchedPropertyId: string | null = f.property_id;
    if (a.direccion_inmueble || a.direccion_calle) {
      const addr = (a.direccion_inmueble || a.direccion_calle || "").toLowerCase();
      const match = properties.find(p =>
        p.nombre_interno.toLowerCase().includes(addr) ||
        (p.direccion_completa || "").toLowerCase().includes(addr) ||
        addr.includes(p.nombre_interno.toLowerCase())
      );
      if (match) matchedPropertyId = match.id;
    }

    setF(prev => ({
      ...prev,
      nombre: nombre || prev.nombre,
      apellidos: apellidos || prev.apellidos,
      dni: tenant.nif || prev.dni,
      telefono: tenant.telefono || prev.telefono,
      email: tenant.email || prev.email,
      property_id: matchedPropertyId || prev.property_id,
    }));
    setCreationMode("manual");
    toast({ title: "Datos aplicados", description: "Revisa y ajusta los campos antes de guardar." });
  };

  const openEdit = (inq: Inquilino) => {
    setEditing(inq);
    setF({
      nombre: inq.nombre || "",
      apellidos: inq.apellidos || "",
      dni: inq.dni || "",
      telefono: inq.telefono || "",
      email: inq.email || "",
      property_id: inq.property_id || "",
      estado: inq.estado || "activo",
      tipo_inquilino: inq.tipo_inquilino || "asalariado",
      rol_inquilino: inq.rol_inquilino || "inquilino",
      notas: inq.notas || "",
    });
    setModalOpen(true);
  };

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!f.nombre.trim()) return;
    setSaving(true);
    const payload = {
      ...f,
      property_id: f.property_id || null,
    };
    if (editing) {
      await onUpdate(editing.id, payload);
      setSaving(false);
      setModalOpen(false);
    } else {
      const created = await onCreate(payload);
      setSaving(false);
      setModalOpen(false);
      if (created && onLinkContrato) {
        setJustCreatedInquilino(created);
      }
    }
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return "Sin asignar";
    return properties.find((p) => p.id === propertyId)?.nombre_interno || "Vivienda desconocida";
  };

  const propertyOptions = [
    { value: "__none__", label: "Sin asignar" },
    ...properties.map((p) => ({ value: p.id, label: p.nombre_interno })),
  ];

  const handleUpdateTipo = async (id: string, tipo: string) => {
    await onUpdate(id, { tipo_inquilino: tipo } as any);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-foreground">Mis inquilinos</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => alta.openPicker()}
            className="rounded-xl gap-1.5"
            title="Dar de alta inquilino, activo o contrato"
          >
            <Sparkles size={14} /> Dar de alta
          </Button>
          <Button size="sm" onClick={openNew} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
            <Plus size={16} />
            Inquilino
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {processed.length} de {inquilinos.length} inquilino{inquilinos.length !== 1 ? "s" : ""} (incluye antiguos)
      </p>

      {/* Search + Filter/Sort toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowUpDown size={13} />
              {sortLabels[sortField]}
              <span className="text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sortLabels) as SortField[]).map(field => (
              <DropdownMenuItem key={field} onClick={() => handleSort(field)} className="text-xs gap-2">
                <span className={sortField === field ? "font-semibold" : ""}>{sortLabels[field]}</span>
                {sortField === field && <span className="text-muted-foreground ml-auto">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Estado filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filterEstado ? "default" : "outline"} size="sm" className="gap-1.5 text-xs">
              Estado
              {filterEstado && <span className="font-normal">: {ESTADOS.find(e => e.value === filterEstado)?.label}</span>}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterEstado(null)} className="text-xs">Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {ESTADOS.map(e => (
              <DropdownMenuItem key={e.value} onClick={() => setFilterEstado(e.value)} className="text-xs gap-2">
                <span className={`w-2 h-2 rounded-full ${statusStyle[e.value]?.split(" ")[0] || "bg-zinc-200"}`} />
                {e.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Activo filter */}
        {uniqueViviendas.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={filterVivienda ? "default" : "outline"} size="sm" className="gap-1.5 text-xs">
                Activo
                {filterVivienda && <span className="font-normal">: {properties.find(p => p.id === filterVivienda)?.nombre_interno}</span>}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilterVivienda(null)} className="text-xs">Todas</DropdownMenuItem>
              <DropdownMenuSeparator />
              {uniqueViviendas.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => setFilterVivienda(p.id)} className="text-xs">
                  {p.nombre_interno}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 text-muted-foreground">
            <X size={12} /> Limpiar ({activeFilterCount})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-5 shadow-sm animate-pulse h-24" />
          ))}
        </div>
      ) : processed.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground text-sm">
            {activeFilterCount > 0 ? "No hay inquilinos con estos filtros" : "No tienes inquilinos registrados aún."}
          </p>
          {activeFilterCount > 0 ? (
            <Button size="sm" onClick={clearFilters} className="mt-4 rounded-xl gap-1.5 text-xs" variant="outline">
              <X size={14} /> Limpiar filtros
            </Button>
          ) : (
            <Button size="sm" onClick={openNew} className="mt-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
              <Plus size={16} /> Añadir tu primer inquilino
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {(() => {
            // Group by property_id
            const groups = new Map<string | null, typeof processed>();
            for (const inq of processed) {
              const key = inq.property_id || null;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(inq);
            }
            // Sort groups: properties first (alphabetically), then unassigned
            const sortedKeys = [...groups.keys()].sort((a, b) => {
              if (!a) return 1;
              if (!b) return -1;
              const na = properties.find(p => p.id === a)?.nombre_interno || "";
              const nb = properties.find(p => p.id === b)?.nombre_interno || "";
              return na.localeCompare(nb);
            });

            return sortedKeys.map(propertyId => {
              const groupInqs = [...groups.get(propertyId)!].sort((a, b) => {
                const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
                const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
                if (oa !== ob) return oa - ob;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              });
              const prop = propertyId ? properties.find(p => p.id === propertyId) : null;
              const propName = prop?.nombre_interno || "Sin vivienda asignada";
              // Show shared rent once per group — resolved from contract (or legacy fallback)
              const groupRent = propertyId ? resolveRentaEsperada(propertyId, inquilinos, contratos) : null;

              return (
                <div key={propertyId || "__none__"} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  {/* Group header */}
                  <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home size={14} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">{propName}</span>
                      <span className="text-xs text-muted-foreground">({groupInqs.length} {groupInqs.length === 1 ? "persona" : "personas"})</span>
                    </div>
                    {groupRent && (
                      <span className="text-sm font-medium text-foreground">
                        {groupRent} €<span className="text-xs text-muted-foreground">/mes</span>
                      </span>
                    )}
                  </div>
                  {/* Tenants in group */}
                  <div className="divide-y divide-border">
                    {groupInqs.map((inq, idx) => {
                      const st = statusStyle[inq.estado || "activo"] || statusStyle.activo;
                      const move = async (dir: -1 | 1) => {
                        if (!onReorder) return;
                        const newOrder = [...groupInqs];
                        const j = idx + dir;
                        if (j < 0 || j >= newOrder.length) return;
                        [newOrder[idx], newOrder[j]] = [newOrder[j], newOrder[idx]];
                        await onReorder(newOrder.map(x => x.id));
                      };
                      return (
                        <div
                          key={inq.id}
                          className="px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer"
                          onClick={() => setDetailInquilino(inq)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            {onReorder && groupInqs.length > 1 && (
                              <div className="flex flex-col gap-0.5 shrink-0 -ml-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost" size="icon" className="h-5 w-7"
                                  disabled={idx === 0}
                                  onClick={() => move(-1)}
                                  aria-label="Subir"
                                  title="Subir"
                                >
                                  <ChevronUp size={14} />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-5 w-7"
                                  disabled={idx === groupInqs.length - 1}
                                  onClick={() => move(1)}
                                  aria-label="Bajar"
                                  title="Bajar"
                                >
                                  <ChevronDown size={14} />
                                </Button>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-0.5">
                                <User size={14} className="text-muted-foreground shrink-0" />
                                <h3 className="text-sm font-semibold text-foreground">
                                  {inq.nombre} {inq.apellidos}
                                </h3>
                                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${st}`}>
                                  {inq.estado || "activo"}
                                </span>
                                {inq.auth_user_id ? (
                                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1" title="Cuenta vinculada">
                                    <UserCheck size={11} /> Vinculado
                                  </span>
                                ) : inq.email ? (
                                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1" title="Pendiente de registro">
                                    <LinkIcon size={11} /> Pendiente
                                  </span>
                                ) : null}
                                {inq.rol_inquilino === "avalista" && (
                                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                    Avalista
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                                {inq.telefono && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={11} />
                                    {inq.telefono}
                                  </span>
                                )}
                                {inq.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail size={11} />
                                    {inq.email}
                                  </span>
                                )}
                                {inq.dni && (
                                  <span className="text-muted-foreground">DNI: {inq.dni}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(inq)}>
                                <Pencil size={15} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive">
                                    <Trash2 size={15} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar a {inq.nombre}?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(inq.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar inquilino" : "Nuevo inquilino"}</DialogTitle>
          </DialogHeader>

          {/* Step 1: Choose mode (only for new) */}
          {!editing && creationMode === "choose" && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground text-center">¿Cómo quieres añadir al inquilino?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openNewFromContract}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <ScrollText size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Desde contrato</p>
                    <p className="text-xs text-muted-foreground mt-1">Sube el contrato y la IA extrae los datos automáticamente</p>
                  </div>
                </button>
                <button
                  onClick={openNewManual}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Manualmente</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Rellena los datos del inquilino a mano</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Contract upload + analysis */}
          {!editing && creationMode === "contract" && (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-2">
                <FileText size={32} className="mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Sube el contrato de arrendamiento</p>
                <p className="text-xs text-muted-foreground">PDF, imagen o Word (.doc, .docx)</p>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => contractInputRef.current?.click()}
                disabled={analyzingContract}
              >
                {analyzingContract ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {analyzingContract ? "Analizando contrato…" : contractFile ? contractFile.name : "Seleccionar archivo"}
              </Button>
              <input
                ref={contractInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleContractUpload(file);
                  e.target.value = "";
                }}
              />

              {contractAnalysis && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Datos extraídos correctamente</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {contractAnalysis.arrendatario_nombre || contractAnalysis.arrendatarios?.[0]?.nombre || "Inquilino detectado"}
                        {contractAnalysis.renta_mensual ? ` · ${contractAnalysis.renta_mensual} €/mes` : ""}
                      </p>
                    </div>
                  </div>
                  <Button onClick={applyContractAnalysis} className="w-full gap-2">
                    <Sparkles size={14} /> Autocompletar datos del inquilino
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setCreationMode("choose")}>Volver</Button>
                <Button variant="outline" size="sm" onClick={() => { setCreationMode("manual"); }}>
                  Rellenar manualmente
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Manual form (also used after autocomplete) */}
          {(editing || creationMode === "manual") && (
            <div className="space-y-4 pt-2">
              {/* Contract upload section in manual mode (for new tenants only) */}
              {!editing && !contractAnalysis && (
                <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ScrollText size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">¿Tienes el contrato de arrendamiento?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 flex-1"
                      onClick={() => contractInputRef.current?.click()}
                      disabled={analyzingContract}
                    >
                      {analyzingContract ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      {analyzingContract ? "Analizando…" : "Subir contrato"}
                    </Button>
                    <input
                      ref={contractInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleContractUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">La IA extraerá los datos automáticamente para autocompletar.</p>
                </div>
              )}

              {/* Analysis result banner */}
              {!editing && contractAnalysis && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium flex-1">Datos autocompletados desde el contrato</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={applyContractAnalysis}>
                    <Sparkles size={10} className="mr-1" /> Re-aplicar
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <TextField label="Nombre *" value={f.nombre} onChange={(v) => set("nombre", v)} placeholder="Juan" />
                <TextField label="Apellidos" value={f.apellidos} onChange={(v) => set("apellidos", v)} placeholder="García López" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField label="DNI / NIE" value={f.dni} onChange={(v) => set("dni", v)} placeholder="12345678A" />
                <TextField label="Teléfono" value={f.telefono} onChange={(v) => set("telefono", v)} placeholder="612345678" />
              </div>
              <TextField label="Email" value={f.email} onChange={(v) => set("email", v)} placeholder="inquilino@email.com" />
              {!editing && f.email && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <Info size={14} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    El inquilino podrá acceder a su portal registrándose en <strong className="text-foreground">CapitalRent</strong> con este mismo email. 
                    Allí podrá ver documentos, reportar incidencias y confirmar pagos.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Vivienda asignada"
                  value={f.property_id || "__none__"}
                  onChange={(v) => set("property_id", v === "__none__" ? null : v)}
                  options={propertyOptions}
                />
                <SelectField
                  label="Rol"
                  value={f.rol_inquilino}
                  onChange={(v) => set("rol_inquilino", v)}
                  options={[
                    { value: "inquilino", label: "Inquilino" },
                    { value: "avalista", label: "Avalista" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Tipo de inquilino"
                  value={f.tipo_inquilino}
                  onChange={(v) => set("tipo_inquilino", v)}
                  options={TIPOS}
                />
                <SelectField
                  label="Estado"
                  value={f.estado}
                  onChange={(v) => set("estado", v)}
                  options={ESTADOS}
                />
              </div>
              

              
              <Field label="Notas">
                <Textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Observaciones..." className="rounded-xl text-sm" rows={3} />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                {!editing && (
                  <Button variant="ghost" size="sm" onClick={() => setCreationMode("choose")}>Volver</Button>
                )}
                <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleSave} disabled={!f.nombre.trim() || saving} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear inquilino"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Panel */}
      <InquilinoDetailPanel
        inquilino={detailInquilino}
        properties={properties}
        incidencias={incidencias}
        contratos={contratos}
        open={!!detailInquilino}
        onClose={() => setDetailInquilino(null)}
        onEdit={(inq) => {
          setDetailInquilino(null);
          openEdit(inq);
        }}
        fetchDocumentos={fetchDocumentos}
        uploadDocumento={uploadDocumento}
        deleteDocumento={deleteDocumento}
        onUpdateTipo={handleUpdateTipo}
      />

      {/* Post-creation: offer to link contract */}
      <Dialog open={!!justCreatedInquilino} onOpenChange={(open) => { if (!open) setJustCreatedInquilino(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inquilino creado ✓</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{justCreatedInquilino?.nombre} {justCreatedInquilino?.apellidos || ""}</strong> se ha registrado correctamente. ¿Quieres vincular un contrato de arrendamiento?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setJustCreatedInquilino(null)} className="rounded-xl">
              Ahora no
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              onClick={() => {
                const inq = justCreatedInquilino;
                setJustCreatedInquilino(null);
                if (inq && onLinkContrato) onLinkContrato(inq);
              }}
            >
              <ScrollText size={14} />
              Vincular contrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default InquilinosSection;
