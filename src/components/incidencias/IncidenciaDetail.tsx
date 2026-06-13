import { useState, useEffect, useCallback } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import IncidenciaDetailHeader from "./IncidenciaDetailHeader";
import ResumenTab from "./tabs/ResumenTab";
import InquilinoTab from "./tabs/InquilinoTab";
import GestionTab from "./tabs/GestionTab";
import ArchivosTab from "./tabs/ArchivosTab";
import ActividadTab from "./tabs/ActividadTab";
import type { Citacion } from "./CitacionesSection";
import type { IncidenciaDocumento } from "./DocumentosSection";
import type { Incidencia, IncidenciaMensaje, IncidenciaEvidencia } from "@/hooks/useIncidencias";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Proveedor } from "@/hooks/useProveedores";

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

interface DocumentoActions {
  fetch: (id: string) => Promise<IncidenciaDocumento[]>;
  upload: (id: string, file: File, categoria: string) => Promise<IncidenciaDocumento | null>;
  delete: (doc: IncidenciaDocumento) => Promise<void>;
}

interface Props {
  incidencia: Incidencia;
  properties: Property[];
  inquilinos: Inquilino[];
  onSave: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  mensajeActions: MensajeActions;
  evidenciaActions: EvidenciaActions;
  citacionActions: CitacionActions;
  documentoActions: DocumentoActions;
  onLogPropertyMessage?: (propertyId: string, autor: string, mensaje: string, incidenciaId: string) => Promise<void>;
  proveedores?: Proveedor[];
  onProveedorCreated?: (proveedor: Proveedor) => void;
}

const getInitialTab = (estado: string) => {
  switch (estado) {
    case "Proveedor asignado": return "gestion";
    case "Pendiente de factura": return "archivos";
    case "Cerrada": return "actividad";
    default: return "resumen";
  }
};

const IncidenciaDetail = ({
  incidencia, properties, inquilinos, onSave, onBack,
  mensajeActions, evidenciaActions, citacionActions, documentoActions, onLogPropertyMessage,
  proveedores = [], onProveedorCreated,
}: Props) => {
  const [data, setData] = useState<Record<string, any>>({ ...incidencia });
  const [selectedProveedorId, setSelectedProveedorId] = useState<string | null>(
    (incidencia as any).proveedor_id || null
  );
  const [mensajes, setMensajes] = useState<IncidenciaMensaje[]>([]);
  const [evidencias, setEvidencias] = useState<IncidenciaEvidencia[]>([]);
  const [citaciones, setCitaciones] = useState<Citacion[]>([]);
  const [documentos, setDocumentos] = useState<IncidenciaDocumento[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => getInitialTab(incidencia.estado || "Abierta"));

  const property = properties.find(p => p.id === data.property_id);

  const onChange = useCallback((field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const loadRelated = useCallback(async () => {
    const [msgs, evs, cits, docs] = await Promise.all([
      mensajeActions.fetch(incidencia.id),
      evidenciaActions.fetch(incidencia.id),
      citacionActions.fetch(incidencia.id),
      documentoActions.fetch(incidencia.id),
    ]);
    setMensajes(msgs);
    setEvidencias(evs);
    setCitaciones(cits);
    setDocumentos(docs);
  }, [incidencia.id, mensajeActions, evidenciaActions, citacionActions, documentoActions]);

  useEffect(() => { loadRelated(); }, [loadRelated]);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, updated_at, numero_incidencia, user_id, ...saveData } = data;
    // Include proveedor_id in save
    saveData.proveedor_id = selectedProveedorId;
    await onSave(saveData);
    setSaving(false);
  };

  const handleChangeEstado = (estado: string) => {
    onChange("estado", estado);
    if (estado === "Cerrada") onChange("prioridad", null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <IncidenciaDetailHeader
        incidencia={{ ...incidencia, ...data } as Incidencia}
        property={property}
        onBack={onBack}
        onSave={handleSave}
        saving={saving}
        onChangeEstado={handleChangeEstado}
        onChangePrioridad={(p) => onChange("prioridad", p)}
      />

      {/* Mobile save */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <Button onClick={handleSave} disabled={saving} size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Save size={20} />
        </Button>
      </div>

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
            <TabsTrigger value="inquilino" className="text-xs">Inquilino</TabsTrigger>
            <TabsTrigger value="gestion" className="text-xs">Gestión</TabsTrigger>
            <TabsTrigger value="archivos" className="text-xs">Archivos</TabsTrigger>
            <TabsTrigger value="actividad" className="text-xs">
              Actividad
              {mensajes.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {mensajes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="resumen">
              <ResumenTab data={data} onChange={onChange} properties={properties} inquilinos={inquilinos} />
            </TabsContent>

            <TabsContent value="inquilino">
              <InquilinoTab data={data} onChange={onChange} inquilinos={inquilinos} />
            </TabsContent>

            <TabsContent value="gestion">
              <GestionTab
                data={data}
                onChange={onChange}
                incidenciaId={incidencia.id}
                citaciones={citaciones}
                onRefreshRelated={loadRelated}
                citacionActions={citacionActions}
                mensajeActions={mensajeActions}
                onLogPropertyMessage={onLogPropertyMessage}
                proveedores={proveedores}
                selectedProveedorId={selectedProveedorId}
                onSelectProveedor={(p) => setSelectedProveedorId(p?.id || null)}
              />
            </TabsContent>

            <TabsContent value="archivos">
              <ArchivosTab
                data={data}
                onChange={onChange}
                incidenciaId={incidencia.id}
                evidencias={evidencias}
                evidenciaActions={evidenciaActions}
                setEvidencias={setEvidencias}
                documentos={documentos}
                onUploadDocumento={async (file, categoria) => {
                  const doc = await documentoActions.upload(incidencia.id, file, categoria);
                  if (doc) setDocumentos(prev => [...prev, doc]);
                }}
                onDeleteDocumento={async (doc) => {
                  await documentoActions.delete(doc);
                  setDocumentos(prev => prev.filter(d => d.id !== doc.id));
                }}
              />
            </TabsContent>

            <TabsContent value="actividad">
              <ActividadTab
                incidenciaId={incidencia.id}
                incidenciaData={data}
                mensajes={mensajes}
                evidencias={evidencias}
                documentos={documentos}
                citaciones={citaciones}
                onRefreshRelated={loadRelated}
                mensajeActions={mensajeActions}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default IncidenciaDetail;
