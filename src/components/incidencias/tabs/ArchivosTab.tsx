import { useMemo } from "react";
import { Clock, Image, FileText, Receipt, ClipboardList } from "lucide-react";
import EvidenciasSection from "../EvidenciasSection";
import DocumentosSection from "../DocumentosSection";
import SectionCard from "../SectionCard";
import { SecureFileLink } from "@/components/common/SecureFileLink";
import type { IncidenciaEvidencia } from "@/hooks/useIncidencias";
import type { IncidenciaDocumento } from "../DocumentosSection";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  incidenciaId: string | null;
  evidencias: IncidenciaEvidencia[];
  evidenciaActions: {
    upload: (id: string, file: File) => Promise<IncidenciaEvidencia | null>;
    delete: (ev: IncidenciaEvidencia) => Promise<void>;
  };
  setEvidencias: React.Dispatch<React.SetStateAction<IncidenciaEvidencia[]>>;
  documentos: IncidenciaDocumento[];
  onUploadDocumento: (file: File, categoria: string) => Promise<void>;
  onDeleteDocumento: (doc: IncidenciaDocumento) => Promise<void>;
}

interface HistorialEntry {
  id: string;
  tipo: "evidencia" | "documento" | "factura" | "presupuesto";
  nombre: string;
  categoria?: string;
  fecha: string;
  url?: string;
}

const TIPO_CONFIG: Record<HistorialEntry["tipo"], { icon: React.ElementType; label: string; color: string }> = {
  evidencia: { icon: Image, label: "Evidencia", color: "text-blue-500" },
  documento: { icon: FileText, label: "Documento", color: "text-emerald-500" },
  factura: { icon: Receipt, label: "Factura", color: "text-amber-500" },
  presupuesto: { icon: ClipboardList, label: "Presupuesto", color: "text-violet-500" },
};

const ArchivosTab = ({
  data, onChange, incidenciaId, evidencias, evidenciaActions, setEvidencias,
  documentos, onUploadDocumento, onDeleteDocumento,
}: Props) => {
  const historial = useMemo<HistorialEntry[]>(() => {
    const entries: HistorialEntry[] = [];

    evidencias.forEach(ev => {
      entries.push({
        id: `ev-${ev.id}`,
        tipo: "evidencia",
        nombre: ev.nombre_archivo,
        fecha: ev.created_at,
        url: ev.url,
      });
    });

    documentos.forEach(doc => {
      entries.push({
        id: `doc-${doc.id}`,
        tipo: "documento",
        nombre: doc.nombre_archivo,
        categoria: doc.categoria,
        fecha: doc.created_at,
        url: doc.url,
      });
    });

    if (data.presupuesto_archivo_url) {
      entries.push({
        id: "presupuesto",
        tipo: "presupuesto",
        nombre: data.presupuesto_descripcion || "Presupuesto adjunto",
        categoria: data.presupuesto_total ? `Total: ${Number(data.presupuesto_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}` : undefined,
        fecha: data.presupuesto_fecha || data.updated_at || data.created_at,
        url: data.presupuesto_archivo_url,
      });
    }

    if (data.factura_numero || data.factura_total) {
      entries.push({
        id: "factura",
        tipo: "factura",
        nombre: data.factura_numero ? `Factura ${data.factura_numero}` : "Factura registrada",
        categoria: data.factura_total ? `Total: ${Number(data.factura_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}` : undefined,
        fecha: data.factura_fecha || data.updated_at || data.created_at,
      });
    }

    return entries.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [evidencias, documentos, data]);

  return (
    <div className="space-y-6">
      <EvidenciasSection
        incidenciaId={incidenciaId}
        evidencias={evidencias}
        onUpload={async (file) => {
          if (!incidenciaId) return;
          const ev = await evidenciaActions.upload(incidenciaId, file);
          if (ev) setEvidencias(prev => [...prev, ev]);
        }}
        onDelete={async (ev) => {
          await evidenciaActions.delete(ev);
          setEvidencias(prev => prev.filter(e => e.id !== ev.id));
        }}
      />

      <DocumentosSection
        incidenciaId={incidenciaId}
        documentos={documentos}
        onUpload={onUploadDocumento}
        onDelete={onDeleteDocumento}
      />

      {/* Historial de archivos subidos */}
      {historial.length > 0 && (
        <SectionCard title="Historial de archivos" icon={Clock}>
          <div className="relative pl-6 space-y-3">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {historial.map(entry => {
              const config = TIPO_CONFIG[entry.tipo];
              const Icon = config.icon;
              return (
                <div key={entry.id} className="relative group">
                  <div className={`absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 ${config.color} bg-background`}
                    style={{ borderColor: "currentColor" }}
                  />
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${config.color} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {config.label}
                        </span>
                        {entry.categoria && (
                          <span className="text-[10px] text-muted-foreground">{entry.categoria}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(entry.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      {entry.url ? (
                        <SecureFileLink
                          fallbackUrl={entry.url}
                          className="text-xs text-foreground hover:text-primary truncate block mt-0.5 transition-colors text-left w-full"
                        >
                          {entry.nombre}
                        </SecureFileLink>
                      ) : (
                        <p className="text-xs text-foreground truncate mt-0.5">{entry.nombre}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default ArchivosTab;
