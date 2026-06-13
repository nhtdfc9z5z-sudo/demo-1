import { useState, useRef } from "react";
import { FileText, Upload, Trash2, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionCard from "./SectionCard";
import { SecureFileLink } from "@/components/common/SecureFileLink";

export interface IncidenciaDocumento {
  id: string;
  incidencia_id: string;
  user_id: string;
  nombre_archivo: string;
  storage_path: string;
  url: string;
  categoria: string;
  created_at: string;
}

const CATEGORIAS_DOC = [
  "Presupuesto",
  "Factura",
  "Contrato",
  "Informe técnico",
  "Comunicación",
  "Seguro",
  "Otro",
];

interface Props {
  incidenciaId: string | null;
  documentos: IncidenciaDocumento[];
  onUpload: (file: File, categoria: string) => Promise<void>;
  onDelete: (doc: IncidenciaDocumento) => Promise<void>;
}

const DocumentosSection = ({ incidenciaId, documentos, onUpload, onDelete }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [categoria, setCategoria] = useState("Otro");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || !incidenciaId) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      await onUpload(file, categoria);
    }
    setUploading(false);
  };

  const getFileIcon = (nombre: string) => {
    const ext = nombre.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (["doc", "docx"].includes(ext || "")) return "📝";
    if (["xls", "xlsx"].includes(ext || "")) return "📊";
    return "📎";
  };

  return (
    <SectionCard title="Documentos" icon={FileText}>
      {!incidenciaId ? (
        <p className="text-xs text-muted-foreground">Guarda la incidencia primero para subir documentos.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Categoría</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_DOC.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> {uploading ? "Subiendo..." : "Subir documento"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
          </div>

          {documentos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay documentos adjuntos.</p>
          ) : (
            <div className="space-y-2">
              {documentos.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30 group"
                >
                  <span className="text-lg">{getFileIcon(doc.nombre_archivo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{doc.nombre_archivo}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.categoria}</p>
                  </div>
                  <SecureFileLink
                    bucket="incidencia-documentos"
                    path={doc.storage_path}
                    fallbackUrl={doc.url}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink size={14} />
                  </SecureFileLink>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDelete(doc)}
                  >
                    <Trash2 size={13} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

export default DocumentosSection;
