import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import IncidenciasListSection from "@/components/incidencias/IncidenciasSection";
import IncidenciaQuickCreate from "@/components/incidencias/IncidenciaQuickCreate";
import IncidenciaDetail from "@/components/incidencias/IncidenciaDetail";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { Proveedor } from "@/hooks/useProveedores";

type View = "list" | "create" | "detail";

interface IncidenciasTabContentProps {
  incidencias: Incidencia[];
  properties: Property[];
  inquilinos: Inquilino[];
  loading: boolean;
  filterPropertyId: string | null;
  onClearFilter: () => void;
  createIncidencia: (d: Partial<Incidencia>) => Promise<Incidencia | null>;
  updateIncidencia: (id: string, d: Partial<Incidencia>) => Promise<void>;
  deleteIncidencia: (id: string) => Promise<void>;
  mensajeActions: {
    fetch: (id: string) => Promise<any[]>;
    create: (id: string, autor: string, msg: string) => Promise<void>;
    update: (id: string, msg: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  evidenciaActions: {
    fetch: (id: string) => Promise<any[]>;
    upload: (id: string, file: File) => Promise<any>;
    delete: (ev: any) => Promise<void>;
  };
  citacionActions: {
    fetch: (id: string) => Promise<any[]>;
    create: (id: string, d: any) => Promise<void>;
    update: (id: string, d: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  documentoActions: {
    fetch: (id: string) => Promise<any[]>;
    upload: (id: string, file: File, categoria: string) => Promise<any>;
    delete: (doc: any) => Promise<void>;
  };
  createPropertyMensaje: (propertyId: string, autor: string, mensaje: string, incidenciaId?: string | null) => Promise<void>;
  proveedores?: Proveedor[];
  initialIncidencia?: Incidencia | null;
  initialView?: View;
  onConsumeInitial?: () => void;
}

const IncidenciasTabContent = ({
  incidencias, properties, inquilinos, loading,
  filterPropertyId, onClearFilter,
  createIncidencia, updateIncidencia, deleteIncidencia,
  mensajeActions, evidenciaActions, citacionActions, documentoActions,
  createPropertyMensaje,
  proveedores = [],
  initialIncidencia, initialView, onConsumeInitial,
}: IncidenciasTabContentProps) => {
  const [view, setView] = useState<View>(initialIncidencia ? "detail" : (initialView === "detail" ? "detail" : "list"));
  const [selectedIncidencia, setSelectedIncidencia] = useState<Incidencia | null>(initialIncidencia || null);

  // Consume initial navigation via useEffect (not during render)
  useEffect(() => {
    if (initialIncidencia && onConsumeInitial) {
      if (!selectedIncidencia || selectedIncidencia.id !== initialIncidencia.id) {
        setSelectedIncidencia(initialIncidencia);
        setView("detail");
        onConsumeInitial();
      }
    }
  }, [initialIncidencia, onConsumeInitial]);

  if (view === "list") {
    return (
      <IncidenciasListSection
        incidencias={filterPropertyId ? incidencias.filter(i => i.property_id === filterPropertyId) : incidencias}
        properties={properties} inquilinos={inquilinos} loading={loading}
        filterPropertyId={filterPropertyId}
        onClearFilter={onClearFilter}
        onNew={() => { setSelectedIncidencia(null); setView("create"); }}
        onView={(inc) => { setSelectedIncidencia(inc); setView("detail"); }}
        onDelete={(id) => deleteIncidencia(id)}
        onUpdatePrioridad={(id, prioridad) => updateIncidencia(id, { prioridad } as any)}
      />
    );
  }

  if (view === "create") {
    return (
      <IncidenciaQuickCreate
        properties={properties}
        inquilinos={inquilinos}
        onSave={async (data, files) => {
          const created = await createIncidencia(data);
          if (created) {
            // Upload evidence files
            for (const file of files) {
              await evidenciaActions.upload(created.id, file);
            }
            setSelectedIncidencia(created);
            setView("detail");
          }
        }}
        onBack={() => setView("list")}
      />
    );
  }

  if (view === "detail" && selectedIncidencia) {
    return (
      <IncidenciaDetail
        incidencia={selectedIncidencia}
        properties={properties}
        inquilinos={inquilinos}
        onSave={async (data) => {
          await updateIncidencia(selectedIncidencia.id, data);
          setView("list");
        }}
        onBack={() => setView("list")}
        mensajeActions={mensajeActions}
        evidenciaActions={evidenciaActions}
        citacionActions={citacionActions}
        documentoActions={documentoActions}
        proveedores={proveedores}
        onLogPropertyMessage={async (propertyId, autor, mensaje, incidenciaId) => {
          await createPropertyMensaje(propertyId, autor, mensaje, incidenciaId);
        }}
      />
    );
  }

  return null;
};

export default IncidenciasTabContent;
