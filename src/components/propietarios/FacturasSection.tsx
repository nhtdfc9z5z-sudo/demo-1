import { useState, useRef } from "react";
import { Upload, Loader2, Trash2, ExternalLink, Filter, Receipt, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useFacturas, type Factura } from "@/hooks/useFacturas";
import { TIPOS_GASTO } from "@/components/propietarios/FacturaFormFields";
import FacturaUploadDialog from "./FacturaUploadDialog";
import type { Property } from "@/hooks/useProperties";
import { SecureFileLink } from "@/components/common/SecureFileLink";

function formatImporte(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "€";
}

const catColor: Record<string, string> = {
  suministros: "bg-teal-100 text-teal-800",
  reparacion: "bg-orange-100 text-orange-800",
  comunidad: "bg-sky-100 text-sky-800",
  ibi: "bg-amber-100 text-amber-800",
  basuras: "bg-lime-100 text-lime-800",
  seguro: "bg-violet-100 text-violet-800",
  intereses_hipoteca: "bg-rose-100 text-rose-800",
  honorarios: "bg-cyan-100 text-cyan-800",
  gestion_inmobiliaria: "bg-indigo-100 text-indigo-800",
  otro: "bg-zinc-100 text-zinc-700",
};

interface FacturasSectionProps {
  properties: Property[];
  onBack: () => void;
}

const FacturasSection = ({ properties, onBack }: FacturasSectionProps) => {
  const { facturas, loading, uploadAndAnalyze, updateFactura, deleteFactura, refetch } = useFacturas();
  const [uploading, setUploading] = useState(false);
  const [filterProp, setFilterProp] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    toast.info(`Subiendo y analizando "${file.name}"...`);
    const result = await uploadAndAnalyze(file);
    if (result) {
      const fields = [result.emisor_nombre, result.numero_factura, result.total].filter(Boolean).length;
      toast.success(`Factura guardada. ${fields} campos detectados por OCR.`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = facturas.filter(f => {
    if (filterProp !== "all" && f.property_id !== filterProp) return false;
    if (filterCat !== "all" && f.categoria !== filterCat) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1 transition-colors"><ArrowLeft size={16} /> Volver a documentación</button>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Receipt size={20} className="text-primary" />
            Facturas
          </h2>
        </div>
        <Button onClick={() => setShowUploadDialog(true)} size="sm" className="gap-1.5">
          <Plus size={15} />
          Nueva factura
        </Button>
      </div>

      <FacturaUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        properties={properties}
        onSuccess={refetch}
      />

      <p className="text-xs text-muted-foreground mb-4">
        Sube facturas en PDF o imagen. Se analizan automáticamente con OCR para extraer emisor, importe, fecha y más.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={filterProp} onValueChange={setFilterProp}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="Activo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los activos</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <Filter size={12} className="mr-1" />
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {TIPOS_GASTO.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Receipt size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {facturas.length === 0 ? "No hay facturas. Sube tu primera factura." : "No hay facturas con estos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const propName = properties.find(p => p.id === f.property_id)?.nombre_interno;
            return (
              <div key={f.id} className="bg-card rounded-xl border border-border px-4 py-3 hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {f.emisor_nombre || f.archivo_nombre}
                      </span>
                      <Badge variant="secondary" className={`text-[9px] ${catColor[f.categoria || "otro"] || catColor.otro}`}>
                        {TIPOS_GASTO.find(c => c.value === f.categoria)?.label || "Otro"}
                      </Badge>
                      {f.numero_factura && (
                        <span className="text-[10px] text-muted-foreground">Nº {f.numero_factura}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {f.fecha && <span>{new Date(f.fecha).toLocaleDateString("es-ES")}</span>}
                      {f.emisor_nif && <span>NIF: {f.emisor_nif}</span>}
                      {propName && <span>· {propName}</span>}
                      {!propName && f.property_id === null && (
                        <Select
                          value=""
                          onValueChange={(val) => updateFactura(f.id, { property_id: val } as any)}
                        >
                          <SelectTrigger className="h-5 text-[10px] w-[120px] border-dashed">
                            <SelectValue placeholder="Asignar vivienda" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {formatImporte(f.total)}
                    </span>
                    <div className="flex gap-1">
                      <SecureFileLink
                        bucket="facturas"
                        path={(f as any).storage_path}
                        fallbackUrl={f.archivo_url}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                        ariaLabel="Abrir factura"
                        icon={ExternalLink}
                      >
                        <ExternalLink size={14} />
                      </SecureFileLink>

                      {/* Category change */}
                      <Select
                        value={f.categoria || "otro"}
                        onValueChange={(val) => updateFactura(f.id, { categoria: val } as any)}
                      >
                        <SelectTrigger className="h-7 w-7 p-0 border-0 shadow-none [&>svg]:hidden">
                          <Filter size={14} className="text-muted-foreground" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_GASTO.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará el archivo y los datos extraídos. No se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteFactura(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FacturasSection;
