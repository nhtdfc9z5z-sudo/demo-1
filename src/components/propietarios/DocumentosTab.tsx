import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Search, FileText, FileImage, FileType2, MoreVertical,
  Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw, Download, Trash2,
  Pencil, Link2, X, Filter, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useDocumentos, getDocumentoSignedUrl,
  type Documento, type DocumentoEntidad, type DocumentoOcrStatus,
} from "@/hooks/useDocumentos";
import { useProperties } from "@/hooks/useProperties";
import { useContratos } from "@/hooks/useContratos";
import { useIncidencias } from "@/hooks/useIncidencias";
import { useInquilinos } from "@/hooks/useInquilinos";

const CATEGORIAS = [
  { value: "general", label: "General" },
  { value: "contrato", label: "Contrato" },
  { value: "factura", label: "Factura" },
  { value: "gasto", label: "Gasto" },
  { value: "incidencia", label: "Incidencia" },
  { value: "inquilino", label: "Inquilino" },
  { value: "activo", label: "Activo" },
  { value: "fiscal", label: "Fiscal" },
  { value: "seguro_hogar", label: "Seguro hogar" },
  { value: "seguro_impago", label: "Seguro impago" },
  { value: "cee", label: "Certificado energético" },
  { value: "ibi", label: "IBI" },
  { value: "comunidad", label: "Comunidad" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otros", label: "Otros" },
];

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/jpg,image/png,image/webp";

function humanSize(n?: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mime?: string | null) {
  if (!mime) return FileType2;
  if (mime.startsWith("image/")) return FileImage;
  if (mime === "application/pdf") return FileText;
  return FileType2;
}

const ocrChip: Record<DocumentoOcrStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground", icon: Clock },
  processing: { label: "Procesando", cls: "bg-blue-100/70 text-blue-700", icon: Loader2 },
  ok: { label: "OCR ok", cls: "bg-emerald-100/70 text-emerald-700", icon: CheckCircle2 },
  error: { label: "Error", cls: "bg-red-100/70 text-red-700", icon: AlertCircle },
  skipped: { label: "No aplicable", cls: "bg-amber-100/70 text-amber-700", icon: AlertCircle },
};

export default function DocumentosTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [ocrStatus, setOcrStatus] = useState<DocumentoOcrStatus | "all">("all");
  const [categoria, setCategoria] = useState<string>("all");
  const [entidadTipo, setEntidadTipo] = useState<DocumentoEntidad | "all">("all");
  const [entidadId, setEntidadId] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { properties } = useProperties();
  const { contratos } = useContratos();
  const { incidencias } = useIncidencias();
  const { inquilinos } = useInquilinos();

  const {
    documentos, vinculos, loading,
    upload, rename, changeCategoria, retryOcr, remove, linkEntidad, unlinkEntidad, updateMeta,
  } = useDocumentos({
    query: search,
    ocrStatus,
    categoria,
    entidadTipo,
    entidadId: entidadId || null,
  });

  const vinculosByDoc = useMemo(() => {
    const m = new Map<string, { tipo: DocumentoEntidad; id: string }[]>();
    for (const v of vinculos) {
      const arr = m.get(v.documento_id) || [];
      arr.push({ tipo: v.entidad_tipo, id: v.entidad_id });
      m.set(v.documento_id, arr);
    }
    return m;
  }, [vinculos]);

  const nameForEntidad = (tipo: DocumentoEntidad, id: string): string => {
    switch (tipo) {
      case "activo": return properties.find(p => p.id === id)?.nombre_interno || "Activo";
      case "contrato": return contratos.find(c => c.id === id)?.titulo || "Contrato";
      case "incidencia": {
        const i = incidencias.find(x => x.id === id);
        return i ? `Incidencia #${i.numero_incidencia}` : "Incidencia";
      }
      case "inquilino": return inquilinos.find(i => i.id === id)?.nombre || "Inquilino";
      case "factura": return "Factura";
      case "gasto": return "Gasto";
    }
  };

  // ---- Upload handlers
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > MAX_BYTES) {
        toast({ title: `${file.name} es demasiado grande`, description: "Máximo 20 MB", variant: "destructive" });
        continue;
      }
      const mime = (file.type || "").toLowerCase();
      if (!ACCEPT.split(",").includes(mime)) {
        toast({ title: `${file.name} no soportado`, description: "Sólo PDF, JPG, PNG o WEBP", variant: "destructive" });
        continue;
      }
      setUploadingCount(c => c + 1);
      try {
        await upload.mutateAsync({ file });
      } finally {
        setUploadingCount(c => Math.max(0, c - 1));
      }
    }
  };

  // ---- Dialogs
  const [renaming, setRenaming] = useState<Documento | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [linking, setLinking] = useState<Documento | null>(null);
  const [editingMeta, setEditingMeta] = useState<Documento | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Sube PDFs e imágenes. El texto se extrae automáticamente y puedes buscar por su contenido.
        </p>
      </header>

      {/* Dropzone */}
      <section
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/[0.04]" : "border-border bg-card"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.currentTarget.value = ""; }}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Upload size={22} />
          </div>
          <p className="text-sm font-medium text-foreground">Arrastra aquí o pulsa para subir</p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP · hasta 20 MB por archivo</p>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploadingCount > 0}
            size="sm"
            className="mt-2 rounded-lg gap-1.5"
          >
            {uploadingCount > 0 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingCount > 0 ? `Subiendo ${uploadingCount}…` : "Seleccionar archivos"}
          </Button>
        </div>
      </section>

      {/* Search + filters */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o contenido OCR…"
              className="pl-9 h-11 rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(v => !v)}
            className="rounded-xl h-11 gap-1.5"
          >
            <Filter size={16} /> Filtros
          </Button>
        </div>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                <Select value={ocrStatus} onValueChange={(v) => setOcrStatus(v as any)}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Estado OCR" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier estado</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="processing">Procesando</SelectItem>
                    <SelectItem value="ok">OCR ok</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="skipped">No aplicable</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier categoría</SelectItem>
                    {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={entidadTipo} onValueChange={(v) => { setEntidadTipo(v as any); setEntidadId(""); }}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Vinculado a" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier vínculo</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="incidencia">Incidencia</SelectItem>
                    <SelectItem value="inquilino">Inquilino</SelectItem>
                  </SelectContent>
                </Select>
                {entidadTipo !== "all" && (
                  <Select value={entidadId} onValueChange={setEntidadId}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      {entidadTipo === "activo" && properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                      ))}
                      {entidadTipo === "contrato" && contratos.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.titulo || "Contrato"}</SelectItem>
                      ))}
                      {entidadTipo === "incidencia" && incidencias.map(i => (
                        <SelectItem key={i.id} value={i.id}>#{i.numero_incidencia} · {i.concepto || "Sin concepto"}</SelectItem>
                      ))}
                      {entidadTipo === "inquilino" && inquilinos.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* List */}
      <section className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : documentos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <FileText size={28} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Sin documentos todavía</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || ocrStatus !== "all" || categoria !== "all" || entidadTipo !== "all"
                ? "Prueba a quitar algún filtro o ajustar la búsqueda."
                : "Sube tu primer PDF o foto para empezar a buscar por contenido."}
            </p>
          </div>
        ) : (
          documentos.map((doc) => {
            const Icon = fileIcon(doc.mime_type);
            const chip = ocrChip[doc.ocr_status];
            const ChipIcon = chip.icon;
            const docVins = vinculosByDoc.get(doc.id) || [];
            return (
              <div
                key={doc.id}
                className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-card border border-border hover:shadow-sm transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{doc.nombre}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center shrink-0" aria-label="Acciones">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={async () => {
                          try {
                            const url = await getDocumentoSignedUrl(doc);
                            window.open(url, "_blank", "noopener");
                          } catch (e: any) {
                            toast({ title: "No se pudo abrir", description: e?.message, variant: "destructive" });
                          }
                        }}>
                          <Download size={14} className="mr-2" /> Ver / descargar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenaming(doc); setRenameValue(doc.nombre); }}>
                          <Pencil size={14} className="mr-2" /> Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingMeta(doc)}>
                          <CalendarClock size={14} className="mr-2" /> Fechas y revisión
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLinking(doc)}>
                          <Link2 size={14} className="mr-2" /> Vincular…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">Categoría</div>
                        {CATEGORIAS.map(c => (
                          <DropdownMenuItem
                            key={c.value}
                            onClick={() => changeCategoria.mutate({ id: doc.id, categoria: c.value })}
                            className={doc.categoria === c.value ? "font-semibold" : ""}
                          >
                            {c.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => retryOcr.mutate(doc.id)}
                          disabled={doc.ocr_status === "processing"}
                        >
                          <RefreshCw size={14} className="mr-2" /> Reintentar OCR
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) {
                              remove.mutate(doc);
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 size={14} className="mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                    <Badge variant="outline" className="rounded-md text-[10px] font-normal">
                      {CATEGORIAS.find(c => c.value === doc.categoria)?.label || doc.categoria}
                    </Badge>
                    <span>·</span>
                    <span>{humanSize(doc.size_bytes)}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("es-ES")}</span>
                    <span>·</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${chip.cls}`}>
                      <ChipIcon size={10} className={doc.ocr_status === "processing" ? "animate-spin" : ""} />
                      {chip.label}
                    </span>
                    {doc.fecha_vencimiento && (
                      <>
                        <span>·</span>
                        <VencimientoChip fecha={doc.fecha_vencimiento} />
                      </>
                    )}
                  </div>

                  {docVins.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {docVins.map((v) => (
                        <span
                          key={`${v.tipo}-${v.id}`}
                          className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]"
                        >
                          <Link2 size={10} />
                          <span className="capitalize">{v.tipo}:</span> {nameForEntidad(v.tipo, v.id)}
                          <button
                            onClick={() => unlinkEntidad.mutate({ documento_id: doc.id, entidad_tipo: v.tipo, entidad_id: v.id })}
                            className="opacity-60 hover:opacity-100"
                            aria-label="Quitar vínculo"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {doc.ocr_status === "error" && doc.ocr_error && (
                    <p className="mt-2 text-[11px] text-red-700 bg-red-50/60 rounded-md px-2 py-1">
                      {doc.ocr_error}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Renombrar documento</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (renaming && renameValue.trim()) {
                  await rename.mutateAsync({ id: renaming.id, nombre: renameValue.trim() });
                  setRenaming(null);
                }
              }}
            >Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link dialog */}
      <Dialog open={!!linking} onOpenChange={(o) => !o && setLinking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vincular documento</DialogTitle></DialogHeader>
          <LinkForm
            doc={linking}
            properties={properties}
            contratos={contratos}
            incidencias={incidencias}
            inquilinos={inquilinos}
            onSubmit={async (tipo, id) => {
              if (linking) {
                await linkEntidad.mutateAsync({ documento_id: linking.id, entidad_tipo: tipo, entidad_id: id });
                setLinking(null);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Meta (fechas/revisión) dialog */}
      <Dialog open={!!editingMeta} onOpenChange={(o) => !o && setEditingMeta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Fechas y revisión</DialogTitle></DialogHeader>
          {editingMeta && (
            <MetaForm
              doc={editingMeta}
              onSubmit={async (patch) => {
                await updateMeta.mutateAsync({ id: editingMeta.id, ...patch });
                setEditingMeta(null);
              }}
              onCancel={() => setEditingMeta(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function VencimientoChip({ fecha }: { fecha: string }) {
  const [y, m, d] = fecha.split("-").map(Number);
  const venc = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = Date.UTC(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const dias = Math.floor((t1 - t0) / 86400000);
  let cls = "bg-muted text-muted-foreground";
  let txt = `Vence ${venc.toLocaleDateString("es-ES")}`;
  if (dias < 0) { cls = "bg-red-100/70 text-red-700"; txt = `Vencido hace ${-dias}d`; }
  else if (dias <= 30) { cls = "bg-amber-100/70 text-amber-700"; txt = `Vence en ${dias}d`; }
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${cls}`}><CalendarClock size={10} />{txt}</span>;
}

function MetaForm({
  doc, onSubmit, onCancel,
}: {
  doc: Documento;
  onSubmit: (patch: {
    fecha_documento?: string | null;
    fecha_vencimiento?: string | null;
    requiere_revision?: boolean;
    recordatorio_dias_antes?: number | null;
    estado_revision?: "pendiente" | "revisado" | "caducado";
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [fechaDoc, setFechaDoc] = useState(doc.fecha_documento || "");
  const [fechaVenc, setFechaVenc] = useState(doc.fecha_vencimiento || "");
  const [requiere, setRequiere] = useState<boolean>(doc.requiere_revision);
  const [dias, setDias] = useState<string>(doc.recordatorio_dias_antes?.toString() || "");
  const [estado, setEstado] = useState<"pendiente" | "revisado" | "caducado">(doc.estado_revision || "pendiente");

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground truncate">{doc.nombre}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Fecha del documento</span>
          <Input type="date" value={fechaDoc} onChange={(e) => setFechaDoc(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Fecha de vencimiento</span>
          <Input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requiere}
          onChange={(e) => setRequiere(e.target.checked)}
          className="h-4 w-4"
        />
        Requiere revisión
      </label>
      <label className="space-y-1 text-xs block">
        <span className="text-muted-foreground">Recordar antes (días)</span>
        <Input
          type="number" min={0} max={365}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          placeholder="Ej. 30"
        />
      </label>
      <label className="space-y-1 text-xs block">
        <span className="text-muted-foreground">Estado de revisión</span>
        <Select value={estado} onValueChange={(v) => setEstado(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="revisado">Revisado</SelectItem>
            <SelectItem value="caducado">Caducado</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() =>
            onSubmit({
              fecha_documento: fechaDoc || null,
              fecha_vencimiento: fechaVenc || null,
              requiere_revision: requiere,
              recordatorio_dias_antes: dias.trim() === "" ? null : Math.max(0, parseInt(dias, 10) || 0),
              estado_revision: estado,
            })
          }
        >Guardar</Button>
      </DialogFooter>
    </div>
  );
}

function LinkForm({
  doc, properties, contratos, incidencias, inquilinos, onSubmit,
}: {
  doc: Documento | null;
  properties: ReturnType<typeof useProperties>["properties"];
  contratos: ReturnType<typeof useContratos>["contratos"];
  incidencias: ReturnType<typeof useIncidencias>["incidencias"];
  inquilinos: ReturnType<typeof useInquilinos>["inquilinos"];
  onSubmit: (tipo: DocumentoEntidad, id: string) => void;
}) {
  const [tipo, setTipo] = useState<DocumentoEntidad>("activo");
  const [id, setId] = useState<string>("");
  if (!doc) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">{doc.nombre}</div>
      <Select value={tipo} onValueChange={(v) => { setTipo(v as DocumentoEntidad); setId(""); }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="activo">Activo</SelectItem>
          <SelectItem value="contrato">Contrato</SelectItem>
          <SelectItem value="incidencia">Incidencia</SelectItem>
          <SelectItem value="inquilino">Inquilino</SelectItem>
        </SelectContent>
      </Select>
      <Select value={id} onValueChange={setId}>
        <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
        <SelectContent>
          {tipo === "activo" && properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>)}
          {tipo === "contrato" && contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.titulo || "Contrato"}</SelectItem>)}
          {tipo === "incidencia" && incidencias.map(i => <SelectItem key={i.id} value={i.id}>#{i.numero_incidencia} · {i.concepto || "Sin concepto"}</SelectItem>)}
          {tipo === "inquilino" && inquilinos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button disabled={!id} onClick={() => onSubmit(tipo, id)}>Vincular</Button>
      </DialogFooter>
    </div>
  );
}