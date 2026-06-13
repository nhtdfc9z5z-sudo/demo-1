import { useMemo } from "react";
import { Clock, MessageSquare, Image, FileText, Receipt, ClipboardList, CalendarCheck, AlertCircle } from "lucide-react";
import HistorialSection from "../HistorialSection";
import SectionCard from "../SectionCard";
import type { IncidenciaMensaje, IncidenciaEvidencia } from "@/hooks/useIncidencias";
import { SecureFileLink } from "@/components/common/SecureFileLink";
import type { IncidenciaDocumento } from "../DocumentosSection";
import type { Citacion } from "../CitacionesSection";

interface Props {
  incidenciaId: string | null;
  incidenciaData: Record<string, any>;
  mensajes: IncidenciaMensaje[];
  evidencias: IncidenciaEvidencia[];
  documentos: IncidenciaDocumento[];
  citaciones: Citacion[];
  onRefreshRelated: () => void;
  mensajeActions: {
    create: (id: string, autor: string, msg: string) => Promise<void>;
    update: (id: string, msg: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
}

interface TimelineEntry {
  id: string;
  tipo: "mensaje" | "evidencia" | "documento" | "citacion" | "factura" | "presupuesto" | "creacion" | "estado";
  titulo: string;
  detalle?: string;
  autor?: string;
  fecha: string;
  url?: string;
}

const TIPO_CONFIG: Record<TimelineEntry["tipo"], { icon: React.ElementType; color: string; label: string }> = {
  creacion: { icon: AlertCircle, label: "Incidencia creada", color: "text-primary" },
  estado: { icon: Clock, label: "Cambio de estado", color: "text-amber-500" },
  mensaje: { icon: MessageSquare, label: "Mensaje", color: "text-blue-500" },
  evidencia: { icon: Image, label: "Evidencia subida", color: "text-cyan-500" },
  documento: { icon: FileText, label: "Documento subido", color: "text-emerald-500" },
  citacion: { icon: CalendarCheck, label: "Citación", color: "text-violet-500" },
  factura: { icon: Receipt, label: "Factura", color: "text-amber-600" },
  presupuesto: { icon: ClipboardList, label: "Presupuesto", color: "text-indigo-500" },
};

const ActividadTab = ({
  incidenciaId, incidenciaData, mensajes, evidencias, documentos, citaciones,
  onRefreshRelated, mensajeActions,
}: Props) => {
  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];

    // Creación de la incidencia
    if (incidenciaData.created_at) {
      entries.push({
        id: "creacion",
        tipo: "creacion",
        titulo: `Incidencia #${incidenciaData.numero_incidencia} creada`,
        detalle: incidenciaData.concepto || undefined,
        fecha: incidenciaData.created_at,
      });
    }

    // Mensajes
    mensajes.forEach(m => {
      entries.push({
        id: `msg-${m.id}`,
        tipo: "mensaje",
        titulo: m.mensaje,
        autor: m.autor,
        fecha: m.created_at,
      });
    });

    // Evidencias
    evidencias.forEach(ev => {
      entries.push({
        id: `ev-${ev.id}`,
        tipo: "evidencia",
        titulo: ev.nombre_archivo,
        fecha: ev.created_at,
        url: ev.url,
      });
    });

    // Documentos
    documentos.forEach(doc => {
      entries.push({
        id: `doc-${doc.id}`,
        tipo: "documento",
        titulo: doc.nombre_archivo,
        detalle: doc.categoria,
        fecha: doc.created_at,
        url: doc.url,
      });
    });

    // Citaciones
    citaciones.forEach(cit => {
      entries.push({
        id: `cit-${cit.id}`,
        tipo: "citacion",
        titulo: `${cit.visitante_nombre} → ${cit.receptor_nombre}`,
        detalle: cit.estado || "Pendiente",
        fecha: cit.created_at,
      });
    });

    // Presupuesto
    if (incidenciaData.presupuesto_importe || incidenciaData.presupuesto_archivo_url) {
      entries.push({
        id: "presupuesto",
        tipo: "presupuesto",
        titulo: incidenciaData.presupuesto_descripcion || "Presupuesto registrado",
        detalle: incidenciaData.presupuesto_total
          ? `Total: ${Number(incidenciaData.presupuesto_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`
          : undefined,
        fecha: incidenciaData.presupuesto_fecha || incidenciaData.updated_at || incidenciaData.created_at,
        url: incidenciaData.presupuesto_archivo_url || undefined,
      });
    }

    // Factura
    if (incidenciaData.factura_numero || incidenciaData.factura_total) {
      entries.push({
        id: "factura",
        tipo: "factura",
        titulo: incidenciaData.factura_numero ? `Factura ${incidenciaData.factura_numero}` : "Factura registrada",
        detalle: incidenciaData.factura_total
          ? `Total: ${Number(incidenciaData.factura_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`
          : undefined,
        fecha: incidenciaData.factura_fecha || incidenciaData.updated_at || incidenciaData.created_at,
      });
    }

    return entries.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [mensajes, evidencias, documentos, citaciones, incidenciaData]);

  return (
    <div className="space-y-6">
      {/* Timeline unificado */}
      <SectionCard title="Historial completo" icon={Clock}>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada</p>
        ) : (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {timeline.map(entry => {
              const config = TIPO_CONFIG[entry.tipo];
              const Icon = config.icon;
              return (
                <div key={entry.id} className="relative">
                  <div className={`absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 bg-background ${config.color}`} style={{ borderColor: "currentColor" }} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon size={13} className={`${config.color} shrink-0`} />
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {config.label}
                      </span>
                      {entry.autor && (
                        <span className="text-[10px] font-medium text-foreground">{entry.autor}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(entry.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    {entry.url ? (
                      <SecureFileLink
                        fallbackUrl={entry.url}
                        className="text-sm text-foreground hover:text-primary transition-colors mt-0.5 block truncate text-left w-full"
                      >
                        {entry.titulo}
                      </SecureFileLink>
                    ) : (
                      <p className="text-sm text-foreground mt-0.5 truncate">{entry.titulo}</p>
                    )}
                    {entry.detalle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.detalle}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Añadir comentarios */}
      <HistorialSection
        incidenciaId={incidenciaId}
        mensajes={mensajes}
        onRefresh={onRefreshRelated}
        onCreate={async (autor, mensaje) => {
          if (!incidenciaId) return;
          await mensajeActions.create(incidenciaId, autor, mensaje);
        }}
        onUpdate={mensajeActions.update}
        onDelete={mensajeActions.delete}
      />
    </div>
  );
};

export default ActividadTab;