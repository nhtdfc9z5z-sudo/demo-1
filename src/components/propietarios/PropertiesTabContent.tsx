import { useState, useCallback, useMemo, useEffect } from "react";
import { resolveRentaEsperada, resolveFechasContrato } from "@/lib/rentaUtils";
import { stripHonorifics } from "@/lib/nameUtils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { insertContratoRow } from "@/lib/altas/raw";
import { crearActivo } from "@/lib/altas/crearActivo";
import { useQueryClient } from "@tanstack/react-query";
import { Home, BedDouble, Car, Archive, Briefcase, Store, Mountain, Building2, LayoutGrid, Ship, Caravan, Palmtree, PartyPopper } from "lucide-react";
import PropertiesSection from "./PropertiesSection";
import { useAltaAlquiler } from "./AltaAlquilerContext";
import GeneradorContrato, { type GeneradorContratoInitialData } from "./GeneradorContrato";
import PropertyForm from "./PropertyForm";
import PropertyCreateWizard from "./PropertyCreateWizard";
import PropertyCreatedSuccessSheet from "./PropertyCreatedSuccessSheet";
import HabitacionWizard from "../inmuebles/HabitacionWizard";
import GarajeWizard from "../inmuebles/GarajeWizard";
import TrasteroWizard from "../inmuebles/TrasteroWizard";
import OficinaWizard from "../inmuebles/OficinaWizard";
import LocalNaveWizard from "../inmuebles/LocalNaveWizard";
import TerrenoWizard from "../inmuebles/TerrenoWizard";
import EdificioWizard from "../inmuebles/EdificioWizard";
import ActivoSimpleWizard from "../inmuebles/ActivoSimpleWizard";
import PropertyHistorialSection from "./PropertyHistorialSection";
import PropertyDocumentacionView from "./PropertyDocumentacionView";
import ContratosSection from "./ContratosSection";
import PagosHistorial from "./PagosHistorial";
import InquilinoDetailPanel from "./InquilinoDetailPanel";
import FichaInmuebleSheet from "./ficha/FichaInmuebleSheet";
import type { Property, PropertyPhoto } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Incidencia } from "@/hooks/useIncidencias";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { PropertyEvento } from "@/hooks/usePropertyEventos";
import type { PropertyMensaje } from "@/hooks/usePropertyMensajes";
import type { Contrato } from "@/hooks/useContratos";
import type { PanelTab } from "./PanelHeader";

type View = "list" | "form";

interface PropertiesTabContentProps {
  properties: Property[];
  inquilinos: Inquilino[];
  incidencias: Incidencia[];
  propsLoading: boolean;
  pagos: PagoRenta[];
  eventos: PropertyEvento[];
  userId: string;
  contratos?: Contrato[];
  profile?: { nombre?: string | null; apellidos?: string | null; nif?: string | null; email?: string | null; telefono?: string | null } | null;
  // Property CRUD
  createProperty: (data: any) => Promise<Property | null>;
  updateProperty: (id: string, data: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  uploadPhoto: (propertyId: string, file: File, orden: number) => Promise<any>;
  getPhotos: (propertyId: string) => Promise<PropertyPhoto[]>;
  deletePhoto: (photo: PropertyPhoto) => Promise<void>;
  // Inquilino
  createInquilino: (data: Partial<Inquilino>) => Promise<Inquilino | null>;
  deleteInquilino: (id: string) => Promise<void>;
  refetchInquilinos: () => void;
  // Incidencia navigation
  onNavigateToIncidencias: (propertyId: string) => void;
  onViewIncidencia: (inc: Incidencia) => void;
  // Inquilino actions from property
  onAddInquilino: (property: Property) => void;
  onEditInquilino: (inq: Inquilino) => void;
  // Pagos
  confirmarPago: (propertyId: string, inquilinoId: string, mes: number, anio: number, datos: any, ownerId: string) => Promise<void>;
  updatePago: (pagoId: string, datos: any) => Promise<void>;
  deletePago: (pagoId: string) => Promise<void>;
  // Eventos
  createEvento: (data: any) => Promise<any>;
  updateEvento: (id: string, data: any) => Promise<void>;
  deleteEvento: (id: string) => Promise<void>;
  // Property messages
  fetchPropertyMensajes: (propertyId: string) => Promise<PropertyMensaje[]>;
  createPropertyMensaje: (propertyId: string, autor: string, mensaje: string, incidenciaId?: string | null) => Promise<void>;
  updatePropertyMensaje: (id: string, mensaje: string) => Promise<void>;
  deletePropertyMensaje: (id: string) => Promise<void>;
  // Document panel
  fetchDocumentos: (id: string) => Promise<any[]>;
  uploadDocumento: (id: string, file: File, cat: string) => Promise<any>;
  deleteDocumento: (doc: any) => Promise<void>;
  updateInquilino: (id: string, data: Partial<Inquilino>) => Promise<void>;
  reorderInquilinos?: (orderedIds: string[]) => Promise<void>;
  refetchContratos?: () => void;
  initialPropertyId?: string | null;
  /** Modo embebido: oculta los bloques de resumen porque ya están en el dashboard. */
  hideSummaryBlocks?: boolean;
}

const PropertiesTabContent = ({
  properties, inquilinos, incidencias, propsLoading, pagos, eventos, userId, contratos, profile,
  createProperty, updateProperty, deleteProperty, uploadPhoto, getPhotos, deletePhoto,
  createInquilino, deleteInquilino, refetchInquilinos,
  onNavigateToIncidencias, onViewIncidencia,
  onAddInquilino, onEditInquilino,
  confirmarPago, updatePago, deletePago,
  createEvento, updateEvento, deleteEvento,
  fetchPropertyMensajes, createPropertyMensaje, updatePropertyMensaje, deletePropertyMensaje,
  fetchDocumentos, uploadDocumento, deleteDocumento, updateInquilino, reorderInquilinos,
  refetchContratos,
  initialPropertyId,
  hideSummaryBlocks,
}: PropertiesTabContentProps) => {
  const { toast } = useToast();
  const altaAlquiler = useAltaAlquiler();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("list");
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formPhotos, setFormPhotos] = useState<PropertyPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [propertyInitialData, setPropertyInitialData] = useState<Record<string, unknown> | null>(null);
  const [contractOriginalFile, setContractOriginalFile] = useState<File | null>(null);
  const [historialPropertyId, setHistorialPropertyId] = useState<string | null>(null);
  const [propertyMensajes, setPropertyMensajes] = useState<PropertyMensaje[]>([]);
  const [propertyMensajesLoading, setPropertyMensajesLoading] = useState(false);
  const [pagosHistorialPropertyId, setPagosHistorialPropertyId] = useState<string | null>(null);
  const [detailInquilinoFromProps, setDetailInquilinoFromProps] = useState<Inquilino | null>(null);
  const [showNewContractGenerator, setShowNewContractGenerator] = useState(false);
  const [fichaProperty, setFichaProperty] = useState<Property | null>(null);
  const [contractGeneratorInitialData, setContractGeneratorInitialData] = useState<GeneradorContratoInitialData | null>(null);
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [wizardInitialData, setWizardInitialData] = useState<Record<string, unknown> | null>(null);
  const [successProperty, setSuccessProperty] = useState<Property | null>(null);
  const [docPropertyId, setDocPropertyId] = useState<string | null>(null);
  const [contratosPropertyId, setContratosPropertyId] = useState<string | null>(null);
  const [inmuebleWizard, setInmuebleWizard] = useState<string | null>(null);
  const [activeInmuebleTab, setActiveInmuebleTab] = useState<string>("todos");

  // Fase 5 — escucha del picker unificado de intención.
  // 'cr:open-alta-vivienda'    → abrir el wizard manual de vivienda.
  // 'cr:open-alta-otro-activo' → abrir directamente el sub-wizard del tipo.
  useEffect(() => {
    const openVivienda = () => { setWizardInitialData(null); setShowManualWizard(true); };
    const openOtro = (e: Event) => {
      const tipo = (e as CustomEvent<{ tipo: string }>).detail?.tipo;
      if (tipo) setInmuebleWizard(tipo);
    };
    window.addEventListener("cr:open-alta-vivienda", openVivienda);
    window.addEventListener("cr:open-alta-otro-activo", openOtro as EventListener);
    return () => {
      window.removeEventListener("cr:open-alta-vivienda", openVivienda);
      window.removeEventListener("cr:open-alta-otro-activo", openOtro as EventListener);
    };
  }, []);

  // Filter properties by tipo_inmueble for tabs
  const filteredProperties = useMemo(() => {
    if (activeInmuebleTab === "todos") return properties;
    const tipoMap: Record<string, string> = {
      viviendas: "vivienda",
      habitaciones: "habitacion",
      garajes: "garaje",
      trasteros: "trastero",
      oficinas: "oficina",
      locales: "local_nave",
      terrenos: "terreno",
      edificios: "edificio",
    };
    const tipo = tipoMap[activeInmuebleTab];
    if (!tipo) return properties;
    return properties.filter(p => (p as any).tipo_inmueble === tipo);
  }, [properties, activeInmuebleTab]);

  // Count by tipo for tab badges
  const countByTipo = useMemo(() => {
    const counts: Record<string, number> = { vivienda: 0, habitacion: 0, garaje: 0, trastero: 0, oficina: 0, local_nave: 0, terreno: 0, edificio: 0 };
    for (const p of properties) {
      const tipo = (p as any).tipo_inmueble || "vivienda";
      counts[tipo] = (counts[tipo] || 0) + 1;
    }
    return counts;
  }, [properties]);

  const openForm = useCallback(async (property?: Property) => {
    setEditingProperty(property ?? null);
    if (property) {
      const photos = await getPhotos(property.id);
      setFormPhotos(photos);
    } else {
      setFormPhotos([]);
    }
    setView("form");
  }, [getPhotos]);

  // Auto-open property form when navigated from banner
  useEffect(() => {
    if (initialPropertyId) {
      const prop = properties.find(p => p.id === initialPropertyId);
      if (prop) openForm(prop);
    }
  }, [initialPropertyId]);

  const handleSaveProperty = async (data: Record<string, unknown>) => {
    if (editingProperty) {
      await updateProperty(editingProperty.id, data as Partial<Property>);
    } else {
      const created = await createProperty(data as any);
      if (created) {
        setEditingProperty(created);
        const isFromContrato = propertyInitialData?._fromContrato === true;
        const arrendatarios = propertyInitialData?.arrendatarios as { nombre: string; nif?: string; telefono?: string; email?: string }[] | undefined;

        // Auto-create inquilinos from extracted data
        const createdInquilinoIds: string[] = [];
        if (arrendatarios && Array.isArray(arrendatarios)) {
          for (const arr of arrendatarios) {
            if (!arr.nombre) continue;
            const cleanName = stripHonorifics(arr.nombre);
            const nameParts = cleanName.trim().split(/\s+/);
            const inq = await createInquilino({
              nombre: nameParts[0],
              apellidos: nameParts.slice(1).join(" ") || null,
              dni: arr.nif || null,
              telefono: arr.telefono || null,
              email: arr.email || null,
              property_id: created.id,
              estado: "activo",
            } as any);
            if (inq) createdInquilinoIds.push(inq.id);
          }
          toast({ title: "Inquilinos creados", description: `Se han creado ${arrendatarios.length} inquilino(s) del contrato.` });
          refetchInquilinos();
        }

        // Auto-create contract record when source was a lease contract upload
        if (isFromContrato) {
          try {
            let docPath: string | null = null;
            let docNombre: string | null = null;

            // Upload original PDF to storage
            if (contractOriginalFile) {
              const fileName = `${Date.now()}-${contractOriginalFile.name}`;
              const storagePath = `${userId}/${fileName}`;
              const { error: uploadErr } = await supabase.storage
                .from("contratos")
                .upload(storagePath, contractOriginalFile);
              if (!uploadErr) {
                docPath = storagePath;
                docNombre = contractOriginalFile.name;
              }
            }

            // Parse contract data from initialData
            const rentaMensual = propertyInitialData?.renta_mensual ? Number(propertyInitialData.renta_mensual) : null;
            const fianzaImporte = propertyInitialData?.fianza_importe ? Number(propertyInitialData.fianza_importe) : null;
            const depositoGarantia = propertyInitialData?.deposito_garantia ? Number(propertyInitialData.deposito_garantia) : null;
            const fechaInicio = propertyInitialData?.fecha_inicio_contrato as string | null || null;
            const fechaFin = propertyInitialData?.fecha_fin_contrato as string | null || null;

            let contratoErr: unknown = null;
            try {
              await insertContratoRow({
                property_id: created.id,
                inquilino_id: createdInquilinoIds[0] || null,
                titulo: `Contrato - ${created.nombre_interno}`,
                estado: "vigente",
                renta_mensual: rentaMensual,
                fianza_importe: fianzaImporte,
                deposito_garantia: depositoGarantia,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                // [H2.9] Contrato importado existente: CapitalRent empieza a
                // controlar pagos desde HOY. No se calcula deuda anterior.
                fecha_inicio_control: new Date().toISOString().slice(0, 10),
                documento_original_path: docPath,
                documento_original_nombre: docNombre,
                agua_paga_inquilino: propertyInitialData?.agua_paga_inquilino ?? true,
                luz_paga_inquilino: propertyInitialData?.luz_paga_inquilino ?? true,
                gas_paga_inquilino: propertyInitialData?.gas_paga_inquilino ?? true,
                internet_paga_inquilino: propertyInitialData?.internet_paga_inquilino ?? true,
                ibi_paga_inquilino: propertyInitialData?.ibi_paga_inquilino ?? false,
                basuras_paga_inquilino: propertyInitialData?.basuras_paga_inquilino ?? false,
              }, {
                vincularInquilinos: createdInquilinoIds.filter(Boolean) as string[],
              });
            } catch (e) {
              contratoErr = e;
            }

            if (contratoErr) {
              console.error("Error creating contract:", contratoErr);
            } else {
              toast({ title: "Contrato vinculado", description: "El contrato original se ha vinculado automáticamente al activo." });
              refetchContratos?.();
            }
          } catch (err) {
            console.error("Error in auto-contract creation:", err);
          }
        }
      }
    }
    setView("list");
    setPropertyInitialData(null);
    setContractOriginalFile(null);
  };

  /**
   * Convierte el objeto plano de PropertyCreateWizard.buildSaveData() en el
   * input tipado de `crearActivo`. La regla del proyecto exige que toda
   * creación de activos pase por `src/lib/altas/crearActivo`, no por inserts
   * directos ni por el atajo legacy de `useProperties.createProperty`.
   */
  const crearActivoDesdeWizardData = async (
    data: Record<string, unknown>,
  ): Promise<Property | null> => {
    const TYPED_KEYS = new Set([
      "nombre_interno",
      "tipo_via", "nombre_via", "numero",
      "numero_portal", "escalera", "bloque", "planta", "puerta",
      "urbanizacion", "ciudad", "municipio", "provincia", "codigo_postal",
      "superficie_m2", "num_habitaciones", "num_banos",
      "referencia_catastral", "ano_construccion",
      "direccion_completa", // recalculada por insertPropertyRow
    ]);
    const extra: Record<string, unknown> = { tipo_inmueble: "vivienda" };
    for (const [k, v] of Object.entries(data)) {
      if (!TYPED_KEYS.has(k) && v !== undefined) extra[k] = v;
    }
    try {
      const { id } = await crearActivo({
        tipo: "vivienda",
        nombre_interno: String(data.nombre_interno || ""),
        direccion: {
          tipo_via: (data.tipo_via as string) || null,
          nombre_via: (data.nombre_via as string) || null,
          numero: (data.numero as string) || null,
          portal: (data.numero_portal as string) || null,
          escalera: (data.escalera as string) || null,
          bloque: (data.bloque as string) || null,
          planta: (data.planta as string) || null,
          puerta: (data.puerta as string) || null,
          urbanizacion: (data.urbanizacion as string) || null,
          codigo_postal: (data.codigo_postal as string) || null,
          municipio: (data.municipio as string) || (data.ciudad as string) || null,
          provincia: (data.provincia as string) || null,
          pais: "España",
        },
        superficie_m2: (data.superficie_m2 as number | null) ?? null,
        num_habitaciones: (data.num_habitaciones as number | null) ?? null,
        num_banos: (data.num_banos as number | null) ?? null,
        ano_construccion: (data.ano_construccion as number | null) ?? null,
        referencia_catastral: (data.referencia_catastral as string) || null,
        extra,
        meta: { origen: "alta_activo_manual" },
      });
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      // Recuperamos el registro completo para tener todos los campos de Property.
      const { data: full } = await supabase
        .from("properties").select("*").eq("id", id).single();
      return (full as Property) ?? null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "No se pudo crear", description: msg, variant: "destructive" });
      return null;
    }
  };

  const handleWizardSave = async (data: Record<string, unknown>) => {
    const created = await crearActivoDesdeWizardData(data);
    if (created) {
      toast({ title: "Vivienda creada", description: `"${created.nombre_interno}" se ha añadido correctamente.` });
      setSuccessProperty(created);
    }
  };

  const handleSaveAndAddInquilino = async (data: Record<string, unknown>) => {
    const created = await createProperty(data as any);
    if (created) {
      setView("list");
      setPropertyInitialData(null);
      onAddInquilino(created);
    }
  };

  const handleSaveAndAddContrato = async (data: Record<string, unknown>) => {
    const created = await createProperty(data as any);
    if (created) {
      setView("list");
      setPropertyInitialData(null);
      setContractGeneratorInitialData({ propertyId: created.id });
      setShowNewContractGenerator(true);
    }
  };

  const handleUploadPhotos = async (files: File[]) => {
    if (!editingProperty) {
      toast({ title: "Guarda primero", description: "Guarda la vivienda antes de subir fotos.", variant: "destructive" });
      return;
    }
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      await uploadPhoto(editingProperty.id, files[i], formPhotos.length + i);
    }
    const updated = await getPhotos(editingProperty.id);
    setFormPhotos(updated);
    setUploading(false);
  };

  const handleDeletePhoto = async (photo: PropertyPhoto) => {
    await deletePhoto(photo);
    setFormPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const handleMarkAlDia = async (propertyId: string) => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return;
    const propInquilinos = inquilinos.filter(i => i.property_id === propertyId && i.rol_inquilino !== "avalista");
    const now = new Date();
    let earliestEntry: Date | null = null;
    for (const inq of propInquilinos) {
      if (!inq.fecha_entrada) continue;
      const d = new Date(inq.fecha_entrada);
      if (!earliestEntry || d < earliestEntry) earliestEntry = d;
    }
    if (!earliestEntry) return;

    for (const inq of propInquilinos) {
      if (!inq.fecha_entrada) continue;
      const entrada = new Date(inq.fecha_entrada);
      let year = entrada.getFullYear();
      let month = entrada.getMonth() + 1;
      while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
        const existing = pagos.find(p => p.property_id === propertyId && p.inquilino_id === inq.id && p.mes === month && p.anio === year);
        if (!existing) {
          await confirmarPago(propertyId, inq.id, month, year, {
            importe_pagado: resolveRentaEsperada(propertyId, [inq], contratos || []) || inq.renta_mensual || 0,
            tipo_pago: "transferencia",
            notas_acuerdo: "Pago anterior al alta en la plataforma",
          }, userId);
        }
        month++;
        if (month > 12) { month = 1; year++; }
      }
    }

    const gastosToCreate: Array<{ categoria: string; concepto: string; importe: number; recurrencia: string }> = [];
    if (prop.cuota_comunidad && prop.cuota_comunidad > 0) {
      gastosToCreate.push({ categoria: "comunidad", concepto: "Cuota de comunidad", importe: Number(prop.cuota_comunidad), recurrencia: "mensual" });
    }
    if (prop.ibi_importe && prop.ibi_importe > 0 && !prop.ibi_paga_inquilino) {
      gastosToCreate.push({ categoria: "ibi", concepto: "IBI", importe: Number(prop.ibi_importe), recurrencia: "anual" });
    }
    if (prop.basuras_importe && prop.basuras_importe > 0 && !prop.basuras_paga_inquilino) {
      gastosToCreate.push({ categoria: "basuras", concepto: "Basuras", importe: Number(prop.basuras_importe), recurrencia: "anual" });
    }
    const seguros = Array.isArray(prop.seguros) ? prop.seguros : [];
    for (const seg of seguros as Array<{ tipo?: string; compania?: string; importe?: number }>) {
      if (seg.importe && seg.importe > 0) {
        if (seg.tipo === "impago" && prop.seguro_impago_paga_inquilino) continue;
        gastosToCreate.push({
          categoria: seg.tipo === "impago" ? "seguro_impago" : "seguro_vivienda",
          concepto: seg.compania ? `Seguro · ${seg.compania}` : "Seguro",
          importe: Number(seg.importe),
          recurrencia: "anual",
        });
      }
    }
    if (prop.tiene_derrama && prop.importe_derrama && prop.importe_derrama > 0) {
      gastosToCreate.push({ categoria: "derrama", concepto: "Derrama", importe: Number(prop.importe_derrama), recurrencia: "mensual" });
    }

    const recurrenciaMonths: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
    const insertRows: Array<Record<string, unknown>> = [];
    for (const gasto of gastosToCreate) {
      const stepMonths = recurrenciaMonths[gasto.recurrencia] || 1;
      let y = earliestEntry.getFullYear();
      let m = earliestEntry.getMonth();
      while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
        insertRows.push({
          user_id: userId, property_id: propertyId, categoria: gasto.categoria,
          concepto: gasto.concepto, importe: gasto.importe,
          fecha: `${y}-${String(m + 1).padStart(2, "0")}-01`,
          recurrente: false, notas: "Gasto simulado anterior al alta en la plataforma",
        });
        m += stepMonths;
        while (m > 11) { m -= 12; y++; }
      }
    }
    if (insertRows.length > 0) {
      const { error } = await supabase.from("property_gastos").insert(insertRows as any);
      if (error) console.error("Error inserting historical expenses:", error);
    }
    toast({ title: "Vivienda al día", description: `Se han generado ${insertRows.length} registros de gastos históricos.` });
  };

  if (contratosPropertyId) {
    const contratoProp = properties.find(p => p.id === contratosPropertyId);
    if (contratoProp) {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <ContratosSection
            properties={properties}
            inquilinos={inquilinos}
            profile={profile}
            onBack={() => setContratosPropertyId(null)}
            onPropertyCreated={() => {}}
            onInquilinoCreated={refetchInquilinos}
          />
        </motion.div>
      );
    }
  }

  if (docPropertyId) {
    const docProperty = properties.find(p => p.id === docPropertyId);
    if (docProperty) {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PropertyDocumentacionView
            property={docProperty}
            contratos={contratos?.filter(c => c.property_id === docPropertyId)}
            onBack={() => setDocPropertyId(null)}
          />
        </motion.div>
      );
    }
  }

  if (pagosHistorialPropertyId) {
    const histProp = properties.find(p => p.id === pagosHistorialPropertyId);
    const histInq = inquilinos.find(i => i.property_id === pagosHistorialPropertyId && i.rol_inquilino !== "avalista");
    const histFechas = resolveFechasContrato(pagosHistorialPropertyId, inquilinos, contratos || []);
    const histContrato = (contratos || []).find(
      c => c.property_id === pagosHistorialPropertyId && !c.archivado && c.estado !== "finalizado",
    );
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <PagosHistorial
          pagos={pagos.filter(p => p.property_id === pagosHistorialPropertyId)}
          rentaMensual={pagosHistorialPropertyId ? resolveRentaEsperada(pagosHistorialPropertyId, inquilinos, contratos || []) : null}
          propertyName={histProp?.nombre_interno || ""}
          propertyId={pagosHistorialPropertyId}
          inquilinoId={histInq?.id}
          fechaInicio={histFechas.fechaInicio}
          fechaFin={histFechas.fechaFin}
          fechaInicioControl={histContrato?.fecha_inicio_control || histContrato?.fecha_inicio || null}
          userId={userId}
          onBack={() => setPagosHistorialPropertyId(null)}
          onUpdatePago={updatePago}
          onDeletePago={deletePago}
          onConfirmarPago={confirmarPago}
        />
      </motion.div>
    );
  }

  if (historialPropertyId) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-4">
          <button onClick={() => setHistorialPropertyId(null)} className="text-sm text-primary hover:underline">
            ← Volver a mis activos
          </button>
          <h2 className="text-xl font-semibold text-foreground mt-2">
            {properties.find(p => p.id === historialPropertyId)?.nombre_interno} — Historial
          </h2>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <PropertyHistorialSection
            propertyId={historialPropertyId}
            incidencias={incidencias.filter(i => i.property_id === historialPropertyId)}
            mensajes={propertyMensajes}
            loading={propertyMensajesLoading}
            onRefresh={async () => {
              setPropertyMensajesLoading(true);
              const msgs = await fetchPropertyMensajes(historialPropertyId);
              setPropertyMensajes(msgs);
              setPropertyMensajesLoading(false);
            }}
            onCreate={async (autor, mensaje) => {
              await createPropertyMensaje(historialPropertyId, autor, mensaje);
              const msgs = await fetchPropertyMensajes(historialPropertyId);
              setPropertyMensajes(msgs);
            }}
            onUpdate={async (id, mensaje) => {
              await updatePropertyMensaje(id, mensaje);
              const msgs = await fetchPropertyMensajes(historialPropertyId);
              setPropertyMensajes(msgs);
            }}
            onDelete={async (id) => {
              await deletePropertyMensaje(id);
              const msgs = await fetchPropertyMensajes(historialPropertyId);
              setPropertyMensajes(msgs);
            }}
            onViewIncidencia={onViewIncidencia}
          />
        </div>
      </motion.div>
    );
  }

  const isFromContrato = propertyInitialData?._fromContrato === true;

  if (view === "form") {
    return (
      <PropertyForm
        property={editingProperty} photos={formPhotos}
        initialData={propertyInitialData}
        inquilinos={editingProperty ? inquilinos.filter(i => i.property_id === editingProperty.id) : []}
        contratos={contratos || []}
        onSave={handleSaveProperty}
        onSaveAndAddInquilino={!editingProperty && !isFromContrato ? handleSaveAndAddInquilino : undefined}
        onSaveAndAddContrato={!editingProperty && !isFromContrato ? handleSaveAndAddContrato : undefined}
        onUploadPhotos={handleUploadPhotos}
        onDeletePhoto={handleDeletePhoto} onBack={() => { setView("list"); setPropertyInitialData(null); setContractOriginalFile(null); }} uploading={uploading}
        onViewContrato={editingProperty ? () => { setView("list"); setContratosPropertyId(editingProperty.id); } : undefined}
        onCreateContrato={editingProperty ? () => {
          setContractGeneratorInitialData({ propertyId: editingProperty.id });
          setShowNewContractGenerator(true);
        } : undefined}
      />
    );
  }

  const INMUEBLE_TABS = [
    { key: "todos", label: "Todos", icon: LayoutGrid, count: properties.length },
    { key: "viviendas", label: "Viviendas", icon: Home, count: countByTipo.vivienda },
    { key: "habitaciones", label: "Habitaciones", icon: BedDouble, count: countByTipo.habitacion },
    { key: "garajes", label: "Garajes", icon: Car, count: countByTipo.garaje },
    { key: "trasteros", label: "Trasteros", icon: Archive, count: countByTipo.trastero },
    { key: "oficinas", label: "Oficinas", icon: Briefcase, count: countByTipo.oficina },
    { key: "locales", label: "Locales/Naves", icon: Store, count: countByTipo.local_nave },
    { key: "terrenos", label: "Terrenos", icon: Mountain, count: countByTipo.terreno },
    { key: "edificios", label: "Edificios", icon: Building2, count: countByTipo.edificio },
  ];

  const totalOtherItems = properties.length - countByTipo.vivienda;
  const showTabs = totalOtherItems > 0 || (activeInmuebleTab !== "todos");

  return (
    <>
      {/* Tabs */}
      {!hideSummaryBlocks && showTabs && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {INMUEBLE_TABS.map(tab => {
            const isActive = activeInmuebleTab === tab.key;
            const TabIcon = tab.icon;
            if (tab.count === 0 && !isActive && tab.key !== "viviendas" && tab.key !== "todos") return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveInmuebleTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active tab content - always show PropertiesSection with filtered properties */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <PropertiesSection
          properties={filteredProperties} inquilinos={inquilinos} incidencias={incidencias} loading={propsLoading}
          hideSummaryBlocks={hideSummaryBlocks}
          onAdd={() => altaAlquiler.openPicker()} onAddInmueble={(tipo) => setInmuebleWizard(tipo)} onView={(p) => openForm(p)} onDelete={(p) => deleteProperty(p.id)}
          onAddInquilino={onAddInquilino}
          onEditInquilino={onEditInquilino}
          onDeleteInquilino={async (inq) => deleteInquilino(inq.id)}
          onViewInquilino={(inq) => setDetailInquilinoFromProps(inq)}
          onUpdateTipoAlquiler={async (propertyId, tipo) => {
            await updateProperty(propertyId, { tipo_alquiler: tipo } as any);
          }}
          onMarkAlDia={handleMarkAlDia}
          onIncidencias={(property) => onNavigateToIncidencias(property.id)}
          onHistorial={async (property) => {
            setHistorialPropertyId(property.id);
            setPropertyMensajesLoading(true);
            const msgs = await fetchPropertyMensajes(property.id);
            setPropertyMensajes(msgs);
            setPropertyMensajesLoading(false);
          }}
          pagos={pagos}
          onConfirmarPago={async (propertyId, inquilinoId, datos) => {
            const now = new Date();
            await confirmarPago(propertyId, inquilinoId, now.getMonth() + 1, now.getFullYear(), datos, userId);
          }}
          onPagosHistorial={(property) => setPagosHistorialPropertyId(property.id)}
          eventos={eventos}
          onCreateEvento={createEvento}
          onUpdateEvento={updateEvento}
          onDeleteEvento={deleteEvento}
          contratos={contratos}
          onCalendarConfirmarPago={async (propertyId, inquilinoId, datos, mes, anio) => {
            await confirmarPago(propertyId, inquilinoId, mes, anio, datos, userId);
          }}
          onViewContrato={(property) => setContratosPropertyId(property.id)}
          onViewDocumentacion={(property) => setDocPropertyId(property.id)}
          onUpdateProperty={updateProperty}
          onReorderInquilinos={reorderInquilinos}
          onAbrirFicha={(p) => setFichaProperty(p)}
          onNavigateToNewContract={(data) => {
            setContractGeneratorInitialData(data);
            setShowNewContractGenerator(true);
          }}
          onCalendarEventClick={undefined}
          onIncidenciaClick={(incidenciaId) => {
            const inc = incidencias.find(i => i.id === incidenciaId);
            if (inc) onViewIncidencia(inc);
          }}
        />
      </motion.div>

      <PropertyCreateWizard
        open={showManualWizard}
        onOpenChange={setShowManualWizard}
        initialData={wizardInitialData}
        onSave={handleWizardSave}
      />

      <GeneradorContrato
        open={showNewContractGenerator}
        onOpenChange={(v) => {
          setShowNewContractGenerator(v);
          if (!v) setContractGeneratorInitialData(null);
        }}
        properties={properties}
        inquilinos={inquilinos}
        profile={profile || null}
        initialData={contractGeneratorInitialData}
        onInquilinoCreated={refetchInquilinos}
        onContractSaved={refetchInquilinos}
      />
    
      <InquilinoDetailPanel
        inquilino={detailInquilinoFromProps} properties={properties} incidencias={incidencias}
        contratos={contratos}
        open={!!detailInquilinoFromProps} onClose={() => setDetailInquilinoFromProps(null)}
        onEdit={(inq) => { setDetailInquilinoFromProps(null); onEditInquilino(inq); }}
        fetchDocumentos={fetchDocumentos} uploadDocumento={uploadDocumento} deleteDocumento={deleteDocumento}
        onUpdateTipo={async (id, tipo) => { await updateInquilino(id, { tipo_inquilino: tipo } as any); }}
      />

      <HabitacionWizard open={inmuebleWizard === "habitacion"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "habitacion" } as any); }} />
      <GarajeWizard open={inmuebleWizard === "garaje"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "garaje" } as any); }} />
      <TrasteroWizard open={inmuebleWizard === "trastero"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "trastero" } as any); }} />
      <OficinaWizard open={inmuebleWizard === "oficina"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "oficina" } as any); }} />
      <LocalNaveWizard open={inmuebleWizard === "local_nave"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "local_nave" } as any); }} />
      <TerrenoWizard open={inmuebleWizard === "terreno"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "terreno" } as any); }} />
      <EdificioWizard open={inmuebleWizard === "edificio"} onOpenChange={(v) => !v && setInmuebleWizard(null)} onSave={async (data) => { await createProperty({ ...data, tipo_inmueble: "edificio" } as any); }} />
      <ActivoSimpleWizard
        open={inmuebleWizard === "barco"}
        onOpenChange={(v) => !v && setInmuebleWizard(null)}
        tipo="barco" tipoLabel="Barco" TipoIcon={Ship}
        nombrePlaceholder="Velero familiar, Lancha del puerto..."
        ubicacionFija={false} ubicacionLabel="Puerto base"
      />
      <ActivoSimpleWizard
        open={inmuebleWizard === "caravana_camper"}
        onOpenChange={(v) => !v && setInmuebleWizard(null)}
        tipo="caravana_camper" tipoLabel="Caravana o camper" TipoIcon={Caravan}
        nombrePlaceholder="Camper familiar, Caravana del lago..."
        ubicacionFija={false} ubicacionLabel="Lugar habitual de aparcamiento"
      />
      <ActivoSimpleWizard
        open={inmuebleWizard === "vacacional"}
        onOpenChange={(v) => !v && setInmuebleWizard(null)}
        tipo="vacacional" tipoLabel="Vivienda vacacional" TipoIcon={Palmtree}
        nombrePlaceholder="Apartamento de la playa, Casa rural..."
      />
      <ActivoSimpleWizard
        open={inmuebleWizard === "finca_eventos"}
        onOpenChange={(v) => !v && setInmuebleWizard(null)}
        tipo="finca_eventos" tipoLabel="Finca para eventos" TipoIcon={PartyPopper}
        nombrePlaceholder="Finca de bodas, Cortijo de eventos..."
      />
      <FichaInmuebleSheet
        open={!!fichaProperty}
        onClose={() => setFichaProperty(null)}
        property={fichaProperty}
        onDelete={async (p) => { await deleteProperty(p.id); }}
      />

      <PropertyCreatedSuccessSheet
        open={!!successProperty}
        onOpenChange={(o) => { if (!o) setSuccessProperty(null); }}
        property={successProperty}
        onAddInquilinoYContrato={(p) => {
          setSuccessProperty(null);
          altaAlquiler.open({ viviendaId: p.id, intencion: "alquiler" });
        }}
        onIrAFicha={(p) => {
          setSuccessProperty(null);
          setFichaProperty(p);
        }}
      />
    </>
  );
};

export default PropertiesTabContent;
