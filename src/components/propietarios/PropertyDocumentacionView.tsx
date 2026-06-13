import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Trash2, Download, Upload, ScrollText, Receipt, Shield, Leaf, Package, Home, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/hooks/useProperties";
import type { Contrato } from "@/hooks/useContratos";
import { SecureFileLink } from "@/components/common/SecureFileLink";
import {
  type DocUnificado,
  type DocCategoria,
  DOC_CATEGORIAS,
  UPLOAD_CATEGORIES,
  getCategoriaLabel,
  sortDocsByDate,
  countByCategoria,
  fromPropertyDoc,
  fromFactura,
  fromContrato,
  fromIncidenciaDoc,
  fromIncidenciaEvidencia,
  fromInquilinoDoc,
  fromFianza,
} from "@/lib/documentModel";

interface Props {
  property: Property;
  contratos?: Contrato[];
  onBack: () => void;
}

// Icon mapping from string keys in DOC_CATEGORIAS to actual components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  ScrollText, Receipt, Shield, Leaf, Package, Home, FileText,
};

const getIcon = (cat: DocCategoria) => {
  const iconName = DOC_CATEGORIAS[cat]?.icon ?? "FileText";
  return ICON_MAP[iconName] ?? FileText;
};

// Filter chip definitions — derived from central model
const FILTER_CHIPS = [
  { value: "all" as const, label: "Todas las categorías", icon: FileText },
  ...Object.entries(DOC_CATEGORIAS).map(([key, val]) => ({
    value: key as DocCategoria,
    label: val.label,
    icon: ICON_MAP[val.icon] ?? FileText,
  })),
];

const PropertyDocumentacionView = ({ property, contratos, onBack }: Props) => {
  const [docs, setDocs] = useState<DocUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<"all" | DocCategoria>("all");
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState("contrato");
  const [customCat, setCustomCat] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadDocs = async () => {
    setLoading(true);
    const allDocs: DocUnificado[] = [];

    // Property documents
    const { data: propDocs } = await supabase
      .from("property_documentos")
      .select("id, nombre_archivo, url, storage_path, created_at, categoria")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false });

    if (propDocs) {
      allDocs.push(...propDocs.map(fromPropertyDoc));
    }

    // Facturas
    const { data: facturas } = await supabase
      .from("facturas")
      .select("id, archivo_nombre, archivo_url, storage_path, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false });

    if (facturas) {
      allDocs.push(...facturas.map(fromFactura));
    }

    // Contratos with files
    if (contratos) {
      for (const c of contratos) {
        const doc = fromContrato(c);
        if (doc) allDocs.push(doc);
      }
    }

    // Incidencia documents for this property
    const { data: incidencias } = await supabase
      .from("incidencias")
      .select("id")
      .eq("property_id", property.id);

    if (incidencias && incidencias.length > 0) {
      const incIds = incidencias.map(i => i.id);
      const { data: incDocs } = await supabase
        .from("incidencia_documentos")
        .select("id, nombre_archivo, url, storage_path, created_at, categoria")
        .in("incidencia_id", incIds)
        .order("created_at", { ascending: false });

      if (incDocs) {
        allDocs.push(...incDocs.map(fromIncidenciaDoc));
      }

      const { data: incEvidencias } = await supabase
        .from("incidencia_evidencias")
        .select("id, nombre_archivo, url, storage_path, created_at")
        .in("incidencia_id", incIds)
        .order("created_at", { ascending: false });

      if (incEvidencias) {
        allDocs.push(...incEvidencias.map(fromIncidenciaEvidencia));
      }
    }

    // Inquilino documents
    const { data: propInquilinos } = await supabase
      .from("inquilinos")
      .select("id")
      .eq("property_id", property.id);

    if (propInquilinos && propInquilinos.length > 0) {
      const inqIds = propInquilinos.map(i => i.id);
      const { data: inqDocs } = await supabase
        .from("inquilino_documentos")
        .select("id, nombre_archivo, url, storage_path, created_at, categoria")
        .in("inquilino_id", inqIds)
        .order("created_at", { ascending: false });

      if (inqDocs) {
        allDocs.push(...inqDocs.map(fromInquilinoDoc));
      }
    }

    // Fianza justificantes
    const { data: fianzas } = await supabase
      .from("fianzas")
      .select("id, justificante_url, justificante_path, created_at, numero_expediente")
      .eq("property_id", property.id)
      .not("justificante_url", "is", null);

    if (fianzas) {
      for (const f of fianzas) {
        const doc = fromFianza(f);
        if (doc) allDocs.push(doc);
      }
    }

    setDocs(sortDocsByDate(allDocs));
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [property.id]);

  const filtered = filterCat === "all" ? docs : docs.filter(d => d.categoria === filterCat);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Archivo demasiado grande", description: "Máximo 10 MB", variant: "destructive" });
      return;
    }

    const finalCat = uploadCat === "_custom" ? (customCat.trim() || "otro") : uploadCat;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${property.id}/${finalCat}_${Date.now()}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("inquilino-documentos")
      .upload(path, file);

    if (storageError) {
      toast({ title: "Error al subir", description: storageError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from("inquilino-documentos")
      .createSignedUrl(path, 3600);

    const { error: dbError } = await supabase.from("property_documentos").insert({
      property_id: property.id,
      user_id: user.id,
      nombre_archivo: file.name,
      storage_path: path,
      url: urlData?.signedUrl || "",
      categoria: finalCat,
    });

    if (dbError) {
      toast({ title: "Error al guardar", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "Documento subido" });
      await loadDocs();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (doc: DocUnificado) => {
    if (!doc.deletable) {
      toast({ title: "No se puede eliminar", description: "Este documento se gestiona desde su sección original.", variant: "destructive" });
      return;
    }
    await supabase.storage.from("inquilino-documentos").remove([doc.storage_path]);
    await supabase.from("property_documentos").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    toast({ title: "Documento eliminado" });
  };

  const catCounts = countByCategoria(docs);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a propiedades
      </button>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">{property.nombre_interno}</h2>
        <p className="text-sm text-muted-foreground">Toda la documentación asociada a esta vivienda</p>
      </div>

      {/* Upload */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Upload size={15} className="text-primary" /> Subir documento
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <Select value={uploadCat} onValueChange={(v) => { setUploadCat(v); if (v !== "_custom") setCustomCat(""); }}>
            <SelectTrigger className="h-9 rounded-lg text-sm sm:max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UPLOAD_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {uploadCat === "_custom" && (
            <Input
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              placeholder="Nombre de la categoría..."
              className="h-9 text-sm sm:max-w-[200px]"
            />
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={handleUpload} className="hidden" id="prop-doc-upload" />
          <Button variant="outline" size="sm" className="gap-2" disabled={uploading || (uploadCat === "_custom" && !customCat.trim())} onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} />
            {uploading ? "Subiendo..." : "Seleccionar archivo"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">PDF, imágenes o Word · máx. 10 MB</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTER_CHIPS.filter(c => c.value === "all" || catCounts[c.value]).map(c => {
          const Icon = c.icon;
          const isActive = filterCat === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setFilterCat(c.value)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              <Icon size={12} />
              {c.label}
              {c.value !== "all" && catCounts[c.value] && (
                <span className={`text-[10px] font-medium ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  ({catCounts[c.value]})
                </span>
              )}
              {c.value === "all" && (
                <span className={`text-[10px] font-medium ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  ({docs.length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
          <Search size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{filterCat === "all" ? "No hay documentos para esta vivienda." : `No hay documentos de tipo "${getCategoriaLabel(filterCat)}".`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const Icon = getIcon(doc.categoria);
            return (
              <div key={`${doc.source}-${doc.id}`} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.nombre_archivo}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{getCategoriaLabel(doc.categoria)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("es-ES")}</span>
                  </div>
                </div>
                <SecureFileLink
                  bucket={doc.bucket}
                  path={doc.storage_path}
                  fallbackUrl={doc.url}
                  className="text-primary hover:text-primary/80 shrink-0"
                >
                  <Download size={15} />
                </SecureFileLink>
                {doc.deletable && (
                  <button onClick={() => handleDelete(doc)} className="text-destructive hover:text-destructive/80 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PropertyDocumentacionView;
