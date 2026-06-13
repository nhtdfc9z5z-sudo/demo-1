import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PanelHeader, { type PanelTab } from "@/components/propietarios/PanelHeader";
import SmartRemindersPanel from "@/components/propietarios/SmartRemindersPanel";
import IPCUpdateDialog from "@/components/propietarios/IPCUpdateDialog";
import RevisionRentaSheet from "@/components/propietarios/RevisionRentaSheet";
import RenovacionContratoSheet from "@/components/propietarios/RenovacionContratoSheet";
import { useSmartReminders } from "@/hooks/useSmartReminders";
import ProfileEditModal from "@/components/propietarios/ProfileEditModal";
import InquilinosSection from "@/components/propietarios/InquilinosSection";
import TesoreriaGeneralTab from "@/components/propietarios/TesoreriaGeneralTab";
import DocumentacionTab from "@/components/propietarios/DocumentacionTab";
import PendingPaymentsBanner from "@/components/propietarios/PendingPaymentsBanner";
import PropertiesTabContent from "@/components/propietarios/PropertiesTabContent";
import IncidenciasTabContent from "@/components/propietarios/IncidenciasTabContent";
import ProveedoresTabContent from "@/components/propietarios/ProveedoresTabContent";
import GeneradorContrato, { type GeneradorContratoInitialData } from "@/components/propietarios/GeneradorContrato";
import FiscalidadTab from "@/components/propietarios/FiscalidadTab";
import ProgresoInteligenteToast from "@/components/propietarios/ProgresoInteligenteToast";
import { useProgresoInteligente } from "@/hooks/useProgresoInteligente";
import CentroSaludPatrimonio from "@/components/propietarios/CentroSaludPatrimonio";
import CentroSaludDocumental from "@/components/propietarios/CentroSaludDocumental";
import TareasPendientesPanel from "@/components/propietarios/TareasPendientesPanel";
import KpiHeroRow from "@/components/propietarios/dashboard/KpiHeroRow";
import HeCobradoCTA from "@/components/propietarios/dashboard/HeCobradoCTA";
import ActivosCompactList from "@/components/propietarios/dashboard/ActivosCompactList";
import TesoreriaMiniChart from "@/components/propietarios/dashboard/TesoreriaMiniChart";
import SeccionColapsable from "@/components/propietarios/dashboard/SeccionColapsable";
import DashboardFiltroActivo from "@/components/propietarios/dashboard/DashboardFiltroActivo";
import FichaInmuebleSheet from "@/components/propietarios/ficha/FichaInmuebleSheet";
import HeCobradoSheet from "@/components/propietarios/HeCobradoSheet";
import GastoRapidoSheet from "@/components/propietarios/GastoRapidoSheet";
import PagosHistorialSheet from "@/components/propietarios/PagosHistorialSheet";
import CalendarioHorizontal from "@/components/propietarios/CalendarioHorizontal";
import CalendarioMiniWidget from "@/components/propietarios/dashboard/CalendarioMiniWidget";
import { useRecordatorios } from "@/hooks/useRecordatorios";
import { useNotifications } from "@/hooks/useNotifications";
import { sincronizarNotificaciones } from "@/lib/notificaciones/sincronizarNotificaciones";
import { Activity, ListTodo, BellRing, CalendarDays } from "lucide-react";
import { useOnboardingProgress, markFiscalRevisado, type OnboardingStepId } from "@/hooks/useOnboardingProgress";
import { useAltaAlquiler } from "@/components/propietarios/AltaAlquilerContext";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, ScrollText, PenLine } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useProperties } from "@/hooks/useProperties";
import { useInquilinos } from "@/hooks/useInquilinos";
import { useIncidencias } from "@/hooks/useIncidencias";
import { useProveedores } from "@/hooks/useProveedores";
import { useContratos } from "@/hooks/useContratos";
import { useRentaActualizaciones } from "@/hooks/useRentaActualizaciones";
import { usePropertyMensajes } from "@/hooks/usePropertyMensajes";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { usePropertyEventos } from "@/hooks/usePropertyEventos";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";

const PropietariosPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const altaAlquiler = useAltaAlquiler();
  const [activeTab, setActiveTab] = useState<PanelTab>("propiedades");
  const [tabResetKey, setTabResetKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const { profile, saveProfile } = useProfile();
  const {
    properties, loading: propsLoading, createProperty, updateProperty, deleteProperty,
    uploadPhoto, getPhotos, deletePhoto, refetch: refetchProperties,
  } = useProperties();
  const {
    inquilinos, loading: inquilinosLoading, createInquilino, updateInquilino, deleteInquilino, reorderInquilinos,
    fetchDocumentos, uploadDocumento, deleteDocumento, refetch: refetchInquilinos,
  } = useInquilinos();
  const {
    incidencias, loading: incidenciasLoading,
    createIncidencia, updateIncidencia, deleteIncidencia,
    fetchMensajes, createMensaje, updateMensaje, deleteMensaje,
    fetchEvidencias, uploadEvidencia, deleteEvidencia,
    fetchCitaciones, createCitacion, updateCitacion, deleteCitacion,
    fetchDocumentos: fetchIncDocumentos, uploadDocumento: uploadIncDocumento, deleteDocumento: deleteIncDocumento,
  } = useIncidencias();
  const { proveedores, loading: proveedoresLoading, createProveedor, updateProveedor, deleteProveedor } = useProveedores();
  const {
    fetchMensajes: fetchPropertyMensajes, createMensaje: createPropertyMensaje,
    updateMensaje: updatePropertyMensaje, deleteMensaje: deletePropertyMensaje,
  } = usePropertyMensajes();
  const { pagos, confirmarPago, updatePago, deletePago } = usePagosRenta({ asOwner: true, userId: user?.id });
  const { eventos, createEvento, updateEvento, deleteEvento } = usePropertyEventos();
  const { contratos, updateContrato, addHistorial, refetch: refetchContratos } = useContratos();

  // Recordatorios + notificaciones: sincroniza la campanita con los
  // recordatorios urgentes (prioridad <= 2) ya persistidos.
  const { recordatorios } = useRecordatorios();
  const { notifications: notificacionesExistentes, refetch: refetchNotifications } = useNotifications();
  useEffect(() => {
    // Espera a que properties estén cargadas para no etiquetar como "Activo".
    if (!user?.id || propsLoading || properties.length === 0) return;
    if (recordatorios.length === 0) return;
    let cancelled = false;
    sincronizarNotificaciones({
      userId: user.id,
      recordatorios,
      notificacionesExistentes,
      properties: properties.map((p) => ({ id: p.id, nombre_interno: p.nombre_interno })),
    }).then((inserted) => {
      if (!cancelled && inserted > 0) refetchNotifications();
    });
    return () => { cancelled = true; };
  }, [user?.id, propsLoading, recordatorios, notificacionesExistentes, properties, refetchNotifications]);

  // Smart reminders
  const { propertyHealths, totalReminders } = useSmartReminders(
    properties, contratos, incidencias, pagos, inquilinos
  );

  // Cross-tab navigation state
  const [inquilinoPrefilledPropertyId, setInquilinoPrefilledPropertyId] = useState<string | null>(null);
  const [inquilinoToEdit, setInquilinoToEdit] = useState<Inquilino | null>(null);
  const [filterPropertyId, setFilterPropertyId] = useState<string | null>(null);
  // Filtro del dashboard (independiente del de incidencias para no interferir).
  const [dashboardFilterPropertyId, setDashboardFilterPropertyId] = useState<string | null>(null);
  // Ficha lateral abierta desde el dashboard.
  const [fichaPropertyId, setFichaPropertyId] = useState<string | null>(null);
  const fichaProperty = useMemo(
    () => properties.find(p => p.id === fichaPropertyId) || null,
    [properties, fichaPropertyId]
  );
  // Sheet "He cobrado" lanzado desde el CTA del dashboard.
  const [heCobradoPropertyId, setHeCobradoPropertyId] = useState<string | null>(null);
  const [gastoRapidoOpen, setGastoRapidoOpen] = useState(false);
  // Historial de rentas a abrir directamente en PropertiesTabContent.
  const [pagosHistorialSheetPropertyId, setPagosHistorialSheetPropertyId] = useState<string | null>(null);
  const [pendingIncidencia, setPendingIncidencia] = useState<Incidencia | null>(null);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [contractGeneratorData, setContractGeneratorData] = useState<GeneradorContratoInitialData | null>(null);
  const [initialPropertyId, setInitialPropertyId] = useState<string | null>(null);

  // Revisión / Renovación sheets (Bloque 3)
  const [revisionContratoId, setRevisionContratoId] = useState<string | null>(null);
  const [revisionFechaSugerida, setRevisionFechaSugerida] = useState<string | undefined>(undefined);
  const [renovacionContratoId, setRenovacionContratoId] = useState<string | null>(null);
  const revisionContrato = useMemo(() => contratos.find(c => c.id === revisionContratoId) || null, [contratos, revisionContratoId]);
  const renovacionContrato = useMemo(() => contratos.find(c => c.id === renovacionContratoId) || null, [contratos, renovacionContratoId]);

  // IPC update flow
  const [ipcContratoId, setIpcContratoId] = useState<string | null>(null);
  const ipcContrato = useMemo(() => contratos.find(c => c.id === ipcContratoId) || null, [contratos, ipcContratoId]);
  const ipcTenantName = useMemo(() => {
    if (!ipcContrato) return undefined;
    const tenant = inquilinos.find(i => i.id === ipcContrato.inquilino_id);
    return tenant ? tenant.nombre : undefined;
  }, [ipcContrato, inquilinos]);
  const { addActualizacion, actualizaciones: ipcActualizaciones } = useRentaActualizaciones(ipcContrato?.property_id);

  const ipcContext = useMemo(() => {
    if (!ipcContrato) return undefined;
    const propId = ipcContrato.property_id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Last rent update date
    const lastUpdate = ipcActualizaciones.length > 0
      ? ipcActualizaciones[ipcActualizaciones.length - 1]?.fecha_efectiva
      : null;

    // Open incidencias for this property
    const openInc = incidencias.filter(
      i => i.property_id === propId && i.estado !== "Cerrada"
    ).length;

    // Pending payments this month
    const hasPending = pagos.some(
      p => p.property_id === propId && p.mes === currentMonth && p.anio === currentYear
        && !p.propietario_confirmado
    );

    return { lastRentUpdateDate: lastUpdate, openIncidenciasCount: openInc, hasPendingPayments: hasPending };
  }, [ipcContrato, ipcActualizaciones, incidencias, pagos]);

  const handleIPCApply = async (data: {
    contratoId: string;
    propertyId: string;
    oldRent: number;
    newRent: number;
    ipcPorcentaje: number;
    message: string;
  }) => {
    await updateContrato(data.contratoId, { renta_mensual: data.newRent });
    await addActualizacion({
      property_id: data.propertyId,
      contrato_id: data.contratoId,
      fecha_efectiva: new Date().toISOString().split("T")[0],
      importe_anterior: data.oldRent,
      importe_nuevo: data.newRent,
      motivo: "ipc",
      notas: `IPC ${data.ipcPorcentaje}%. Mensaje generado para inquilino.`,
    });
    await addHistorial(
      data.contratoId,
      data.propertyId,
      "actualizacion_ipc",
      "Renta actualizada por IPC",
      `De ${data.oldRent} € a ${data.newRent} € (${data.ipcPorcentaje}%)`,
      `${data.oldRent} €`,
      `${data.newRent} €`
    );
    await refetchContratos();
    toast({ title: "Renta actualizada", description: `Nueva renta: ${data.newRent.toLocaleString("es-ES")} €/mes` });
  };

  const pagosPendientes = useMemo(() =>
    pagos.filter(p => p.inquilino_notificado && !p.propietario_confirmado),
    [pagos]
  );

  // Sprint 4.0 — onboarding progress (depende de datos reales).
  const onboarding = useOnboardingProgress(properties, contratos, pagos);

  // Tema 3 — banner inteligente que reemplaza al widget fijo de onboarding.
  const progresoInteligente = useProgresoInteligente({ properties, contratos, inquilinos });

  const firstActiveProperty = useMemo(() => {
    const ids = new Set(
      inquilinos
        .filter(i => i.rol_inquilino !== "avalista" && i.property_id)
        .map(i => i.property_id as string)
    );
    return properties.find(p => ids.has(p.id)) || properties[0];
  }, [properties, inquilinos]);

  const handleOnboardingStep = (step: OnboardingStepId) => {
    switch (step) {
      case "activo":
        altaAlquiler.open({ origen: "panel", modoInicial: "vivienda" });
        break;
      case "alquiler":
        altaAlquiler.open({ origen: "alta_guiada", modoInicial: "completo" });
        break;
      case "cobro":
        setActiveTab("propiedades");
        if (firstActiveProperty) setInitialPropertyId(firstActiveProperty.id);
        toast({ title: "Marca el primer cobro", description: "Selecciona el activo y pulsa 'He cobrado'." });
        break;
      case "gasto":
        navigate("/finanzas");
        break;
      case "fiscal":
        markFiscalRevisado();
        setActiveTab("fiscalidad");
        break;
    }
  };

  const handleSaveProfile = async (data: typeof profile) => {
    await saveProfile(data);
    setEditOpen(false);
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <PanelHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === activeTab) {
            // Re-clicking the active tab resets sub-views to initial state
            setTabResetKey(k => k + 1);
          }
          setActiveTab(tab);
          setInquilinoPrefilledPropertyId(null);
          setInquilinoToEdit(null);
          if (tab !== "incidencias") setFilterPropertyId(null);
          setPendingIncidencia(null);
          setInitialPropertyId(null);
        }}
        onSearchNavigate={(tab, id) => {
          setActiveTab(tab);
          setInquilinoPrefilledPropertyId(null);
          setInquilinoToEdit(null);
          setFilterPropertyId(null);
          setPendingIncidencia(null);
          if (tab === "incidencias" && id) {
            const inc = incidencias.find(i => i.id === id);
            if (inc) setPendingIncidencia(inc);
          }
          // For inquilinos and propiedades, the tab switch is enough for now
          // since we navigate to the correct section
        }}
        pendingPayments={pagosPendientes.length}
        profileName={[profile.nombre, profile.apellidos].filter(Boolean).join(" ") || undefined}
        profileData={profile}
        onEditProfile={() => setEditOpen(true)}
        properties={properties}
        inquilinos={inquilinos}
        incidencias={incidencias}
        onNotificationNavigate={(notification) => {
          const refTipo = notification.referencia_tipo;
          const refId = notification.referencia_id;

          // Notificaciones generadas desde recordatorios urgentes.
          if (refTipo === "pago_renta" && refId) {
            setPagosHistorialSheetPropertyId(refId);
            return;
          }
          if (refTipo === "contrato_renovacion" && refId) {
            setRenovacionContratoId(refId);
            return;
          }
          if (refTipo === "contrato_revision" && refId) {
            setRevisionContratoId(refId);
            return;
          }
          if (refTipo === "documento") {
            setActiveTab("documentos");
            return;
          }

          // Compatibilidad con notificaciones legacy.
          if ((refTipo === "pago" || notification.tipo === "pago") && refId) {
            const pago = pagos.find(p => p.id === refId);
            if (pago) {
              setActiveTab("propiedades");
              setInitialPropertyId(pago.property_id);
              return;
            }
          }
          if ((refTipo === "incidencia" || notification.tipo === "incidencia") && refId) {
            const inc = incidencias.find(i => i.id === notification.referencia_id);
            if (inc) {
              setPendingIncidencia(inc);
              setActiveTab("incidencias");
              return;
            }
          }
          if (notification.tipo === "contrato") {
            setActiveTab("propiedades");
            return;
          }
          // fallback: navigate to enlace if available
          if (notification.enlace && !notification.enlace.startsWith("recordatorio:")) {
            window.location.hash = notification.enlace;
          }
        }}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 space-y-10">
        <PendingPaymentsBanner
          pagosPendientes={pagosPendientes}
          inquilinos={inquilinos}
          onClickPago={(pago) => {
            setActiveTab("propiedades");
            setInitialPropertyId(pago.property_id);
          }}
        />

        {activeTab === "propiedades" ? (
          <>
            {properties.length === 0 ? (
              <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Empieza a controlar tu patrimonio</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Elige por dónde quieres empezar. Puedes cambiar después.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                  {/* Destacada: contrato PDF */}
                  <button
                    type="button"
                    onClick={() => altaAlquiler.open({ origen: "alta_guiada", intencion: "pdf" })}
                    className="text-left rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-4 min-h-[140px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground">
                      <ScrollText size={22} />
                    </span>
                    <span className="text-base font-semibold text-foreground">Tengo el contrato de arrendamiento</span>
                    <span className="text-xs text-muted-foreground mt-auto">Lo leemos y rellenamos por ti</span>
                  </button>
                  {/* Escrituras / nota simple */}
                  {/*
                    TODO: Actualmente esta opción reutiliza la intención "pdf"
                    y comparte textos con la subida de contrato de arrendamiento.
                    En una futura iteración, mostrar hints y microcopy
                    específicos según el tipo de documento detectado
                    (contrato, escritura, nota simple, etc.).
                  */}
                  <button
                    type="button"
                    onClick={() => altaAlquiler.open({ origen: "alta_guiada", intencion: "pdf" })}
                    className="text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[140px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                      <FileText size={22} />
                    </span>
                    <span className="text-base font-semibold text-foreground">Tengo las escrituras o nota simple</span>
                    <span className="text-xs text-muted-foreground mt-auto">Sube el documento y se rellena</span>
                  </button>
                  {/* Manual */}
                  <button
                    type="button"
                    onClick={() => altaAlquiler.openPicker({ modoForzado: "manual" })}
                    className="text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[140px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                      <PenLine size={22} />
                    </span>
                    <span className="text-base font-semibold text-foreground">Prefiero rellenar todo a mano</span>
                    <span className="text-xs text-muted-foreground mt-auto">Elige el tipo de activo a dar de alta</span>
                  </button>
                </div>
              </section>
            ) : (
              <>
                {/* Filtro por activo */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                    Resumen{dashboardFilterPropertyId ? " · filtrado" : ""}
                  </div>
                  <DashboardFiltroActivo
                    properties={properties}
                    value={dashboardFilterPropertyId}
                    onChange={setDashboardFilterPropertyId}
                  />
                </div>

                {/* Banner activo seleccionado */}
                {dashboardFilterPropertyId && (() => {
                  const sel = properties.find(p => p.id === dashboardFilterPropertyId);
                  const nombre = sel?.nombre_interno || (sel as any)?.direccion || "Activo";
                  return (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-primary/[0.04] border-l-2 border-primary pl-3 pr-2 py-1.5">
                      <div className="text-xs text-muted-foreground min-w-0 truncate">
                        Mostrando datos de <span className="font-medium text-foreground">{nombre}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDashboardFilterPropertyId(null)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
                        aria-label="Ver todos los activos"
                      >
                        Ver todos
                        <span aria-hidden>×</span>
                      </button>
                    </div>
                  );
                })()}

                {/* NIVEL 1 — KPI hero row + valor patrimonial */}
                <KpiHeroRow
                  properties={properties}
                  inquilinos={inquilinos}
                  pagos={pagos}
                  contratos={contratos}
                  incidencias={incidencias}
                  filterPropertyId={dashboardFilterPropertyId}
                />

                {/* NIVEL 2 — CTA "He cobrado" */}
                <HeCobradoCTA
                  properties={properties}
                  inquilinos={inquilinos}
                  pagos={pagos}
                  contratos={contratos}
                  filterPropertyId={dashboardFilterPropertyId}
                  onIrACobrar={(propertyId) => {
                    setHeCobradoPropertyId(propertyId);
                  }}
                  onHeComprado={() => setGastoRapidoOpen(true)}
                />

                {/* NIVEL 3 — Lista compacta de activos */}
                <ActivosCompactList
                  properties={properties}
                  inquilinos={inquilinos}
                  pagos={pagos}
                  contratos={contratos}
                  filterPropertyId={dashboardFilterPropertyId}
                  onOpenActivo={(propertyId) => setFichaPropertyId(propertyId)}
                />

                {/* NIVEL 4 — Gráfica de tesorería */}
                <TesoreriaMiniChart
                  properties={properties}
                  inquilinos={inquilinos}
                  pagos={pagos}
                  contratos={contratos}
                  incidencias={incidencias}
                  filterPropertyId={dashboardFilterPropertyId}
                  filterPropertyName={
                    dashboardFilterPropertyId
                      ? (properties.find(p => p.id === dashboardFilterPropertyId)?.nombre_interno ||
                          (properties.find(p => p.id === dashboardFilterPropertyId) as any)?.direccion ||
                          null)
                      : null
                  }
                />

                {/* NIVEL 5 — Secciones colapsables al fondo */}
                <SeccionColapsable
                  title="Centro de salud patrimonial"
                  subtitle="Estado global de tus activos, contratos y documentación"
                  icon={<Activity size={16} />}
                  defaultOpen={incidencias.filter(i => i.estado !== "Cerrada").length > 0}
                  badge={
                    incidencias.filter(i => i.estado !== "Cerrada").length > 0
                      ? {
                          label: String(incidencias.filter(i => i.estado !== "Cerrada").length) + " alertas",
                          tone: "warn",
                        }
                      : null
                  }
                >
                  <div className="space-y-6">
                    <CentroSaludPatrimonio
                      properties={
                        dashboardFilterPropertyId
                          ? properties.filter(p => p.id === dashboardFilterPropertyId)
                          : properties
                      }
                      inquilinos={inquilinos}
                      contratos={
                        dashboardFilterPropertyId
                          ? contratos.filter(c => c.property_id === dashboardFilterPropertyId)
                          : contratos
                      }
                      pagos={
                        dashboardFilterPropertyId
                          ? pagos.filter(p => p.property_id === dashboardFilterPropertyId)
                          : pagos
                      }
                      incidencias={
                        dashboardFilterPropertyId
                          ? incidencias.filter(i => i.property_id === dashboardFilterPropertyId)
                          : incidencias
                      }
                      onVerAlertas={() => setActiveTab("incidencias")}
                      onVerVencimientos={() => setActiveTab("propiedades")}
                      onVerPendientes={() => {
                        setActiveTab("propiedades");
                        if (firstActiveProperty) setInitialPropertyId(firstActiveProperty.id);
                      }}
                      onVerAuditoria={() => window.dispatchEvent(new Event("cr:open-auditoria"))}
                      onAbrirRevision={(contratoId, fechaSugerida) => {
                        setRevisionContratoId(contratoId);
                        setRevisionFechaSugerida(fechaSugerida);
                      }}
                      onAbrirRenovacion={(contratoId) => setRenovacionContratoId(contratoId)}
                    />
                    <CentroSaludDocumental onVerDocumentos={() => setActiveTab("documentos")} />
                  </div>
                </SeccionColapsable>

                <SeccionColapsable
                  title="Tareas pendientes"
                  subtitle="Revisiones, renovaciones y pagos por confirmar"
                  icon={<ListTodo size={16} />}
                  defaultOpen={totalReminders > 0}
                  badge={totalReminders > 0 ? { label: String(totalReminders) + " pendientes", tone: "warn" } : null}
                >
                  <TareasPendientesPanel
                    filterPropertyId={dashboardFilterPropertyId}
                    onNavigate={(r) => {
                      if (r.tipo === "revision_renta_anualidad") {
                        const contratoId = String(r.origen_id || "").split(":")[0];
                        if (contratoId) {
                          setRevisionContratoId(contratoId);
                          setRevisionFechaSugerida(r.fecha_objetivo || undefined);
                        }
                        return;
                      }
                      if (r.tipo === "renovacion_sugerida") {
                        const contratoId = String(r.origen_id || "").split(":")[0];
                        if (contratoId) setRenovacionContratoId(contratoId);
                        return;
                      }
                      if (r.origen_tipo === "documento") setActiveTab("documentos");
                      else if (r.origen_tipo === "contrato" || r.origen_tipo === "pago_renta") setActiveTab("propiedades");
                      else if (r.origen_tipo === "auditoria") window.dispatchEvent(new Event("cr:open-auditoria"));
                    }}
                  />
                </SeccionColapsable>

                <SeccionColapsable
                  title="Calendario"
                  subtitle="Eventos, vencimientos y pagos por fecha"
                  icon={<CalendarDays size={16} />}
                  defaultOpen={false}
                >
                  <CalendarioHorizontal
                    properties={
                      dashboardFilterPropertyId
                        ? properties.filter(p => p.id === dashboardFilterPropertyId)
                        : properties
                    }
                    inquilinos={inquilinos}
                    pagos={
                      dashboardFilterPropertyId
                        ? pagos.filter(p => p.property_id === dashboardFilterPropertyId)
                        : pagos
                    }
                    eventos={
                      dashboardFilterPropertyId
                        ? eventos.filter(e => e.property_id === dashboardFilterPropertyId)
                        : eventos
                    }
                    incidencias={
                      dashboardFilterPropertyId
                        ? incidencias.filter(i => i.property_id === dashboardFilterPropertyId)
                        : incidencias
                    }
                    filterPropertyId={dashboardFilterPropertyId}
                    contratos={contratos}
                    onCreateEvento={createEvento}
                    onUpdateEvento={updateEvento}
                    onDeleteEvento={deleteEvento}
                    onConfirmarPago={async (propertyId, inquilinoId, datos, mes, anio) => {
                      await confirmarPago(propertyId, inquilinoId, mes, anio, datos, user?.id || "");
                    }}
                    onContratoVencimientoClick={(contratoId) => {
                      setRenovacionContratoId(contratoId);
                    }}
                  />
                </SeccionColapsable>

                <SeccionColapsable
                  title="Recordatorios inteligentes"
                  subtitle="Alertas proactivas por activo"
                  icon={<BellRing size={16} />}
                  defaultOpen={totalReminders > 0}
                  badge={totalReminders > 0 ? { label: String(totalReminders) + " pendientes", tone: "warn" } : null}
                >
                  <SmartRemindersPanel
                    propertyHealths={
                      dashboardFilterPropertyId
                        ? propertyHealths.filter(h => h.property.id === dashboardFilterPropertyId)
                        : propertyHealths
                    }
                    totalReminders={totalReminders}
                    onNavigateProperty={(id) => setInitialPropertyId(id)}
                    onNavigateIncidencias={(id) => {
                      setFilterPropertyId(id);
                      setActiveTab("incidencias");
                    }}
                    onIPCUpdate={(contratoId) => setIpcContratoId(contratoId)}
                  />
                </SeccionColapsable>
              </>
            )}
          <PropertiesTabContent
            key={`props-${tabResetKey}`}
            properties={properties} inquilinos={inquilinos} incidencias={incidencias}
            propsLoading={propsLoading} pagos={pagos} eventos={eventos} userId={user!.id}
            contratos={contratos}
            profile={profile}
            createProperty={createProperty} updateProperty={updateProperty} deleteProperty={deleteProperty}
            uploadPhoto={uploadPhoto} getPhotos={getPhotos} deletePhoto={deletePhoto}
            createInquilino={createInquilino} deleteInquilino={deleteInquilino} refetchInquilinos={refetchInquilinos}
            onNavigateToIncidencias={(propertyId) => { setFilterPropertyId(propertyId); setActiveTab("incidencias"); }}
            onViewIncidencia={(inc) => { setPendingIncidencia(inc); setActiveTab("incidencias"); }}
            onAddInquilino={(property) => { setInquilinoPrefilledPropertyId(property.id); setInquilinoToEdit(null); setActiveTab("inquilinos"); }}
            onEditInquilino={(inq) => { setInquilinoToEdit(inq); setInquilinoPrefilledPropertyId(null); setActiveTab("inquilinos"); }}
            confirmarPago={confirmarPago} updatePago={updatePago} deletePago={deletePago}
            createEvento={createEvento} updateEvento={updateEvento} deleteEvento={deleteEvento}
            fetchPropertyMensajes={fetchPropertyMensajes} createPropertyMensaje={createPropertyMensaje}
            updatePropertyMensaje={updatePropertyMensaje} deletePropertyMensaje={deletePropertyMensaje}
            fetchDocumentos={fetchDocumentos} uploadDocumento={uploadDocumento} deleteDocumento={deleteDocumento}
            updateInquilino={updateInquilino}
            reorderInquilinos={reorderInquilinos}
            refetchContratos={refetchContratos}
            initialPropertyId={initialPropertyId}
            hideSummaryBlocks={properties.length > 0}
          />
          </>
        ) : activeTab === "inquilinos" ? (
          <motion.div key={`inq-${tabResetKey}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <InquilinosSection
              inquilinos={inquilinos} properties={properties} incidencias={incidencias} loading={inquilinosLoading}
              onCreate={createInquilino} onUpdate={updateInquilino} onDelete={deleteInquilino}
              onReorder={reorderInquilinos}
              fetchDocumentos={fetchDocumentos} uploadDocumento={uploadDocumento} deleteDocumento={deleteDocumento}
              prefilledPropertyId={inquilinoPrefilledPropertyId} editInquilino={inquilinoToEdit}
              onConsumeAction={() => { setInquilinoPrefilledPropertyId(null); setInquilinoToEdit(null); }}
              contratos={contratos}
              onLinkContrato={(inq) => {
                setContractGeneratorData({
                  propertyId: inq.property_id || undefined,
                  inquilinoId: inq.id,
                });
                setShowContractGenerator(true);
              }}
            />
          </motion.div>
        ) : activeTab === "incidencias" ? (
          <IncidenciasTabContent
            key={`inc-${tabResetKey}`}
            incidencias={incidencias} properties={properties} inquilinos={inquilinos} loading={incidenciasLoading}
            filterPropertyId={filterPropertyId} onClearFilter={() => setFilterPropertyId(null)}
            createIncidencia={createIncidencia} updateIncidencia={updateIncidencia} deleteIncidencia={deleteIncidencia}
            mensajeActions={{ fetch: fetchMensajes, create: createMensaje, update: updateMensaje, delete: deleteMensaje }}
            evidenciaActions={{ fetch: fetchEvidencias, upload: uploadEvidencia, delete: deleteEvidencia }}
            citacionActions={{ fetch: fetchCitaciones, create: createCitacion, update: updateCitacion, delete: deleteCitacion }}
            documentoActions={{ fetch: fetchIncDocumentos, upload: uploadIncDocumento, delete: deleteIncDocumento }}
            createPropertyMensaje={createPropertyMensaje}
            proveedores={proveedores}
            initialIncidencia={pendingIncidencia}
            initialView={pendingIncidencia ? "detail" : "list"}
            onConsumeInitial={() => setPendingIncidencia(null)}
          />
        ) : activeTab === "proveedores" ? (
          <ProveedoresTabContent
            key={`prov-${tabResetKey}`}
            proveedores={proveedores}
            loading={proveedoresLoading}
            createProveedor={createProveedor}
            updateProveedor={updateProveedor}
            deleteProveedor={deleteProveedor}
          />
        ) : activeTab === "finanzas" ? (
          <motion.div key={`tes-${tabResetKey}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <TesoreriaGeneralTab properties={properties} inquilinos={inquilinos} pagos={pagos} />
          </motion.div>
        ) : activeTab === "documentacion" ? (
          <motion.div key={`doc-${tabResetKey}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <DocumentacionTab properties={properties} inquilinos={inquilinos} profile={profile} onPropertyCreated={refetchProperties} onInquilinoCreated={refetchInquilinos} />
          </motion.div>
        ) : activeTab === "documentos" ? (
          // Compat: 'documentos' (antes "Archivos") ahora vive dentro de Documentación → 'otros'.
          <motion.div key={`doc-${tabResetKey}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <DocumentacionTab properties={properties} inquilinos={inquilinos} profile={profile} onPropertyCreated={refetchProperties} onInquilinoCreated={refetchInquilinos} />
          </motion.div>
        ) : activeTab === "fiscalidad" ? (
          <FiscalidadTab
            key={`fisc-${tabResetKey}`}
            onNavigate={(target) => {
              if (target.section === "perfil") {
                setEditOpen(true);
                return;
              }
              if (target.propertyId) {
                setInitialPropertyId(target.propertyId);
              }
              setActiveTab(target.tab);
            }}
          />
        ) : null}
      </main>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} profile={profile} onSave={handleSaveProfile} />

      {/* Ficha lateral del activo abierta desde el dashboard */}
      <FichaInmuebleSheet
        open={!!fichaProperty}
        onClose={() => setFichaPropertyId(null)}
        property={fichaProperty}
        onDelete={async (p) => { await deleteProperty(p.id); }}
      />

      {/* He cobrado: lanzado desde el CTA del dashboard */}
      <HeCobradoSheet
        open={!!heCobradoPropertyId}
        onOpenChange={(v) => { if (!v) setHeCobradoPropertyId(null); }}
        properties={properties}
        inquilinos={inquilinos}
        contratos={contratos}
        pagos={pagos}
        userId={user?.id}
        initialPropertyId={heCobradoPropertyId ?? undefined}
        onConfirmar={async (propertyId, inquilinoId, datos, mes, anio) => {
          await confirmarPago(propertyId, inquilinoId, mes, anio, datos, user?.id || "");
        }}
        onVerHistorialRentas={(propertyId) => {
          setHeCobradoPropertyId(null);
          setPagosHistorialSheetPropertyId(propertyId);
        }}
      />

      {/* He comprado: registro rápido de gastos con OCR */}
      <GastoRapidoSheet
        open={gastoRapidoOpen}
        onOpenChange={setGastoRapidoOpen}
        properties={properties}
        defaultPropertyId={dashboardFilterPropertyId}
      />

      {/* Historial de pagos: lanzado desde HeCobradoSheet → "Ver historial de rentas" */}
      <PagosHistorialSheet
        open={!!pagosHistorialSheetPropertyId}
        onOpenChange={(v) => { if (!v) setPagosHistorialSheetPropertyId(null); }}
        propertyId={pagosHistorialSheetPropertyId}
        properties={properties}
        inquilinos={inquilinos}
        contratos={contratos || []}
        pagos={pagos}
        userId={user?.id || ""}
        onUpdatePago={updatePago}
        onDeletePago={deletePago}
        onConfirmarPago={confirmarPago}
      />

      <GeneradorContrato
        open={showContractGenerator}
        onOpenChange={(v) => {
          setShowContractGenerator(v);
          if (!v) setContractGeneratorData(null);
        }}
        properties={properties}
        inquilinos={inquilinos}
        profile={profile || null}
        initialData={contractGeneratorData}
        onInquilinoCreated={refetchInquilinos}
        onContractSaved={refetchInquilinos}
      />

      {ipcContrato && (
        <IPCUpdateDialog
          open={!!ipcContratoId}
          onOpenChange={(open) => { if (!open) setIpcContratoId(null); }}
          contrato={ipcContrato}
          tenantName={ipcTenantName}
          context={ipcContext}
          onApply={handleIPCApply}
        />
      )}

      <RevisionRentaSheet
        open={!!revisionContratoId}
        onClose={() => { setRevisionContratoId(null); setRevisionFechaSugerida(undefined); }}
        contrato={revisionContrato}
        fechaSugerida={revisionFechaSugerida}
      />

      <RenovacionContratoSheet
        open={!!renovacionContratoId}
        onClose={() => setRenovacionContratoId(null)}
        contrato={renovacionContrato}
        onNegociar={(c) => {
          setRenovacionContratoId(null);
          setInitialPropertyId(c.property_id);
          setActiveTab("propiedades");
          toast({ title: "Negociar condiciones", description: "Abre el contrato para modificar renta, duración o cláusulas." });
        }}
      />

      <ProgresoInteligenteToast
        mensaje={progresoInteligente.mensaje}
        visible={progresoInteligente.visible}
        onCerrar={progresoInteligente.cerrar}
        onAccion={() => {
          const m = progresoInteligente.mensaje;
          progresoInteligente.ejecutarAccion();
          if (!m) return;
          switch (m.accion.tipo) {
            case "abrir-activo":
              setActiveTab("propiedades");
              if (m.accion.propertyId) setInitialPropertyId(m.accion.propertyId);
              break;
            case "abrir-contrato":
              setActiveTab("propiedades");
              if (m.accion.propertyId) setInitialPropertyId(m.accion.propertyId);
              break;
            case "abrir-fiscalidad":
              setActiveTab("fiscalidad");
              break;
            case "navegar":
              if (m.accion.ruta) navigate(m.accion.ruta);
              break;
          }
        }}
      />

      {/* Sprint 3 · Admin debug links (solo con ?debug=true) */}
      {new URLSearchParams(window.location.search).get("debug") === "true" && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-1 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
          <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
            Sprint 3 · Admin
          </div>
          <a href="/admin/backfill-contratos" className="text-primary hover:underline font-mono">
            /admin/backfill-contratos
          </a>
          <a href="/admin/reconciliacion-pagos" className="text-primary hover:underline font-mono">
            /admin/reconciliacion-pagos
          </a>
          <a href="/admin/sprint3-telemetria" className="text-primary hover:underline font-mono">
            /admin/sprint3-telemetria
          </a>
        </div>
      )}

      {/* Mini-calendario flotante: acceso rápido desde cualquier punto del panel */}
      {activeTab === "propiedades" && properties.length > 0 && (
        <CalendarioMiniWidget
          properties={properties}
          inquilinos={inquilinos}
          pagos={pagos}
          eventos={eventos}
          incidencias={incidencias}
          contratos={contratos}
          filterPropertyId={dashboardFilterPropertyId}
          toastVisible={progresoInteligente.visible}
          onCreateEvento={createEvento}
          onUpdateEvento={updateEvento}
          onDeleteEvento={deleteEvento}
          onConfirmarPago={async (propertyId, inquilinoId, datos, mes, anio) => {
            await confirmarPago(propertyId, inquilinoId, mes, anio, datos, user?.id || "");
          }}
        />
      )}
    </div>
  );
};

export default PropietariosPanel;
