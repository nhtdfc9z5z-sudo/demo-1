import { useState, useRef, useMemo } from "react";
import { stripHonorifics } from "@/lib/nameUtils";
import { getContratoStatus, sortContratosByUrgency, hasActiveContrato, type ContratoStatusInfo } from "@/lib/contratoStatusUtils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, ScrollText, Upload, FileText, Trash2, ExternalLink, Home, User, CalendarDays, Euro, Sparkles, Loader2, MessageSquare, Wand2, Search, SortAsc, SortDesc, Filter, CheckCircle2, PlusCircle, Building2, Pencil, Shield, Clock, TrendingUp, Percent, Archive, History, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Send, Mail, FileDown, Download, Copy } from "lucide-react";
import { generateContratoResumenPdf, type ResumenContext } from "@/lib/contratoResumenPdf";
import { getContractDocumentUrl, openContractDocumentFromRef, resolveGeneratedContractDocument, resolveOriginalContractDocument } from "@/lib/contractDocumentUtils";
import { SecureFileLink } from "@/components/common/SecureFileLink";
import HistoricalRentWizard from "./HistoricalRentWizard";
import { useAltaAlquiler } from "./AltaAlquilerContext";
import { useRentaActualizaciones } from "@/hooks/useRentaActualizaciones";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { logContratoEvento } from "@/lib/contratoHistorialEvents";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useContratos, type Contrato, type ContratoAnalysis, type ContratoArrendatario, type ContratoHistorial } from "@/hooks/useContratos";
import { supabase } from "@/integrations/supabase/client";
import { useProperties } from "@/hooks/useProperties";
import { useInquilinos } from "@/hooks/useInquilinos";
import ChatContrato from "./ChatContrato";
import GeneradorContrato from "./GeneradorContrato";
import ContratoDetailSheet from "./ContratoDetailSheet";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import { calcularFechaFin, derivarDuracion } from "@/lib/contratos/duracion";

interface ContratosSectionProps {
  properties: Property[];
  inquilinos: Inquilino[];
  profile?: { nombre?: string | null; apellidos?: string | null; nif?: string | null; email?: string | null; telefono?: string | null } | null;
  onBack: () => void;
  onPropertyCreated?: () => void;
  onInquilinoCreated?: () => void;
}

const ESTADO_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  vigente: { label: "Vigente", variant: "default" },
  finalizado: { label: "Finalizado", variant: "secondary" },
  renovado: { label: "Prorrogado", variant: "outline" },
};

type WizardStep = "upload" | "match" | "details";

const ContratosSection = ({ properties, inquilinos, profile = null, onBack, onPropertyCreated, onInquilinoCreated }: ContratosSectionProps) => {
  const alta = useAltaAlquiler();
  const { toast } = useToast();
  const { contratos, loading, createContrato, updateContrato, updateContratoWithHistory, deleteContrato, archiveContrato, uploadArchivo, uploadDocumentoOriginal, analyzeContrato, createCalendarEvents, addHistorial, fetchHistorial, refetch: refetchContratos } = useContratos();
  const { createProperty } = useProperties();
  const { createInquilino } = useInquilinos();

  const [showNew, setShowNew] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [chatContrato, setChatContrato] = useState<Contrato | null>(null);
  const [resumenPreview, setResumenPreview] = useState<ResumenContext | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [form, setForm] = useState<Partial<Contrato>>({});
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Detail sheet state
  const [detailContrato, setDetailContrato] = useState<Contrato | null>(null);
  const [detailIpcInfo, setDetailIpcInfo] = useState<{ oldRenta: number; newRenta: number; percent: number } | null>(null);

  // Legacy edit state (kept for inline actions)
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [editForm, setEditForm] = useState<Partial<Contrato>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterProperty, setFilterProperty] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"fecha" | "renta" | "titulo">("fecha");
  const [sortAsc, setSortAsc] = useState(false);

  // Wizard state for smart upload
  const [wizardStep, setWizardStep] = useState<WizardStep>("upload");
  const [analysis, setAnalysis] = useState<ContratoAnalysis | null>(null);
  const [propertyChoice, setPropertyChoice] = useState<"existing" | "new">("existing");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [inquilinoChoice, setInquilinoChoice] = useState<"existing" | "new" | "none">("new");
  const [selectedInquilinoId, setSelectedInquilinoId] = useState<string>("");
  const [creatingEntities, setCreatingEntities] = useState(false);

  // IPC adjustment state
  const [ipcContratoId, setIpcContratoId] = useState<string | null>(null);
  const [ipcPercent, setIpcPercent] = useState<string>("2.3");
  const [ipcApplying, setIpcApplying] = useState(false);
  const [ipcConfirmStep, setIpcConfirmStep] = useState<"none" | "legal" | "notify">("none");
  const [ipcPendingContrato, setIpcPendingContrato] = useState<Contrato | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [historialMap, setHistorialMap] = useState<Record<string, ContratoHistorial[]>>({});
  const [expandedHistorial, setExpandedHistorial] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [historicalWizardData, setHistoricalWizardData] = useState<{
    contratoId: string; propertyId: string; inquilinoId: string; rentaMensual: number; fechaInicio: string; propertyName: string;
  } | null>(null);

  const { user } = useAuth();
  const { confirmarPago, registrarHistorico, registrarHistoricoBatch } = usePagosRenta();
  const { addActualizacion } = useRentaActualizaciones(historicalWizardData?.propertyId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  // Try to auto-match property by address
  const suggestedProperty = useMemo(() => {
    if (!analysis?.direccion_inmueble) return null;
    const addr = analysis.direccion_inmueble.toLowerCase();
    return properties.find((p) => {
      const pAddr = (p.direccion_completa || "").toLowerCase();
      if (!pAddr) return false;
      // Fuzzy: check if significant words match
      const words = addr.split(/[\s,]+/).filter(w => w.length > 3);
      const matches = words.filter(w => pAddr.includes(w));
      return matches.length >= Math.min(2, words.length);
    }) || null;
  }, [analysis, properties]);

  // Normalize arrendatarios list from analysis
  const normalizedArrendatarios: ContratoArrendatario[] = useMemo(() => {
    if (!analysis) return [];
    const cleanList = (list: ContratoArrendatario[]) => list.map(a => ({ ...a, nombre: stripHonorifics(a.nombre) }));
    if (analysis.arrendatarios && analysis.arrendatarios.length > 0) return cleanList(analysis.arrendatarios);
    if (analysis.arrendatario_nombre) {
      return [{
        nombre: stripHonorifics(analysis.arrendatario_nombre),
        nif: analysis.arrendatario_nif,
        telefono: analysis.arrendatario_telefono,
        email: analysis.arrendatario_email,
      }];
    }
    return [];
  }, [analysis]);

  // Calculate status info for each contract (memoized)
  const contratoStatusMap = useMemo(() => {
    const map = new Map<string, ContratoStatusInfo>();
    for (const c of contratos) {
      map.set(c.id, getContratoStatus(c));
    }
    return map;
  }, [contratos]);

  const getStatusInfo = (c: Contrato) => contratoStatusMap.get(c.id)!;

  const filteredContratos = useMemo(() => {
    let list = [...contratos];
    // Filter by archived status
    if (!showArchived) {
      list = list.filter((c) => !c.archivado);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const inq = c.inquilino_id ? inquilinos.find((i) => i.id === c.inquilino_id) : null;
        const inquilinoName = inq ? `${inq.nombre}${inq.apellidos ? " " + inq.apellidos : ""}` : "";
        const propertyName = properties.find((p) => p.id === c.property_id)?.nombre_interno || "";
        return c.titulo.toLowerCase().includes(q) || (c.notas || "").toLowerCase().includes(q) || propertyName.toLowerCase().includes(q) || inquilinoName.toLowerCase().includes(q);
      });
    }
    if (filterEstado !== "todos") list = list.filter((c) => c.estado === filterEstado);
    if (filterProperty !== "todos") list = list.filter((c) => c.property_id === filterProperty);
    
    // Sort by urgency by default, or by user-selected sort
    if (sortBy === "fecha" && !sortAsc) {
      // Default sort → use urgency-based sorting
      list = sortContratosByUrgency(list, getStatusInfo);
    } else {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "fecha") cmp = (a.fecha_inicio || a.created_at).localeCompare(b.fecha_inicio || b.created_at);
        else if (sortBy === "renta") cmp = (a.renta_mensual || 0) - (b.renta_mensual || 0);
        else cmp = a.titulo.localeCompare(b.titulo);
        return sortAsc ? cmp : -cmp;
      });
    }
    return list;
  }, [contratos, search, filterEstado, filterProperty, sortBy, sortAsc, properties, inquilinos, showArchived, contratoStatusMap]);

  const inquilinosByProperty = (propertyId: string) =>
    inquilinos.filter((i) => i.property_id === propertyId && (i.estado === "activo" || i.estado === "Activo"));

  const resetWizard = () => {
    setWizardStep("upload");
    setAnalysis(null);
    setPropertyChoice("existing");
    setSelectedPropertyId("");
    setInquilinoChoice("new");
    setSelectedInquilinoId("");
    setForm({});
    setPendingFile(null);
    setAnalyzing(false);
    setCreatingEntities(false);
  };

  const handleFileSelected = async (file: File) => {
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "contract", toast)) return;
    setPendingFile(file);
    setAnalyzing(true);
    const result = await analyzeContrato(file);
    setAnalyzing(false);
    if (result) {
      setAnalysis(result);
      // Pre-fill form
      setForm({
        titulo: result.titulo || "Contrato de arrendamiento",
        fecha_inicio: result.fecha_inicio || undefined,
        fecha_fin: result.fecha_fin || undefined,
        renta_mensual: result.renta_mensual ?? undefined,
        estado: result.estado || "vigente",
        notas: result.notas || undefined,
        duracion_anos: result.duracion_anos ?? undefined,
        prorroga_anos: result.prorroga_anos ?? undefined,
        preaviso_meses: result.preaviso_meses ?? undefined,
        fianza_importe: result.fianza_importe ?? undefined,
        deposito_garantia: result.deposito_garantia ?? undefined,
      });
      // Auto-select suggested matches
      if (suggestedProperty) {
        setPropertyChoice("existing");
        setSelectedPropertyId(suggestedProperty.id);
      } else {
        setPropertyChoice("new");
      }
      if (normalizedArrendatarios.length > 0) {
        setInquilinoChoice("new");
      }
      setWizardStep("match");
    } else {
      // Analysis failed, go to manual mode
      setWizardStep("details");
    }
  };

  const handleMatchConfirm = async () => {
    setCreatingEntities(true);
    let propertyId = selectedPropertyId;
    let inquilinoId = selectedInquilinoId;

    // Create new property if needed
    if (propertyChoice === "new" && analysis) {
      const tipoAlquilerMap: Record<string, string> = {
        // Compat: enum heredado de la edge analyze-contrato.
        larga_duracion: "larga duración",
        habitual: "larga duración",
        vacacional: "vacacional",
        habitacion: "habitación",
        habitaciones: "habitación",
        explotacion: "explotación",
        rent_to_rent: "explotación",
        cesion_empresa: "larga duración",
      };
      const newProp = await createProperty({
        nombre_interno: analysis.direccion_inmueble || `Vivienda - ${analysis.titulo || "Nuevo"}`,
        direccion_completa: analysis.direccion_inmueble || null,
        numero_portal: analysis.direccion_numero || null,
        planta: analysis.direccion_planta || null,
        puerta: analysis.direccion_puerta || null,
        codigo_postal: analysis.direccion_codigo_postal || null,
        ciudad: analysis.direccion_ciudad || null,
        provincia: analysis.direccion_provincia || null,
        tipo_alquiler: analysis.tipo_contrato ? (tipoAlquilerMap[analysis.tipo_contrato] || null) : null,
        agua_paga_inquilino: analysis.agua_paga_inquilino ?? true,
        luz_paga_inquilino: analysis.luz_paga_inquilino ?? true,
        gas_paga_inquilino: analysis.gas_paga_inquilino ?? true,
        internet_paga_inquilino: analysis.internet_paga_inquilino ?? true,
        ibi_paga_inquilino: analysis.ibi_paga_inquilino ?? false,
        basuras_paga_inquilino: analysis.basuras_paga_inquilino ?? false,
        cuota_comunidad: analysis.cuota_comunidad ?? null,
      });
      if (newProp) {
        propertyId = newProp.id;
        onPropertyCreated?.();
      } else {
        setCreatingEntities(false);
        return;
      }
    }

    // Create new inquilinos if needed (supports multiple)
    if (inquilinoChoice === "new" && normalizedArrendatarios.length > 0) {
      for (const arr of normalizedArrendatarios) {
        const nameParts = arr.nombre.split(" ");
        const nombre = nameParts[0] || arr.nombre;
        const apellidos = nameParts.slice(1).join(" ") || null;
        const newInq = await createInquilino({
          nombre,
          apellidos,
          dni: arr.nif || null,
          telefono: arr.telefono || null,
          email: arr.email || null,
          property_id: propertyId || null,
          // Financial fields stored on contrato (source of truth), kept on inquilino as legacy fallback
          renta_mensual: analysis.renta_mensual ?? null,
          fianza: analysis.fianza_importe ?? null,
          deposito_garantia: analysis.deposito_garantia ?? null,
          fecha_entrada: analysis.fecha_inicio || null,
          fecha_salida: analysis.fecha_fin || null,
          estado: "activo",
        });
        if (newInq && !inquilinoId) {
          inquilinoId = newInq.id; // Use first created as contract's inquilino_id
        }
      }
      onInquilinoCreated?.();
    }

    setForm((f) => ({
      ...f,
      property_id: propertyId,
      inquilino_id: inquilinoId || undefined,
    }));
    setSelectedPropertyId(propertyId);
    setSelectedInquilinoId(inquilinoId);
    setCreatingEntities(false);
    setWizardStep("details");
  };

  const handleCreate = async () => {
    if (!form.property_id) return;
    // Validate: no duplicate active contracts per property
    if (hasActiveContrato(contratos, form.property_id) && form.estado !== "finalizado") {
      const propName = properties.find(p => p.id === form.property_id)?.nombre_interno || "este activo";
      toast({
        title: "Contrato activo existente",
        description: `"${propName}" ya tiene un contrato vigente. Archiva el anterior antes de crear uno nuevo.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    // Auto-copy suministros from linked property
    const prop = properties.find(p => p.id === form.property_id);
    const suministrosDefaults = prop ? {
      agua_paga_inquilino: prop.agua_paga_inquilino,
      luz_paga_inquilino: prop.luz_paga_inquilino,
      gas_paga_inquilino: prop.gas_paga_inquilino,
      internet_paga_inquilino: prop.internet_paga_inquilino,
      ibi_paga_inquilino: prop.ibi_paga_inquilino,
      basuras_paga_inquilino: prop.basuras_paga_inquilino,
      comunidad_paga_inquilino: false,
      cuota_comunidad: prop.cuota_comunidad,
    } : {};
    const created = await createContrato({ ...form, ...suministrosDefaults });
    if (created) {
      if (pendingFile) await uploadDocumentoOriginal(created.id, pendingFile);
      const finalContrato = { ...created, ...form, ...suministrosDefaults } as Contrato;
      if (finalContrato.fecha_fin) await createCalendarEvents(finalContrato);

      // Check if contract started in the past — offer historical rent import
      if (form.fecha_inicio && form.renta_mensual && form.inquilino_id) {
        const startDate = new Date(form.fecha_inicio);
        const now = new Date();
        const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + now.getMonth() - startDate.getMonth();
        if (monthsDiff >= 1) {
          setHistoricalWizardData({
            contratoId: created.id,
            propertyId: created.property_id,
            inquilinoId: form.inquilino_id,
            rentaMensual: form.renta_mensual,
            fechaInicio: form.fecha_inicio,
            propertyName: prop?.nombre_interno || "Activo",
          });
        }
      }
    }
    setSaving(false);
    setShowNew(false);
    resetWizard();
  };

  const handleUpload = async (contratoId: string, file: File) => {
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "contract", toast)) return;
    setUploadingId(contratoId);
    await uploadDocumentoOriginal(contratoId, file);
    setUploadingId(null);
  };

  const handleIpcApply = async (contrato: Contrato) => {
    const pct = parseFloat(ipcPercent);
    if (isNaN(pct) || !contrato.renta_mensual) return;
    // Open detail sheet directly in edit mode with new rent
    const oldRenta = contrato.renta_mensual;
    const newRenta = Math.round((oldRenta * (1 + pct / 100)) * 100) / 100;
    setIpcContratoId(null);
    setDetailIpcInfo({ oldRenta, newRenta, percent: pct });
    setDetailContrato(contrato);
  };

  const toggleHistorial = async (contratoId: string) => {
    if (expandedHistorial === contratoId) {
      setExpandedHistorial(null);
      return;
    }
    setExpandedHistorial(contratoId);
    if (!historialMap[contratoId]) {
      const h = await fetchHistorial(contratoId);
      setHistorialMap((prev) => ({ ...prev, [contratoId]: h }));
    }
  };

  const handleReanalyze = async (contrato: Contrato) => {
    const documentRef = resolveOriginalContractDocument(contrato) || resolveGeneratedContractDocument(contrato);
    if (!documentRef) return;

    setReanalyzingId(contrato.id);
    try {
      let sourceUrl: string | null = null;

      if (documentRef.storagePath) {
        sourceUrl = await getContractDocumentUrl(documentRef.storagePath);
      } else if (documentRef.url) {
        sourceUrl = documentRef.url;
      }

      if (!sourceUrl) throw new Error("No se pudo obtener el documento para reanálisis");

      const response = await fetch(sourceUrl);
      const blob = await response.blob();
      const file = new File([blob], documentRef.fileName || "contrato.pdf", { type: blob.type || "application/pdf" });
      const result = await analyzeContrato(file);
      if (result) {
        const updates: Partial<Contrato> = {};
        if (result.duracion_anos != null) updates.duracion_anos = result.duracion_anos;
        if (result.prorroga_anos != null) updates.prorroga_anos = result.prorroga_anos;
        if (result.preaviso_meses != null) updates.preaviso_meses = result.preaviso_meses;
        if (result.fianza_importe != null) updates.fianza_importe = result.fianza_importe;
        if (result.deposito_garantia != null) updates.deposito_garantia = result.deposito_garantia;
        if (result.renta_mensual != null && !contrato.renta_mensual) updates.renta_mensual = result.renta_mensual;
        if (result.fecha_inicio && !contrato.fecha_inicio) updates.fecha_inicio = result.fecha_inicio;
        if (result.fecha_fin && !contrato.fecha_fin) updates.fecha_fin = result.fecha_fin;
        if (result.notas) updates.notas = result.notas;
        if (Object.keys(updates).length > 0) {
          await updateContratoWithHistory(contrato, updates, "Re-análisis del contrato", "Se han actualizado los campos extraídos del PDF");
        }
      }
    } catch (e) {
      console.error("Re-analyze error:", e);
    }
    setReanalyzingId(null);
  };

  const getPropertyName = (id: string) => properties.find((p) => p.id === id)?.nombre_interno || "—";
  const getInquilinoName = (id: string | null) => {
    if (!id) return null;
    const inq = inquilinos.find((i) => i.id === id);
    return inq ? `${inq.nombre}${inq.apellidos ? " " + inq.apellidos : ""}` : null;
  };

  const openEdit = (c: Contrato) => {
    setEditingContrato(c);
    setEditForm({
      titulo: c.titulo,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      renta_mensual: c.renta_mensual,
      estado: c.estado,
      notas: c.notas,
      property_id: c.property_id,
      inquilino_id: c.inquilino_id || undefined,
      duracion_anos: c.duracion_anos,
      prorroga_anos: c.prorroga_anos,
      preaviso_meses: c.preaviso_meses,
      fianza_importe: c.fianza_importe,
      deposito_garantia: c.deposito_garantia,
    });
    setEditFile(null);
  };

  const handleEditSave = async () => {
    if (!editingContrato) return;
    setEditSaving(true);
    // Mark as reviewed when user saves edits
    await updateContrato(editingContrato.id, { ...editForm, revisado_por_usuario: true } as any);
    if (editFile) await uploadDocumentoOriginal(editingContrato.id, editFile);
    // Update calendar events if fecha_fin or fecha_inicio changed
    if (editForm.fecha_fin !== editingContrato.fecha_fin || editForm.fecha_inicio !== editingContrato.fecha_inicio) {
      await createCalendarEvents({ ...editingContrato, ...editForm, property_id: editForm.property_id || editingContrato.property_id } as Contrato);
    }
    setEditSaving(false);
    setEditingContrato(null);
  };

  // Chat panel
  if (chatContrato) {
    const prop = properties.find((p) => p.id === chatContrato.property_id);
    const inq = chatContrato.inquilino_id ? inquilinos.find((i) => i.id === chatContrato.inquilino_id) : null;
    return (
      <div>
        <button onClick={() => setChatContrato(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft size={16} /> Volver a Contratos
        </button>
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ height: "70vh" }}>
          <ChatContrato contrato={chatContrato} property={prop} inquilino={inq} onClose={() => setChatContrato(null)} />
        </div>
      </div>
    );
  }

  // Render wizard step content for dialog
  const renderWizardContent = () => {
    if (wizardStep === "upload") {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Nuevo contrato de arrendamiento</DialogTitle>
            <DialogDescription>Elige cómo quieres añadir el contrato.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {/* Option A: Upload existing */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="w-full border-2 border-border rounded-xl p-5 flex items-start gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait text-left group"
              >
                {analyzing ? (
                  <div className="flex flex-col items-center w-full gap-2 py-4">
                    <Loader2 size={28} className="text-primary animate-spin" />
                    <span className="text-sm font-medium text-foreground">Analizando contrato con IA…</span>
                    <span className="text-xs text-muted-foreground">Extrayendo vivienda, inquilino, fechas, renta y cláusulas</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Upload size={22} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ya tengo un contrato</p>
                      <p className="text-xs text-muted-foreground mt-1">Sube el PDF y la IA extraerá todos los datos automáticamente: vivienda, inquilino, fechas, renta y cláusulas.</p>
                    </div>
                  </>
                )}
              </button>
            </div>

            {/* Option B: Create new */}
            <button
              onClick={() => { setShowNew(false); resetWizard(); setShowGenerator(true); }}
              className="w-full border-2 border-border rounded-xl p-5 flex items-start gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Sparkles size={22} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Crear contrato nuevo</p>
                <p className="text-xs text-muted-foreground mt-1">Rellena los datos del contrato y genera el documento con ayuda de IA. Puedes usar tus propias plantillas.</p>
              </div>
            </button>
          </div>
        </>
      );
    }

    if (wizardStep === "match" && analysis) {
      return (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" /> Datos extraídos del contrato
            </DialogTitle>
            <DialogDescription>Revisa la información detectada y elige cómo asociarla.</DialogDescription>
          </DialogHeader>
           <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
            {/* Extracted summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              {analysis.titulo && <p><span className="font-medium text-foreground">Título:</span> {analysis.titulo}</p>}
              {analysis.direccion_inmueble && <p><span className="font-medium text-foreground">Dirección:</span> {analysis.direccion_inmueble}</p>}
              {normalizedArrendatarios.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Inquilino{normalizedArrendatarios.length > 1 ? "s" : ""}:</span>
                  {normalizedArrendatarios.map((a, i) => (
                    <span key={i} className="ml-1">
                      {a.nombre}{a.nif ? ` (${a.nif})` : ""}{a.telefono ? ` · ${a.telefono}` : ""}{a.email ? ` · ${a.email}` : ""}
                      {i < normalizedArrendatarios.length - 1 ? " /" : ""}
                    </span>
                  ))}
                </div>
              )}
              {analysis.arrendador_nombre && <p><span className="font-medium text-foreground">Propietario:</span> {analysis.arrendador_nombre} {analysis.arrendador_nif ? `(${analysis.arrendador_nif})` : ""}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {analysis.fecha_inicio && <span>📅 Inicio: {analysis.fecha_inicio}</span>}
                {analysis.fecha_fin && <span>📅 Fin: {analysis.fecha_fin}</span>}
                {analysis.renta_mensual && <span>💶 Renta: {analysis.renta_mensual} €/mes</span>}
                {analysis.fianza_importe && <span>🔒 Fianza: {analysis.fianza_importe} €</span>}
                {analysis.deposito_garantia && <span>🔒 Garantía adicional: {analysis.deposito_garantia} €</span>}
                {analysis.duracion_anos && <span>⏱️ Duración: {analysis.duracion_anos} años</span>}
                {analysis.prorroga_anos && <span>🔄 Prórroga: {analysis.prorroga_anos} años</span>}
                {analysis.preaviso_meses && <span>📢 Preaviso: {analysis.preaviso_meses} meses</span>}
              </div>
              {analysis.clausula_actualizacion_renta && (
                <p className="text-muted-foreground pt-1">📊 <span className="font-medium text-foreground">Actualización renta:</span> {analysis.clausula_actualizacion_renta}</p>
              )}
              {(analysis.direccion_ciudad || analysis.direccion_codigo_postal || analysis.direccion_provincia) && (
                <p className="text-muted-foreground">📍 {[analysis.direccion_ciudad, analysis.direccion_codigo_postal, analysis.direccion_provincia].filter(Boolean).join(", ")}</p>
              )}
            </div>

            {/* Property choice */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                <Building2 size={12} className="inline mr-1" /> Vivienda
              </Label>
              <div className="grid gap-2">
                {properties.length > 0 && (
                  <button
                    onClick={() => setPropertyChoice("existing")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      propertyChoice === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <CheckCircle2 size={16} className={propertyChoice === "existing" ? "text-primary mt-0.5" : "text-muted-foreground/40 mt-0.5"} />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">Asignar a vivienda existente</p>
                      {propertyChoice === "existing" && (
                        <div className="mt-2">
                          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecciona activo" />
                            </SelectTrigger>
                            <SelectContent>
                              {properties.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre_interno}
                                  {p.direccion_completa ? ` — ${p.direccion_completa}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {suggestedProperty && selectedPropertyId !== suggestedProperty.id && (
                            <button
                              onClick={() => setSelectedPropertyId(suggestedProperty.id)}
                              className="text-xs text-primary mt-1 hover:underline"
                            >
                              💡 Sugerida: {suggestedProperty.nombre_interno}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setPropertyChoice("new")}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    propertyChoice === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <PlusCircle size={16} className={propertyChoice === "new" ? "text-primary mt-0.5" : "text-muted-foreground/40 mt-0.5"} />
                  <div>
                    <p className="text-xs font-medium text-foreground">Crear vivienda nueva</p>
                    {analysis.direccion_inmueble && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Se creará con dirección: {analysis.direccion_inmueble}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {normalizedArrendatarios.length > 0 && (
              <div>
                <Label className="text-xs font-semibold mb-2 block">
                  <User size={12} className="inline mr-1" /> Inquilino{normalizedArrendatarios.length > 1 ? `s (${normalizedArrendatarios.length})` : ""}
                </Label>
                <div className="grid gap-2">
                  {inquilinos.length > 0 && (
                    <button
                      onClick={() => setInquilinoChoice("existing")}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        inquilinoChoice === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <CheckCircle2 size={16} className={inquilinoChoice === "existing" ? "text-primary mt-0.5" : "text-muted-foreground/40 mt-0.5"} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Asignar a inquilino existente</p>
                        {inquilinoChoice === "existing" && (
                          <div className="mt-2">
                            <Select value={selectedInquilinoId} onValueChange={setSelectedInquilinoId}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
                              <SelectContent>
                                {inquilinos.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.nombre}{i.apellidos ? ` ${i.apellidos}` : ""}{i.dni ? ` (${i.dni})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => setInquilinoChoice("new")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      inquilinoChoice === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <PlusCircle size={16} className={inquilinoChoice === "new" ? "text-primary mt-0.5" : "text-muted-foreground/40 mt-0.5"} />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Crear {normalizedArrendatarios.length > 1 ? `${normalizedArrendatarios.length} inquilinos nuevos` : "inquilino nuevo"}
                      </p>
                      <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                        {normalizedArrendatarios.map((a, i) => (
                          <p key={i}>{a.nombre}{a.nif ? ` — ${a.nif}` : ""}</p>
                        ))}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setInquilinoChoice("none")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      inquilinoChoice === "none" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <CheckCircle2 size={16} className={inquilinoChoice === "none" ? "text-primary mt-0.5" : "text-muted-foreground/40 mt-0.5"} />
                    <p className="text-xs font-medium text-foreground">Sin asignar inquilino</p>
                  </button>
                </div>
              </div>
            )}

            {/* Notes preview */}
            {analysis.notas && (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Cláusulas detectadas</Label>
                <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2.5 whitespace-pre-line">{analysis.notas}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWizardStep("upload")}>Atrás</Button>
            <Button
              onClick={handleMatchConfirm}
              disabled={creatingEntities || (propertyChoice === "existing" && !selectedPropertyId)}
            >
              {creatingEntities ? <><Loader2 size={14} className="mr-1 animate-spin" /> Creando…</> : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      );
    }

    // Step 3: details (manual or post-analysis)
    return (
      <>
        <DialogHeader>
          <DialogTitle>{analysis ? "Revisar y confirmar" : "Nuevo contrato manual"}</DialogTitle>
          <DialogDescription>{analysis ? "Revisa los datos extraídos antes de guardar." : "Rellena los datos del contrato."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 max-h-[55vh] overflow-y-auto">
          {!analysis && (
            <div>
              <Label className="text-xs">Activo *</Label>
              <Select value={form.property_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, property_id: v, inquilino_id: undefined }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona activo" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!analysis && form.property_id && (
            <div>
              <Label className="text-xs">Inquilino</Label>
              <Select value={form.inquilino_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, inquilino_id: v === "none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {inquilinosByProperty(form.property_id).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nombre}{i.apellidos ? ` ${i.apellidos}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {analysis && form.property_id && (
            <div className="bg-primary/5 rounded-lg px-3 py-2 text-xs text-primary flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>
                Vivienda: <strong>{getPropertyName(form.property_id)}</strong>
                {form.inquilino_id && <> · Inquilino: <strong>{getInquilinoName(form.inquilino_id)}</strong></>}
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs">Título</Label>
            <Input value={form.titulo || ""} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Contrato de arrendamiento" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha inicio</Label>
              <Input type="date" value={form.fecha_inicio || ""} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Duración</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.duracion_anos ?? ""}
                  onChange={(e) => {
                    const n = e.target.value ? Number(e.target.value) : undefined;
                    setForm((f) => {
                      const fin = n && f.fecha_inicio
                        ? calcularFechaFin(f.fecha_inicio, n, "anos")
                        : f.fecha_fin;
                      return { ...f, duracion_anos: n, fecha_fin: fin ?? f.fecha_fin };
                    });
                  }}
                  className="w-20"
                  placeholder="Años"
                />
                <span className="self-center text-sm text-muted-foreground">años</span>
              </div>
              {form.fecha_fin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fin: {new Date(form.fecha_fin).toLocaleDateString("es-ES")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Renta mensual (€)</Label>
              <Input
                type="number"
                value={form.renta_mensual ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, renta_mensual: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={form.estado || "vigente"} onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="renovado">Renovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notas / Cláusulas</Label>
            <Textarea
              value={form.notas || ""}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Resumen de cláusulas, suministros, condiciones…"
              rows={3}
            />
          </div>

          {!analysis && (
            <div>
              <Label className="text-xs">Archivo PDF</Label>
              <div className="mt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { setPendingFile(e.target.files?.[0] || null); }}
                />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="mr-1.5" />
                  {pendingFile ? pendingFile.name : "Seleccionar archivo"}
                </Button>
              </div>
            </div>
          )}

          {pendingFile && analysis && (
            <p className="text-[11px] text-primary flex items-center gap-1">
              <FileText size={12} /> {pendingFile.name} — se adjuntará al contrato
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowNew(false); resetWizard(); }}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!form.property_id || saving}>
            {saving ? "Guardando…" : "Crear contrato"}
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a Documentación
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ScrollText size={20} className="text-primary" /> Contratos de arrendamiento
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Sube el PDF para análisis automático con IA o rellena manualmente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => alta.openPicker()}
            title="Dar de alta contrato, activo o inquilino"
          >
            <Sparkles size={14} className="mr-1" /> Dar de alta
          </Button>
          <Button size="sm" onClick={() => { resetWizard(); setShowNew(true); }}>
            <Plus size={16} className="mr-1" /> Nuevo contrato
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando contratos…</div>
      ) : contratos.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <ScrollText size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No hay contratos registrados todavía.</p>
          <Button variant="outline" size="sm" onClick={() => { resetWizard(); setShowNew(true); }}>
            <Plus size={14} className="mr-1" /> Nuevo contrato
          </Button>
        </div>
      ) : (
        <>
          {/* Search, filter & sort toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contrato, vivienda, inquilino…" className="pl-8 h-8 text-xs" />
            </div>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Filter size={12} className="mr-1 shrink-0" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="vigente">Vigente</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="renovado">Renovado</SelectItem>
              </SelectContent>
            </Select>
            {properties.length > 1 && (
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <Home size={12} className="mr-1 shrink-0" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los activos</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost" size="sm" className="h-8 text-xs px-2"
              onClick={() => {
                if (sortBy === "fecha") { if (!sortAsc) setSortAsc(true); else { setSortBy("renta"); setSortAsc(false); } }
                else if (sortBy === "renta") { if (!sortAsc) setSortAsc(true); else { setSortBy("titulo"); setSortAsc(true); } }
                else { setSortBy("fecha"); setSortAsc(false); }
              }}
            >
              {sortAsc ? <SortAsc size={14} className="mr-1" /> : <SortDesc size={14} className="mr-1" />}
              {sortBy === "fecha" ? "Fecha" : sortBy === "renta" ? "Renta" : "Título"}
            </Button>
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive size={14} className="mr-1" />
              {showArchived ? "Ocultar archivados" : "Ver archivados"}
            </Button>
          </div>

          {filteredContratos.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No se encontraron contratos con estos filtros.</div>
          ) : (
            <div className="grid gap-3">
              <p className="text-[11px] text-muted-foreground">{filteredContratos.length} de {contratos.length} contrato{contratos.length !== 1 ? "s" : ""}</p>
              {filteredContratos.map((c) => {
                const statusInfo = getStatusInfo(c);
                const inquilinoName = getInquilinoName(c.inquilino_id);
                const prop = properties.find((p) => p.id === c.property_id);
                return (
                  <div key={c.id} className={`bg-card rounded-xl border overflow-hidden transition-colors cursor-pointer ${c.archivado ? "border-muted opacity-70" : statusInfo.status === "preaviso_activo" ? "border-red-300 dark:border-red-800" : statusInfo.status === "aviso_interno" ? "border-orange-300 dark:border-orange-800" : statusInfo.status === "requiere_atencion" ? "border-amber-300 dark:border-amber-800" : "border-border hover:border-primary/20"}`} onClick={() => setDetailContrato(c)}>
                    {/* Review banner for OCR-uploaded contracts */}
                    {!c.revisado_por_usuario && c.archivo_url && !c.archivado && (
                      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <Wand2 size={14} />
                          <span className="text-xs font-medium">Datos extraídos por IA — revisa que sean correctos</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                          onClick={async () => {
                            await updateContrato(c.id, { revisado_por_usuario: true } as any);
                          }}
                        >
                          <CheckCircle2 size={10} className="mr-1" /> Marcar como revisado
                        </Button>
                      </div>
                    )}
                    {/* Header with status color bar */}
                    <div className={`h-1 w-full ${statusInfo.color}`} />
                    <div className="p-4">
                      {/* Top row: Property name (prominent) + title + actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 size={18} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{prop?.nombre_interno || "—"}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <ScrollText size={12} className="text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{c.titulo}</span>
                              <Badge variant={statusInfo.badgeVariant} className={`text-[10px] ${statusInfo.status === "preaviso_activo" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : statusInfo.status === "aviso_interno" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" : statusInfo.status === "prorrogado" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" : ""}`}>
                                {statusInfo.label}
                              </Badge>
                              {c.archivado && (
                                <Badge variant="outline" className="text-[10px] border-muted-foreground/30">
                                  <Archive size={10} className="mr-0.5" /> Archivado
                                </Badge>
                              )}
                              {statusInfo.isProrrogado && !c.archivado && (
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 italic">LAU</span>
                              )}
                              {statusInfo.daysUntilEnd !== null && statusInfo.daysUntilEnd > 0 && statusInfo.daysUntilEnd <= 90 && statusInfo.status !== "preaviso_activo" && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                                  {statusInfo.daysUntilEnd}d
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Chat IA" onClick={() => setChatContrato(c)}>
                            <MessageSquare size={14} className="text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver ficha" onClick={() => setDetailContrato(c)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver resumen contrato" onClick={() => {
                            const prop = properties.find(p => p.id === c.property_id);
                            const inq = c.inquilino_id ? inquilinos.find(i => i.id === c.inquilino_id) : null;
                            const resumenCtx = {
                              contrato: c,
                              propertyName: prop?.nombre_interno || "—",
                              propertyAddress: prop?.direccion_completa || null,
                              inquilinoName: inq ? `${inq.nombre}${inq.apellidos ? ` ${inq.apellidos}` : ""}` : null,
                              inquilinoDni: inq?.dni || null,
                              inquilinoEmail: inq?.email || null,
                              inquilinoTelefono: inq?.telefono || null,
                              aguaIncluidaComunidad: prop?.agua_incluida_comunidad || false,
                              calefaccionIncluidaComunidad: prop?.calefaccion_incluida_comunidad || false,
                            };
                            setResumenPreview(resumenCtx);
                            setPdfTitle(c.titulo);
                          }}>
                            <FileDown size={14} />
                          </Button>
                          {!c.archivo_url && (
                            <>
                              <input ref={inlineFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(c.id, f); e.target.value = ""; }}
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Subir archivo" disabled={uploadingId === c.id}
                                onClick={() => inlineFileRef.current?.click()}>
                                <Upload size={14} />
                              </Button>
                            </>
                          )}
                          {c.archivo_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Re-analizar contrato con IA" disabled={reanalyzingId === c.id} onClick={() => handleReanalyze(c)}>
                              {reanalyzingId === c.id ? <Loader2 size={14} className="animate-spin text-primary" /> : <RefreshCw size={14} className="text-primary" />}
                            </Button>
                          )}
                          {!c.archivado && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Archivar contrato" onClick={() => archiveContrato(c)}>
                              <Archive size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Info grid: Inquilino, Período+Duración, Renta+IPC, Fianza */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                        {/* Inquilino */}
                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-2">
                          <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                            <User size={14} className="text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">Inquilino</p>
                            <p className="text-xs font-medium text-foreground truncate">{inquilinoName || "Sin asignar"}</p>
                          </div>
                        </div>

                        {/* Período + Duración + Prórroga */}
                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-2">
                          <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                            <CalendarDays size={14} className="text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">Período</p>
                            <p className="text-xs font-medium text-foreground truncate">
                              {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                              {c.fecha_fin ? ` → ${new Date(c.fecha_fin).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.duracion_anos ? `${c.duracion_anos} año${c.duracion_anos > 1 ? "s" : ""} inicial` : ""}
                              {c.prorroga_anos ? ` + ${c.prorroga_anos}a prórroga` : ""}
                              {c.preaviso_meses ? ` · ${c.preaviso_meses}m preaviso` : ""}
                              {!c.duracion_anos && !c.prorroga_anos && !c.preaviso_meses ? "Sin datos de duración" : ""}
                            </p>
                          </div>
                        </div>

                        {/* Renta + IPC button */}
                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-2">
                          <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Euro size={14} className="text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground">Renta</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium text-foreground">{c.renta_mensual != null ? `${c.renta_mensual} €/mes` : "—"}</p>
                              {c.renta_mensual != null && !c.archivado && (
                                <Popover open={ipcContratoId === c.id} onOpenChange={(open) => { setIpcContratoId(open ? c.id : null); setIpcPercent("2.3"); }}>
                                  <PopoverTrigger asChild>
                                    <button onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-emerald-700 text-[10px] font-medium" title="Actualizar renta por IPC (BOE)">
                                      <TrendingUp size={10} />
                                      IPC
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-4" align="start" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <TrendingUp size={16} className="text-emerald-600" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">Actualizar renta por IPC</p>
                                        <p className="text-[11px] text-muted-foreground">Según publicación del BOE</p>
                                      </div>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2.5 mb-3">
                                      <p className="text-[11px] text-muted-foreground">
                                        Renta actual: <strong className="text-foreground">{c.renta_mensual} €/mes</strong>
                                      </p>
                                    </div>
                                    <Label className="text-xs mb-1.5 block">Porcentaje IPC (%)</Label>
                                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-2">
                                      <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                        📋 <strong>Referencia BOE:</strong> 2,3% (último dato publicado). Puede modificar este valor según la cláusula de su contrato.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="relative flex-1">
                                        <Input
                                          type="number"
                                          step="0.1"
                                          value={ipcPercent}
                                          onChange={(e) => setIpcPercent(e.target.value)}
                                          className="h-9 text-sm pr-7"
                                          placeholder="2.3"
                                        />
                                        <Percent size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mb-3">
                                      Consulta el IPC vigente en el <a href="https://www.ine.es/varipc/" target="_blank" rel="noopener noreferrer" className="text-primary underline">INE</a>
                                    </p>
                                    {ipcPercent && !isNaN(parseFloat(ipcPercent)) && (
                                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 mb-3">
                                        <p className="text-xs text-foreground">
                                          Nueva renta: <strong>
                                            {Math.round((c.renta_mensual! * (1 + parseFloat(ipcPercent) / 100)) * 100) / 100} €/mes
                                          </strong>
                                          <span className="ml-1.5 text-emerald-600 font-medium">({parseFloat(ipcPercent) > 0 ? "+" : ""}{parseFloat(ipcPercent)}%)</span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          Diferencia: {parseFloat(ipcPercent) > 0 ? "+" : ""}{Math.round((c.renta_mensual! * parseFloat(ipcPercent) / 100) * 100) / 100} €/mes
                                        </p>
                                      </div>
                                    )}
                                    <Button size="sm" className="w-full" disabled={ipcApplying || !ipcPercent} onClick={() => handleIpcApply(c)}>
                                      {ipcApplying ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <TrendingUp size={14} className="mr-1.5" />}
                                      Aplicar actualización
                                    </Button>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Fianza */}
                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-2">
                          <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Shield size={14} className="text-violet-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">Fianza</p>
                            <p className="text-xs font-medium text-foreground">
                              {c.fianza_importe != null ? `${c.fianza_importe} €` : "—"}
                              {c.deposito_garantia != null && c.deposito_garantia > 0 && (
                                <span className="text-muted-foreground ml-1">(+{c.deposito_garantia} € dep.)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {c.notas && (
                        <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 pl-1">{c.notas}</p>
                      )}

                      {/* Document link - clickable to open */}
                       {c.archivo_nombre && (
                         (c.archivo_url || c.storage_path) ? (
                           <SecureFileLink
                             bucket="contratos"
                             path={c.storage_path}
                             fallbackUrl={c.archivo_url}
                             className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group w-full text-left"
                           >
                            <div className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
                              <FileText size={14} className="text-red-600" />
                            </div>
                            <span className="text-xs font-medium text-primary group-hover:underline truncate">{c.archivo_nombre}</span>
                            <ExternalLink size={12} className="text-primary/50 shrink-0 ml-auto" />
                          </SecureFileLink>
                        ) : (
                          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-muted/30">
                            <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <FileText size={14} className="text-muted-foreground" />
                            </div>
                            <span className="text-xs text-muted-foreground truncate">{c.archivo_nombre}</span>
                          </div>
                        )
                      )}

                      {/* History toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleHistorial(c.id); }}
                        className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <History size={12} />
                        <span>Historial de cambios</span>
                        {expandedHistorial === c.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {expandedHistorial === c.id && (
                        <div className="mt-2 border-t border-border pt-2">
                          {!historialMap[c.id] ? (
                            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                              <Loader2 size={12} className="animate-spin" /> Cargando historial…
                            </div>
                          ) : historialMap[c.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Sin cambios registrados.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {historialMap[c.id].map((h) => (
                                <div key={h.id} className="flex items-start gap-2 py-1">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                    h.tipo === "creacion" ? "bg-primary/10" :
                                    h.tipo === "archivo" ? "bg-muted" :
                                    "bg-amber-500/10"
                                  }`}>
                                    {h.tipo === "creacion" ? <Plus size={10} className="text-primary" /> :
                                     h.tipo === "archivo" ? <Archive size={10} className="text-muted-foreground" /> :
                                     <TrendingUp size={10} className="text-amber-600" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-foreground">{h.titulo}</p>
                                    {h.detalle && <p className="text-[11px] text-muted-foreground">{h.detalle}</p>}
                                    {h.valor_anterior && h.valor_nuevo && (
                                      <p className="text-[10px] text-muted-foreground">
                                        <span className="line-through">{h.valor_anterior}</span> → <span className="font-medium text-foreground">{h.valor_nuevo}</span>
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {new Date(h.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* New contract wizard dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (!open) resetWizard(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {renderWizardContent()}
        </DialogContent>
      </Dialog>

      {/* Contract generator */}
      <GeneradorContrato open={showGenerator} onOpenChange={setShowGenerator} properties={properties} inquilinos={inquilinos} profile={profile} onContractSaved={() => { refetchContratos(); onInquilinoCreated?.(); }} onInquilinoCreated={onInquilinoCreated} />

      {/* Contract detail sheet */}
      <ContratoDetailSheet
        contrato={detailContrato}
        open={!!detailContrato}
        onClose={() => { setDetailContrato(null); setDetailIpcInfo(null); refetchContratos(); }}
        properties={properties}
        inquilinos={inquilinos}
        onSave={async (id, data) => { await updateContrato(id, data as any); }}
        onUploadArchivo={uploadArchivo}
        onUploadDocumentoOriginal={uploadDocumentoOriginal}
        onCreateCalendarEvents={createCalendarEvents}
        onUpdateContratoWithHistory={updateContratoWithHistory}
        initialIpcInfo={detailIpcInfo}
      />


      {/* Resumen contrato dialog (in-app, no popups) */}
      <Dialog open={!!resumenPreview} onOpenChange={(open) => { if (!open) setResumenPreview(null); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg">Resumen: {pdfTitle}</DialogTitle>
            <DialogDescription>Vista clara para revisar, copiar y exportar</DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-6 pb-2 overflow-auto">
            {resumenPreview && (
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border p-4">
                  <p><strong>Vivienda:</strong> {resumenPreview.propertyName}</p>
                  {resumenPreview.propertyAddress && <p><strong>Dirección:</strong> {resumenPreview.propertyAddress}</p>}
                </div>
                <div className="rounded-lg border p-4">
                  <p><strong>Inquilino:</strong> {resumenPreview.inquilinoName || "—"}</p>
                  {resumenPreview.inquilinoDni && <p><strong>DNI:</strong> {resumenPreview.inquilinoDni}</p>}
                  {resumenPreview.inquilinoEmail && <p><strong>Email:</strong> {resumenPreview.inquilinoEmail}</p>}
                  {resumenPreview.inquilinoTelefono && <p><strong>Teléfono:</strong> {resumenPreview.inquilinoTelefono}</p>}
                </div>
                <div className="rounded-lg border p-4">
                  <p><strong>Inicio:</strong> {resumenPreview.contrato.fecha_inicio || "—"}</p>
                  <p><strong>Fin:</strong> {resumenPreview.contrato.fecha_fin || "—"}</p>
                  <p><strong>Renta mensual:</strong> {resumenPreview.contrato.renta_mensual != null ? `${resumenPreview.contrato.renta_mensual} €` : "—"}</p>
                  <p><strong>Estado:</strong> {resumenPreview.contrato.estado}</p>
                  {resumenPreview.contrato.fianza_importe && <p><strong>Fianza:</strong> {resumenPreview.contrato.fianza_importe} €</p>}
                  {resumenPreview.contrato.deposito_garantia && <p><strong>Depósito garantía:</strong> {resumenPreview.contrato.deposito_garantia} €</p>}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-semibold mb-2">Suministros — ¿Quién paga?</p>
                  {(() => {
                    const cc = resumenPreview.contrato;
                    const lbl = (pagaInq: boolean, inclCom?: boolean) => inclCom ? "Comunidad" : pagaInq ? "Inquilino" : "Propietario";
                    const items = [
                      ["Agua", lbl(cc.agua_paga_inquilino, resumenPreview.aguaIncluidaComunidad)],
                      ["Luz", lbl(cc.luz_paga_inquilino)],
                      ["Gas", lbl(cc.gas_paga_inquilino)],
                      ["Calefacción", lbl(false, resumenPreview.calefaccionIncluidaComunidad)],
                      ["Internet", lbl(cc.internet_paga_inquilino)],
                      ["IBI", lbl(cc.ibi_paga_inquilino)],
                      ["Basuras", lbl(cc.basuras_paga_inquilino)],
                      ["Comunidad", lbl(cc.comunidad_paga_inquilino)],
                    ];
                    return <div className="grid grid-cols-2 gap-x-6 gap-y-1">{items.map(([k, v]) => <p key={k}><strong>{k}:</strong> {v}</p>)}</div>;
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="outline" size="sm" onClick={async () => {
              if (!resumenPreview) return;
              const c = resumenPreview.contrato;
              const text = [
                `Resumen contrato: ${c.titulo}`,
                `Vivienda: ${resumenPreview.propertyName}`,
                resumenPreview.propertyAddress ? `Dirección: ${resumenPreview.propertyAddress}` : null,
                `Inquilino: ${resumenPreview.inquilinoName || "—"}`,
                `Inicio: ${c.fecha_inicio || "—"}`,
                `Fin: ${c.fecha_fin || "—"}`,
                `Renta mensual: ${c.renta_mensual != null ? `${c.renta_mensual} €` : "—"}`,
                `Estado: ${c.estado}`,
              ].filter(Boolean).join("\n");
              await navigator.clipboard.writeText(text);
              toast({ title: "Copiado", description: "Resumen copiado al portapapeles." });
            }}>
              <Copy size={14} className="mr-2" /> Copiar
            </Button>

            <Button variant="outline" size="sm" onClick={() => {
              if (!resumenPreview) return;
              const blob = generateContratoResumenPdf(resumenPreview);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `Resumen_${pdfTitle.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "_")}.pdf`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>
              <Download size={14} className="mr-2" /> Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Historical rent import wizard */}
      {historicalWizardData && (
        <HistoricalRentWizard
          open={!!historicalWizardData}
          onOpenChange={(open) => { if (!open) setHistoricalWizardData(null); }}
          propertyName={historicalWizardData.propertyName}
          propertyId={historicalWizardData.propertyId}
          inquilinoId={historicalWizardData.inquilinoId}
          rentaMensual={historicalWizardData.rentaMensual}
          fechaInicio={historicalWizardData.fechaInicio}
          userId={user?.id || ""}
          onComplete={async ({ allPaid, rentUpdates, unpaidMonths, afectaFiscalidad, estrategia }) => {
            const ownerId = user?.id || "";
            for (const update of rentUpdates) {
              await addActualizacion({
                property_id: historicalWizardData.propertyId,
                fecha_efectiva: update.fecha,
                importe_anterior: update.importe_anterior,
                importe_nuevo: update.importe_nuevo,
                motivo: update.motivo,
              });
            }
            const startDate = new Date(historicalWizardData.fechaInicio);
            const now = new Date();
            let y = startDate.getFullYear();
            let m = startDate.getMonth() + 1;
            const unpaidSet = new Set(unpaidMonths.map(u => `${u.mes}-${u.anio}`));
            const mesesReconstruidos: Array<{ mes: number; anio: number; importe: number }> = [];
            const mesesPendientes: Array<{ mes: number; anio: number; importe: number }> = [];
            let importeTotalReconstruido = 0;
            const planeados: Array<{
              mes: number; anio: number; importe_pagado: number;
              tipo_registro: "historico_reconstruido" | "pendiente";
              afecta_fiscalidad: boolean; notas_acuerdo: string;
            }> = [];
            while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
              const key = `${m}-${y}`;
              let rent = historicalWizardData.rentaMensual;
              for (const update of rentUpdates) {
                const ud = new Date(update.fecha);
                if (ud.getFullYear() * 12 + ud.getMonth() <= y * 12 + (m - 1)) rent = update.importe_nuevo;
              }
              const isPendiente = !allPaid && unpaidSet.has(key);
              planeados.push({
                mes: m, anio: y,
                importe_pagado: rent,
                tipo_registro: isPendiente ? "pendiente" : "historico_reconstruido",
                afecta_fiscalidad: !isPendiente && !!afectaFiscalidad,
                notas_acuerdo: isPendiente
                  ? "Pendiente histórico (anterior al alta en CapitalRent)"
                  : "Histórico reconstruido (anterior al alta en CapitalRent)",
              });
              if (isPendiente) {
                mesesPendientes.push({ mes: m, anio: y, importe: rent });
              } else {
                mesesReconstruidos.push({ mes: m, anio: y, importe: rent });
                importeTotalReconstruido += Number(rent) || 0;
              }
              m++;
              if (m > 12) { m = 1; y++; }
            }
            // Ejecutamos en batch protegiendo pago_real existentes.
            const summary = await registrarHistoricoBatch(
              historicalWizardData.propertyId, historicalWizardData.inquilinoId, ownerId,
              planeados.map(p => ({ ...p, origen: "reconstruccion_historica" })),
              estrategia,
            );
            const omitidosKeys = new Set([
              ...summary.omitidos.map(o => `${o.mes}-${o.anio}`),
              ...summary.omitidos_por_decision.map(o => `${o.mes}-${o.anio}`),
            ]);
            const mesesReconstruidosAplicados = mesesReconstruidos.filter(x => !omitidosKeys.has(`${x.mes}-${x.anio}`));
            const mesesPendientesAplicados = mesesPendientes.filter(x => !omitidosKeys.has(`${x.mes}-${x.anio}`));
            const importeTotalReconstruidoAplicado = mesesReconstruidosAplicados.reduce((s, x) => s + (Number(x.importe) || 0), 0);
            if (summary.omitidos.length > 0) {
              toast({
                title: `${summary.omitidos.length} mes(es) protegidos`,
                description: "Se han omitido meses con un cobro real ya registrado para no sobrescribirlos.",
              });
            }
            if (summary.omitidos_por_decision.length > 0) {
              toast({
                title: `${summary.omitidos_por_decision.length} mes(es) omitidos`,
                description: "Saltados por la estrategia anti-duplicidad elegida.",
              });
            }
            // Trazabilidad documental en contrato_historial
            if (mesesReconstruidosAplicados.length > 0) {
              await logContratoEvento({
                contratoId: historicalWizardData.contratoId,
                propertyId: historicalWizardData.propertyId,
                userId: ownerId,
                tipo: allPaid ? "renta_historica_regularizada" : "historico_economico_reconstruido",
                titulo: allPaid
                  ? "Histórico regularizado (al día)"
                  : "Histórico económico reconstruido",
                importeTotal: importeTotalReconstruidoAplicado,
                metadata: {
                  origen: "reconstruccion_historica",
                  meses_afectados: mesesReconstruidosAplicados,
                  afecta_finanzas_actuales: false,
                  afecta_fiscalidad: !!afectaFiscalidad,
                  actor_id: ownerId,
                  estrategia_elegida: estrategia,
                  meses_creados: summary.creados.map(o => ({ mes: o.mes, anio: o.anio })),
                  meses_actualizados: summary.actualizados.map(o => ({ mes: o.mes, anio: o.anio })),
                  meses_omitidos_pago_real: summary.omitidos.map(o => ({ mes: o.mes, anio: o.anio })),
                  meses_omitidos_por_decision_usuario: summary.omitidos_por_decision.map(o => ({ mes: o.mes, anio: o.anio })),
                  omitidos_pago_real: summary.omitidos.map(o => ({ mes: o.mes, anio: o.anio })),
                },
              });
            }
            if (mesesPendientesAplicados.length > 0) {
              await logContratoEvento({
                contratoId: historicalWizardData.contratoId,
                propertyId: historicalWizardData.propertyId,
                userId: ownerId,
                tipo: "pago_pendiente_historico",
                titulo: "Pagos pendientes históricos",
                importeTotal: mesesPendientesAplicados.reduce((s, x) => s + (Number(x.importe) || 0), 0),
                metadata: {
                  origen: "reconstruccion_historica",
                  meses_afectados: mesesPendientesAplicados,
                  afecta_finanzas_actuales: false,
                  afecta_fiscalidad: false,
                  actor_id: ownerId,
                },
              });
            }
            toast({ title: "Historial generado", description: "Se han importado los registros de renta correctamente." });
            setHistoricalWizardData(null);
          }}
        />
      )}

    </div>
  );
};

export default ContratosSection;
