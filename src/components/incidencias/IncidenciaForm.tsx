import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import DatosPrincipales from "./DatosPrincipales";
import InquilinoIncidenciaSection from "./InquilinoIncidenciaSection";
import DisponibilidadSection from "./DisponibilidadSection";
import ProveedorSection from "./ProveedorSection";
import FacturaSection from "./FacturaSection";
import OrigenAfectadosSection from "./OrigenAfectadosSection";
import EvidenciasSection from "./EvidenciasSection";
import HistorialSection from "./HistorialSection";
import CitacionesSection from "./CitacionesSection";
import type { Citacion } from "./CitacionesSection";
import type { Incidencia, IncidenciaMensaje, IncidenciaEvidencia } from "@/hooks/useIncidencias";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

interface MensajeActions {
  fetch: (id: string) => Promise<IncidenciaMensaje[]>;
  create: (id: string, autor: string, mensaje: string) => Promise<void>;
  update: (id: string, mensaje: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

interface EvidenciaActions {
  fetch: (id: string) => Promise<IncidenciaEvidencia[]>;
  upload: (id: string, file: File) => Promise<IncidenciaEvidencia | null>;
  delete: (ev: IncidenciaEvidencia) => Promise<void>;
}

interface CitacionActions {
  fetch: (id: string) => Promise<Citacion[]>;
  create: (id: string, data: Partial<Citacion>) => Promise<void>;
  update: (id: string, data: Partial<Citacion>) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

interface Props {
  incidencia: Incidencia | null;
  properties: Property[];
  inquilinos: Inquilino[];
  onSave: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  mensajeActions: MensajeActions;
  evidenciaActions: EvidenciaActions;
  citacionActions: CitacionActions;
  onLogPropertyMessage?: (propertyId: string, autor: string, mensaje: string, incidenciaId: string) => Promise<void>;
}

const IncidenciaForm = ({ incidencia, properties, inquilinos, onSave, onBack, mensajeActions, evidenciaActions, citacionActions, onLogPropertyMessage }: Props) => {
  const [data, setData] = useState<Record<string, any>>(() =>
    incidencia ? { ...incidencia } : { prioridad: 3, estado: "Abierta" }
  );
  const [mensajes, setMensajes] = useState<IncidenciaMensaje[]>([]);
  const [evidencias, setEvidencias] = useState<IncidenciaEvidencia[]>([]);
  const [citaciones, setCitaciones] = useState<Citacion[]>([]);
  const [saving, setSaving] = useState(false);

  const incidenciaId = incidencia?.id || null;
  const propertyName = properties.find(p => p.id === data.property_id)?.nombre_interno || "Nueva incidencia";

  const onChange = useCallback((field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const loadRelated = useCallback(async () => {
    if (!incidenciaId) return;
    const [msgs, evs, cits] = await Promise.all([
      mensajeActions.fetch(incidenciaId),
      evidenciaActions.fetch(incidenciaId),
      citacionActions.fetch(incidenciaId),
    ]);
    setMensajes(msgs);
    setEvidencias(evs);
    setCitaciones(cits);
  }, [incidenciaId, mensajeActions, evidenciaActions, citacionActions]);

  useEffect(() => { loadRelated(); }, [loadRelated]);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, updated_at, numero_incidencia, user_id, ...saveData } = data;
    await onSave(saveData);
    setSaving(false);
  };

  // Copy helpers
  const copyFromProperty = (prefix: string) => {
    const prop = properties.find(p => p.id === data.property_id);
    if (!prop) return;
    onChange(`${prefix}_domicilio`, prop.direccion_completa || "");
  };

  const copyFromInquilino = (prefix: string) => {
    const nameField = prefix === "origen" ? `${prefix}_nombre_responsable` : `${prefix}_nombre`;
    const phoneField = prefix === "origen" ? `${prefix}_telefono_responsable` : `${prefix}_telefono`;
    onChange(nameField, data.inquilino_nombre || "");
    onChange(phoneField, data.inquilino_telefono || "");
  };

  const copyFromOrigen = () => {
    onChange("afectado_domicilio", data.origen_domicilio || "");
    onChange("afectado_lugar", data.origen_lugar || "");
    onChange("afectado_nombre", data.origen_nombre_responsable || "");
    onChange("afectado_telefono", data.origen_telefono_responsable || "");
    onChange("afectado_responsable", data.origen_responsable || "");
  };

  const copySeguroFromOrigen = () => {
    ["seguro_nombre", "seguro_poliza", "seguro_ref_siniestro", "seguro_telefono", "seguro_email", "seguro_observaciones"].forEach(f => {
      onChange(`afectado_${f}`, data[`origen_${f}`] || "");
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Sticky header */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Gestión de Incidencias – {propertyName}
            </h2>
            {incidencia && (
              <p className="text-xs text-muted-foreground">Nº {incidencia.numero_incidencia}</p>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5 hidden md:inline-flex">
          <Save size={14} /> {saving ? "Guardando..." : "Guardar incidencia"}
        </Button>
      </div>

      {/* Mobile floating save */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <Button onClick={handleSave} disabled={saving} size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Save size={20} />
        </Button>
      </div>

      <div className="space-y-6">
        <DatosPrincipales data={data} onChange={onChange} properties={properties} inquilinos={inquilinos} />
        <InquilinoIncidenciaSection data={data} onChange={onChange} inquilinos={inquilinos} />
        <DisponibilidadSection data={data} onChange={onChange} />
        <ProveedorSection data={data} onChange={onChange} />
        <FacturaSection data={data} onChange={onChange} />

        <OrigenAfectadosSection
          variant="origen"
          data={data}
          onChange={onChange}
          copyActions={[
            { label: "Copiar desde propiedad", onClick: () => copyFromProperty("origen") },
            { label: "Copiar desde inquilino", onClick: () => copyFromInquilino("origen") },
          ]}
        />

        <OrigenAfectadosSection
          variant="afectado"
          data={data}
          onChange={onChange}
          copyActions={[
            { label: "Copiar desde propiedad", onClick: () => copyFromProperty("afectado") },
            { label: "Copiar desde inquilino", onClick: () => copyFromInquilino("afectado") },
            { label: "Copiar desde Origen", onClick: copyFromOrigen },
            { label: "Copiar seguro", onClick: copySeguroFromOrigen },
          ]}
        />

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

        <CitacionesSection
          incidenciaId={incidenciaId}
          citaciones={citaciones}
          incidenciaData={data}
          onRefresh={loadRelated}
          onCreate={async (citData) => {
            if (!incidenciaId) return;
            await citacionActions.create(incidenciaId, citData);
          }}
          onUpdate={citacionActions.update}
          onDelete={citacionActions.delete}
          onLogMessage={async (autor, mensaje) => {
            if (!incidenciaId) return;
            await mensajeActions.create(incidenciaId, autor, mensaje);
            // Also log reference to property historial
            if (onLogPropertyMessage && data.property_id) {
              await onLogPropertyMessage(data.property_id, autor, mensaje, incidenciaId);
            }
          }}
        />

        <HistorialSection
          incidenciaId={incidenciaId}
          mensajes={mensajes}
          onRefresh={loadRelated}
          onCreate={async (autor, mensaje) => {
            if (!incidenciaId) return;
            await mensajeActions.create(incidenciaId, autor, mensaje);
          }}
          onUpdate={mensajeActions.update}
          onDelete={mensajeActions.delete}
        />
      </div>
    </motion.div>
  );
};

export default IncidenciaForm;
