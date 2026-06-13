import { useState, useRef, useEffect, useCallback } from "react";
import { stripHonorifics } from "@/lib/nameUtils";
import { FileText, Sparkles, Loader2, Download, Copy, Check, UserPlus, Upload, Camera, ScanLine, AlertCircle, CheckCircle2, ClipboardCheck, Plus, Trash2, Package, Users, FileUp, FolderOpen, Save } from "lucide-react";
import InventarioEditor, { type InventarioItem } from "./InventarioEditor";
import { generateInventarioPdf, uploadInventarioPdf } from "@/lib/inventarioUtils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { insertInquilinoRow, insertContratoRow } from "@/lib/altas/raw";
import ReactMarkdown from "react-markdown";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";

export interface GeneradorContratoInitialData {
  propertyId?: string;
  inquilinoId?: string;
  renta?: string;
  fianza?: string;
  fechaInicio?: string;
  duracion?: string;
}

interface GeneradorContratoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  inquilinos: Inquilino[];
  profile: { nombre?: string | null; apellidos?: string | null; nif?: string | null; email?: string | null; telefono?: string | null } | null;
  onInquilinoCreated?: () => void;
  onContractSaved?: () => void;
  initialData?: GeneradorContratoInitialData | null;
}

const TIPOS = [
  { value: "larga_duracion", label: "Vivienda habitual (larga duración)" },
  { value: "vacacional", label: "Uso turístico / Vacacional" },
  { value: "habitacion", label: "Alquiler de habitación" },
  { value: "explotacion", label: "Explotación / Uso distinto" },
];

interface TenantEntry {
  id: string; // local unique key
  mode: "existing" | "new";
  existingId: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
}

const createEmptyTenant = (): TenantEntry => ({
  id: crypto.randomUUID(),
  mode: "new",
  existingId: "",
  nombre: "",
  apellidos: "",
  dni: "",
  email: "",
  telefono: "",
});

// InventarioItem is now imported from InventarioEditor

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-contrato`;

const GeneradorContrato = ({ open, onOpenChange, properties, inquilinos, profile, onInquilinoCreated, onContractSaved, initialData }: GeneradorContratoProps) => {
  const { toast } = useToast();
  const [tipo, setTipo] = useState("larga_duracion");
  const [propertyId, setPropertyId] = useState("");
  const [renta, setRenta] = useState("");
  const [fianza, setFianza] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [duracion, setDuracion] = useState("3 años");
  const [generatedText, setGeneratedText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"form" | "review" | "template" | "result">("form");
  const [tenantSearches, setTenantSearches] = useState<Record<number, string>>({});

  // Multi-tenant list
  const [tenants, setTenants] = useState<TenantEntry[]>([createEmptyTenant()]);

  // Review overrides for propietario and inmueble
  const [reviewPropietarioNombre, setReviewPropietarioNombre] = useState("");
  const [reviewPropietarioNif, setReviewPropietarioNif] = useState("");
  const [reviewPropietarioEmail, setReviewPropietarioEmail] = useState("");
  const [reviewPropietarioTelefono, setReviewPropietarioTelefono] = useState("");
  const [reviewPropietarioDomicilio, setReviewPropietarioDomicilio] = useState("");
  const [reviewPropietarioIban, setReviewPropietarioIban] = useState("");
  const [reviewDireccion, setReviewDireccion] = useState("");
  const [reviewRefCatastral, setReviewRefCatastral] = useState("");
  const [reviewSuperficie, setReviewSuperficie] = useState("");

  // Review overrides for tenants (array matching tenants)
  const [reviewTenants, setReviewTenants] = useState<{ tratamiento: string; nombre: string; dni: string; email: string; telefono: string; rol: string }[]>([]);

  // Inventory
  const [incluirInventario, setIncluirInventario] = useState(false);
  const [inventarioItems, setInventarioItems] = useState<InventarioItem[]>([]);
  const [savingInventario, setSavingInventario] = useState(false);

  // Template state
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [savedPlantillas, setSavedPlantillas] = useState<{ id: string; nombre: string; storage_path: string; archivo_nombre: string }[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [loadingTemplateContent, setLoadingTemplateContent] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dniInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);
  const [analyzeTargetTenantIdx, setAnalyzeTargetTenantIdx] = useState<number>(0);

  // Load saved templates
  const loadPlantillas = useCallback(async () => {
    setLoadingPlantillas(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("contrato_plantillas")
        .select("id, nombre, storage_path, archivo_nombre")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) setSavedPlantillas(data as any);
    } catch { /* ignore */ }
    setLoadingPlantillas(false);
  }, []);

  const handleTemplateUpload = async (file: File, saveForFuture: boolean) => {
    // Validate file format
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, "template", toast)) return;

    setLoadingTemplateContent(true);
    try {
      const textFormats = ["text/plain", "text/markdown", "text/md"];
      const textExtensions = [".txt", ".md", ".text"];
      const isTextFile = textFormats.includes(file.type) || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      let text: string;

      if (isTextFile) {
        text = await file.text();
      } else {
        // Binary format (.doc, .docx, .pages, .pdf, .odt) — extract via AI
        const arrayBuf = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        const mimeType = file.type || "application/octet-stream";

        const { data: session } = await supabase.auth.getSession();
        const accessToken = session?.session?.access_token;
        if (!accessToken) {
          throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
        }
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-template-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ fileBase64: base64, mimeType, fileName: file.name }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Error al extraer texto del documento");
        }

        const result = await res.json();
        text = result.text;
        if (!text?.trim()) throw new Error("No se pudo extraer texto del documento");
      }

      setTemplateText(text);
      setUseTemplate(true);

      if (saveForFuture) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const fileName = `${Date.now()}-${file.name}`;
          const storagePath = `${user.id}/${fileName}`;
          const { error: uploadErr } = await supabase.storage.from("contrato-plantillas").upload(storagePath, file);
          if (!uploadErr) {
            await supabase.from("contrato_plantillas").insert({
              user_id: user.id,
              nombre: file.name.replace(/\.[^.]+$/, ""),
              archivo_nombre: file.name,
              storage_path: storagePath,
            } as any);
            toast({ title: "Plantilla guardada", description: `"${file.name}" disponible para futuros contratos.` });
            loadPlantillas();
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo leer la plantilla.", variant: "destructive" });
    }
    setLoadingTemplateContent(false);
  };

  const loadSavedTemplate = async (plantilla: { storage_path: string; nombre: string; archivo_nombre?: string }) => {
    setLoadingTemplateContent(true);
    try {
      const { data, error } = await supabase.storage.from("contrato-plantillas").download(plantilla.storage_path);
      if (error) throw error;

      const fileName = plantilla.archivo_nombre || plantilla.storage_path.split("/").pop() || "";
      const textExtensions = [".txt", ".md", ".text"];
      const isTextFile = textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

      let text: string;
      if (isTextFile) {
        text = await data.text();
      } else {
        // Binary — extract via AI
        const arrayBuf = await data.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuf).reduce((d, byte) => d + String.fromCharCode(byte), "")
        );
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session?.session?.access_token;
        if (!accessToken) {
          throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
        }
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-template-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ fileBase64: base64, mimeType: data.type || "application/octet-stream", fileName }),
        });
        if (!res.ok) throw new Error("Error al extraer texto");
        const result = await res.json();
        text = result.text;
      }

      setTemplateText(text);
      setUseTemplate(true);
      toast({ title: "Plantilla cargada", description: `"${plantilla.nombre}" lista para usar.` });
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la plantilla.", variant: "destructive" });
    }
    setLoadingTemplateContent(false);
  };

  // Prefill from initialData when dialog opens
  useEffect(() => {
    if (open) {
      loadPlantillas();
      if (initialData) {
        if (initialData.propertyId) setPropertyId(initialData.propertyId);
        if (initialData.inquilinoId) {
          setTenants([{ ...createEmptyTenant(), mode: "existing", existingId: initialData.inquilinoId }]);
        }
        if (initialData.renta) setRenta(initialData.renta);
        if (initialData.fianza) setFianza(initialData.fianza);
        if (initialData.fechaInicio) setFechaInicio(initialData.fechaInicio);
        if (initialData.duracion) setDuracion(initialData.duracion);
      }
    }
    if (!open) {
      setPropertyId("");
      setTenants([createEmptyTenant()]);
      setRenta("");
      setFianza("");
      setFechaInicio("");
      setDuracion("5 años");
      setGeneratedText("");
      setGenerating(false);
      setCopied(false);
      setStep("form");
      setIncluirInventario(false);
      setInventarioItems([]);
      setReviewTenants([]);
      setUseTemplate(false);
      setTemplateText("");
    }
  }, [open, initialData, loadPlantillas]);

  const property = properties.find((p) => p.id === propertyId);

  const updateTenant = (idx: number, updates: Partial<TenantEntry>) => {
    setTenants(prev => prev.map((t, i) => i === idx ? { ...t, ...updates } : t));
  };

  const addTenant = () => setTenants(prev => [...prev, createEmptyTenant()]);

  const removeTenant = (idx: number) => {
    if (tenants.length <= 1) return;
    setTenants(prev => prev.filter((_, i) => i !== idx));
  };

  const resolveTenantData = (t: TenantEntry) => {
    if (t.mode === "existing") {
      const inq = inquilinos.find(i => i.id === t.existingId);
      if (!inq) return { nombre: "", dni: "", email: "", telefono: "" };
      const fullName = stripHonorifics(`${inq.nombre}${inq.apellidos ? " " + inq.apellidos : ""}`.trim());
      return {
        nombre: fullName,
        dni: inq.dni || "",
        email: inq.email || "",
        telefono: inq.telefono || "",
      };
    }
    return {
      nombre: stripHonorifics(`${t.nombre} ${t.apellidos}`.trim()),
      dni: t.dni,
      email: t.email,
      telefono: t.telefono,
    };
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [generatedText]);

  const handleFileAnalysis = async (file: File, mode: "dni" | "contract", tenantIdx: number) => {
    const { validateFileWithToast } = await import("@/lib/fileValidation");
    if (!validateFileWithToast(file, mode === "dni" ? "dni" : "contract", toast)) return;
    setAnalyzing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const functionName = mode === "dni" ? "analyze-dni" : "analyze-contrato";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { imageBase64: base64, mimeType: file.type || "image/jpeg" },
      });

      if (error) throw error;

      if (mode === "dni") {
        updateTenant(tenantIdx, {
          nombre: stripHonorifics(data.nombre),
          apellidos: stripHonorifics(data.apellidos),
          dni: data.dni || "",
        });
        toast({ title: "DNI analizado", description: `Datos extraídos: ${stripHonorifics(data.nombre)} ${stripHonorifics(data.apellidos)}` });
      } else {
        const cleanName = stripHonorifics(data.arrendatario_nombre);
        updateTenant(tenantIdx, {
          nombre: cleanName?.split(" ")[0] || "",
          apellidos: cleanName?.split(" ").slice(1).join(" ") || "",
          dni: data.arrendatario_nif || "",
        });
        if (data.renta_mensual && !renta) setRenta(String(data.renta_mensual));
        if (data.fianza_importe && !fianza) setFianza(String(data.fianza_importe) + " €");
        if (data.fecha_inicio && !fechaInicio) setFechaInicio(data.fecha_inicio);
        if (data.duracion_anos) setDuracion(`${data.duracion_anos} años`);
        toast({ title: "Contrato analizado", description: "Datos del inquilino y condiciones extraídos." });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo analizar el documento.", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const populateReview = () => {
    const propNombre = profile ? `${profile.nombre || ""} ${profile.apellidos || ""}`.trim() : "";
    setReviewPropietarioNombre(propNombre);
    setReviewPropietarioNif(profile?.nif || "");
    setReviewPropietarioEmail(profile?.email || "");
    setReviewPropietarioTelefono(profile?.telefono || "");
    setReviewPropietarioDomicilio((profile as any)?.direccion || "");
    setReviewPropietarioIban((profile as any)?.iban || "");
    // Build full address from all available property parts
    let fullAddress = "";
    if (property) {
      const parts: string[] = [];
      // Street / base address — try direccion_completa first, then nombre_interno, then urbanizacion
      const baseAddress = property.direccion_completa || property.nombre_interno || property.urbanizacion || "";
      if (baseAddress) parts.push(baseAddress);
      // Add portal/floor/door details (only if not already in base address)
      const dirLower = baseAddress.toLowerCase();
      if (property.numero_portal && !dirLower.includes(property.numero_portal.toLowerCase())) parts.push(`nº ${property.numero_portal}`);
      if (property.planta && !dirLower.includes("planta")) parts.push(`planta ${property.planta}`);
      if (property.puerta && !dirLower.includes("puerta")) parts.push(`puerta ${property.puerta}`);
      if (property.codigo_postal) parts.push(property.codigo_postal);
      if (property.ciudad) parts.push(property.ciudad);
      if (property.provincia && property.provincia !== property.ciudad) parts.push(`(${property.provincia})`);
      fullAddress = parts.filter(Boolean).join(", ");
    }
    setReviewDireccion(fullAddress);
    setReviewRefCatastral(property?.referencia_catastral || "");
    setReviewSuperficie(property?.superficie_m2 ? String(property.superficie_m2) : "");

    // Auto-lookup catastro if ref or superficie missing
    if (property && (!property.referencia_catastral || !property.superficie_m2)) {
      const addressForGeo = fullAddress || property.direccion_completa || property.nombre_interno || "";
      const ciudadForGeo = property.ciudad || "";
      if (addressForGeo && ciudadForGeo) {
        (async () => {
          try {
            const query = encodeURIComponent(`${addressForGeo.trim()}, ${ciudadForGeo.trim()}, España`);
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1&countrycodes=es`,
              { headers: { "User-Agent": "CapitalRent/1.0" } }
            );
            const geoData = await geoRes.json();
            if (geoData?.[0]?.lat && geoData?.[0]?.lon) {
              const { data: catastroData } = await supabase.functions.invoke("catastro-lookup", {
                body: {
                  lat: parseFloat(geoData[0].lat),
                  lon: parseFloat(geoData[0].lon),
                  planta: property.planta || "",
                  puerta: property.puerta || "",
                  provincia: property.provincia || "",
                  ciudad: ciudadForGeo,
                },
              });
              if (catastroData?.success) {
                if (catastroData.rc && !property.referencia_catastral) {
                  setReviewRefCatastral(catastroData.rc);
                }
                if (catastroData.superficie && !property.superficie_m2) {
                  setReviewSuperficie(String(catastroData.superficie));
                }
              }
            }
          } catch (e) {
            console.error("Auto catastro lookup failed:", e);
          }
        })();
      }
    }

    // Populate review tenants
    setReviewTenants(tenants.map(t => {
      const d = resolveTenantData(t);
      return { tratamiento: "", nombre: d.nombre, dni: d.dni, email: d.email, telefono: d.telefono, rol: "inquilino" };
    }));

    setStep("review");
  };

  const updateReviewTenant = (idx: number, field: string, value: string) => {
    setReviewTenants(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const addReviewTenant = () => {
    setReviewTenants(prev => [...prev, { tratamiento: "", nombre: "", dni: "", email: "", telefono: "", rol: "inquilino" }]);
  };

  const removeReviewTenant = (idx: number) => {
    if (reviewTenants.length <= 1) return;
    setReviewTenants(prev => prev.filter((_, i) => i !== idx));
  };

  const getMissingFields = () => {
    const missing: { section: string; field: string }[] = [];
    if (!reviewPropietarioNombre.trim()) missing.push({ section: "Propietario", field: "Nombre completo" });
    if (!reviewPropietarioNif.trim()) missing.push({ section: "Propietario", field: "NIF/DNI" });
    if (!reviewPropietarioDomicilio.trim()) missing.push({ section: "Propietario", field: "Domicilio" });
    if (!reviewPropietarioIban.trim()) missing.push({ section: "Propietario", field: "IBAN / Cuenta bancaria" });
    if (!reviewDireccion.trim()) missing.push({ section: "Inmueble", field: "Dirección completa" });
    if (!renta.trim()) missing.push({ section: "Condiciones", field: "Renta mensual" });
    if (!fechaInicio.trim()) missing.push({ section: "Condiciones", field: "Fecha de inicio" });
    const hasValidTenant = reviewTenants.some(t => t.nombre.trim());
    if (!hasValidTenant) missing.push({ section: "Participantes", field: "Al menos un inquilino con nombre" });
    reviewTenants.forEach((t, idx) => {
      if (t.nombre.trim() && !t.dni.trim()) missing.push({ section: `${t.rol === "avalista" ? "Avalista" : "Inquilino"} #${idx + 1}`, field: "DNI/NIE" });
      if (t.nombre.trim() && !t.email.trim()) missing.push({ section: `${t.rol === "avalista" ? "Avalista" : "Inquilino"} #${idx + 1}`, field: "Email" });
    });
    if (!reviewRefCatastral.trim()) missing.push({ section: "Inmueble", field: "Referencia catastral" });
    if (!reviewSuperficie.trim()) missing.push({ section: "Inmueble", field: "Superficie (m²)" });
    if (!reviewPropietarioEmail.trim()) missing.push({ section: "Propietario", field: "Email" });
    if (!reviewPropietarioTelefono.trim()) missing.push({ section: "Propietario", field: "Teléfono" });
    return missing;
  };

  const missingRecommendedCount = () => {
    return getMissingFields().length;
  };

  const handleGenerate = async (fromTemplate = false) => {
    setGenerating(true);
    setGeneratedText("");
    setStep("result");

    const allParticipants = reviewTenants.filter(t => t.nombre.trim()).map(t => ({
      nombre: t.tratamiento ? `${t.tratamiento} ${t.nombre}` : t.nombre,
      dni: t.dni,
      email: t.email,
      telefono: t.telefono,
      rol: t.rol,
    }));
    const tenantsPayload = allParticipants.filter(t => t.rol === "inquilino");
    const avalistasPayload = allParticipants.filter(t => t.rol === "avalista");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      if (!accessToken) {
        throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
      }
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tipoContrato: tipo,
          propietario: {
            nombre: reviewPropietarioNombre,
            nif: reviewPropietarioNif,
            email: reviewPropietarioEmail,
            telefono: reviewPropietarioTelefono,
            domicilio: reviewPropietarioDomicilio,
            iban: reviewPropietarioIban,
          },
          inquilino: tenantsPayload.length === 1 ? tenantsPayload[0] : tenantsPayload[0],
          inquilinos: tenantsPayload.length > 1 ? tenantsPayload : undefined,
          avalistas: avalistasPayload.length > 0 ? avalistasPayload : undefined,
          propiedad: {
            direccion: reviewDireccion,
            referencia_catastral: reviewRefCatastral,
            superficie_m2: reviewSuperficie,
            tipo_vivienda: property?.tipo_vivienda || "",
            num_habitaciones: property?.num_habitaciones || "",
            num_banos: property?.num_banos || "",
          },
          condiciones: {
            renta: renta || "",
            fianza: fianza || "1 mes de renta",
            fecha_inicio: fechaInicio || "",
            duracion: duracion || "3 años",
          },
          inventario: incluirInventario && inventarioItems.filter(i => i.nombre.trim()).length > 0
            ? inventarioItems.filter(i => i.nombre.trim()).map(i => ({
                nombre: i.nombre,
                marca: i.marca || undefined,
                caracteristicas: i.caracteristicas || undefined,
              }))
            : undefined,
          plantilla: fromTemplate && useTemplate && templateText ? templateText : undefined,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Error generating");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setGeneratedText(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error(e);
      setGeneratedText("Error al generar el contrato. Inténtalo de nuevo.");
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contrato-${tipo}-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildInventarioPdfContext = (propertyName: string) => {
    const arrendadorNombre =
      reviewPropietarioNombre.trim() ||
      `${profile?.nombre || ""} ${profile?.apellidos || ""}`.trim() ||
      "Arrendador/a";

    const arrendatariosNombres = reviewTenants
      .filter((t) => t.rol !== "avalista" && t.nombre.trim())
      .map((t) => (t.tratamiento ? `${t.tratamiento} ${t.nombre}` : t.nombre).trim());

    const fechaContrato = fechaInicio
      ? new Date(`${fechaInicio}T00:00:00`).toLocaleDateString("es-ES")
      : new Date().toLocaleDateString("es-ES");

    return {
      propertyAddress: reviewDireccion || propertyName,
      fechaContrato,
      arrendador: arrendadorNombre,
      arrendatarios: arrendatariosNombres,
    };
  };

  const handleSaveInventarioPdf = async () => {
    if (!incluirInventario || inventarioItems.filter(i => i.nombre.trim()).length === 0) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setSavingInventario(true);
    try {
      const property = properties.find((p) => p.id === propertyId);
      const propertyName = property?.nombre_interno || "vivienda";
      // Find first tenant's inquilino_id
      const firstTenant = tenants.find(t => t.mode === "existing" && t.existingId);
      const inquilinoId = firstTenant?.existingId || null;

      const pdfBlob = await generateInventarioPdf(
        inventarioItems,
        buildInventarioPdfContext(propertyName)
      );
      const result = await uploadInventarioPdf(
        pdfBlob,
        user.id,
        propertyId,
        inquilinoId,
        propertyName
      );
      if (result) {
        toast({ title: "Inventario guardado", description: "PDF generado y guardado en Documentos > Inventario." });
      } else {
        toast({ title: "Error", description: "No se pudo guardar el inventario.", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Error al generar el PDF del inventario.", variant: "destructive" });
    }
    setSavingInventario(false);
  };

  const handleSaveContract = async () => {
    if (!generatedText || !propertyId) {
      toast({ title: "Error", description: propertyId ? "No hay contrato generado." : "Selecciona un activo antes de guardar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // 1. Create new inquilinos if needed and collect IDs
      const createdInquilinoIds: string[] = [];
      for (const tenant of tenants) {
        if (tenant.mode === "existing" && tenant.existingId) {
          createdInquilinoIds.push(tenant.existingId);
          // Update existing inquilino with any review data
          const rt = reviewTenants.find(r => {
            const resolved = resolveTenantData(tenant);
            return r.nombre === resolved.nombre || r.dni === resolved.dni;
          });
          if (rt) {
            const nameParts = rt.nombre.trim().split(" ");
            const updateData: any = {};
            if (rt.email) updateData.email = rt.email;
            if (rt.telefono) updateData.telefono = rt.telefono;
            if (rt.dni) updateData.dni = rt.dni;
            if (!tenant.existingId) continue;
            const inq = inquilinos.find(i => i.id === tenant.existingId);
            if (inq && (!inq.renta_mensual || inq.renta_mensual === 0) && renta) {
              updateData.renta_mensual = parseFloat(renta);
            }
            if (inq && !inq.fecha_entrada && fechaInicio) {
              updateData.fecha_entrada = fechaInicio;
            }
            if (inq && !inq.property_id && propertyId) {
              updateData.property_id = propertyId;
            }
            if (Object.keys(updateData).length > 0) {
              await supabase.from("inquilinos").update(updateData).eq("id", tenant.existingId).eq("user_id", user.id);
            }
          }
        } else if (tenant.mode === "new") {
          const rt = reviewTenants.find(r => {
            const resolved = resolveTenantData(tenant);
            return r.nombre === resolved.nombre;
          });
          const nombre = rt?.nombre || `${tenant.nombre} ${tenant.apellidos}`.trim() || "Sin nombre";
          const nameParts = nombre.split(" ");
          try {
            const newInq = await insertInquilinoRow({
              nombre: nameParts[0] || nombre,
              apellidos: nameParts.slice(1).join(" ") || null,
              dni: rt?.dni || tenant.dni || null,
              email: rt?.email || tenant.email || null,
              telefono: rt?.telefono || tenant.telefono || null,
              property_id: propertyId,
              renta_mensual: renta ? parseFloat(renta) : null,
              fecha_entrada: fechaInicio || null,
              fianza: fianza ? parseFloat(fianza.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
              estado: "activo",
            });
            createdInquilinoIds.push(newInq.id);
          } catch (inqErr) {
            console.error("Error creating inquilino:", inqErr);
          }
        }
      }

      // 2. Upload contract markdown to storage
      const fileName = `contrato-${tipo}-${new Date().toISOString().split("T")[0]}-${Date.now()}.md`;
      const storagePath = `${user.id}/${propertyId}/${fileName}`;
      const blob = new Blob([generatedText], { type: "text/markdown" });
      const { error: uploadErr } = await supabase.storage.from("contratos").upload(storagePath, blob);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = await supabase.storage
        .from("contratos")
        .createSignedUrl(storagePath, 3600);

      // 3. Parse duration
      const duracionMatch = duracion.match(/(\d+)/);
      const duracionAnos = duracionMatch ? parseInt(duracionMatch[1]) : null;

      // Parse fecha_fin
      let fechaFin: string | null = null;
      if (fechaInicio && duracionAnos) {
        const start = new Date(fechaInicio);
        start.setFullYear(start.getFullYear() + duracionAnos);
        fechaFin = start.toISOString().split("T")[0];
      }

      // Parse fianza amount
      let fianzaImporte: number | null = null;
      if (fianza) {
        const parsed = parseFloat(fianza.replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(parsed)) fianzaImporte = parsed;
      }

      // Primary inquilino
      const primaryInquilinoId = createdInquilinoIds[0] || null;

      // 4. Create contratos_arrendamiento record (via altas motor único)
      await insertContratoRow({
        property_id: propertyId,
        inquilino_id: primaryInquilinoId,
        titulo: `Contrato ${TIPOS.find(t => t.value === tipo)?.label || tipo}`,
        estado: "vigente",
        renta_mensual: renta ? parseFloat(renta) : null,
        fianza_importe: fianzaImporte,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin,
        duracion_anos: duracionAnos,
        archivo_nombre: fileName,
        storage_path: storagePath,
        archivo_url: urlData?.signedUrl || null,
        tiene_inventario: incluirInventario && inventarioItems.filter(i => i.nombre.trim()).length > 0,
      }, {
        vincularInquilinos: createdInquilinoIds.filter(Boolean),
      });

      // 4b. Auto-save inventory PDF if inventory items exist
      if (incluirInventario && inventarioItems.filter(i => i.nombre.trim()).length > 0) {
        try {
          const property = properties.find((p) => p.id === propertyId);
          const propertyName = property?.nombre_interno || "vivienda";
          const pdfBlob = await generateInventarioPdf(
            inventarioItems,
            buildInventarioPdfContext(propertyName)
          );
          await uploadInventarioPdf(
            pdfBlob,
            user.id,
            propertyId,
            primaryInquilinoId,
            propertyName
          );
        } catch (invErr) {
          console.error("Error saving inventory PDF:", invErr);
        }
      }

      // 5. Update property status
      await supabase.from("properties").update({ estado: "alquilada" } as any).eq("id", propertyId).eq("user_id", user.id);

      toast({ title: "Contrato guardado", description: "Se ha creado el contrato, vinculado la vivienda y los inquilinos." });
      onInquilinoCreated?.();
      onContractSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error saving contract:", err);
      toast({ title: "Error al guardar", description: err?.message || "No se pudo guardar el contrato.", variant: "destructive" });
    }
    setSaving(false);
  };

  const allInquilinosForProperty = propertyId
    ? inquilinos.filter((i) => i.property_id === propertyId && (i.estado === "activo" || i.estado === "Activo"))
    : [];

  const allInquilinos = inquilinos.filter((i) => (i.estado === "activo" || i.estado === "Activo") && (!propertyId || i.property_id !== propertyId));
  

  // Tenants already selected (to exclude from dropdowns)
  const selectedExistingIds = tenants.filter(t => t.mode === "existing" && t.existingId).map(t => t.existingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Generador de contrato
          </DialogTitle>
          <DialogDescription>Genera un contrato según la normativa vigente con los datos de tu cuenta auto-rellenados.</DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
            <div className="grid gap-4 py-2">
              <div>
                <Label className="text-xs">Tipo de contrato *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Activo</Label>
                <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar activo" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multi-tenant section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Users size={14} className="text-primary" />
                    Inquilinos ({tenants.length})
                  </Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addTenant}>
                    <Plus size={12} /> Añadir inquilino
                  </Button>
                </div>

                {tenants.map((tenant, idx) => (
                  <div key={tenant.id} className="rounded-lg border border-border p-3 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Inquilino {idx + 1}</span>
                      {tenants.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeTenant(idx)}>
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>

                    <RadioGroup
                      value={tenant.mode}
                      onValueChange={(v) => updateTenant(idx, { mode: v as "existing" | "new", existingId: "", nombre: "", apellidos: "", dni: "", email: "", telefono: "" })}
                      className="flex gap-2"
                    >
                      <label className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 cursor-pointer text-[11px] transition-colors ${tenant.mode === "existing" ? "border-primary bg-primary/5" : "border-border"}`}>
                        <RadioGroupItem value="existing" className="h-3 w-3" />
                        Existente
                      </label>
                      <label className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 cursor-pointer text-[11px] transition-colors ${tenant.mode === "new" ? "border-primary bg-primary/5" : "border-border"}`}>
                        <RadioGroupItem value="new" className="h-3 w-3" />
                        <UserPlus size={11} /> Nuevo
                      </label>
                    </RadioGroup>

                    {tenant.mode === "existing" && (() => {
                      const propertyTenants = allInquilinosForProperty.filter(i => !selectedExistingIds.includes(i.id) || i.id === tenant.existingId);
                      const otherTenants = allInquilinos.filter(i => !selectedExistingIds.includes(i.id) || i.id === tenant.existingId);
                      const tenantSearch = tenantSearches[idx] || "";
                      const setTenantSearch = (v: string) => setTenantSearches(prev => ({ ...prev, [idx]: v }));
                      const filteredOther = tenantSearch.trim()
                        ? otherTenants.filter(i => {
                            const fullName = `${i.nombre} ${i.apellidos || ""} ${i.dni || ""} ${i.email || ""}`.toLowerCase();
                            return fullName.includes(tenantSearch.toLowerCase());
                          })
                        : otherTenants;

                      return (
                        <div className="space-y-2">
                          {propertyId && propertyTenants.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Inquilinos de esta vivienda</p>
                              <div className="space-y-1">
                                {propertyTenants.map(i => (
                                  <button
                                    key={i.id}
                                    type="button"
                                    onClick={() => updateTenant(idx, { existingId: i.id })}
                                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md border transition-colors ${tenant.existingId === i.id ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40 hover:bg-muted/50 text-foreground"}`}
                                  >
                                    {i.nombre}{i.apellidos ? ` ${i.apellidos}` : ""} {i.dni ? <span className="text-muted-foreground">({i.dni})</span> : ""}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">
                              {propertyId && propertyTenants.length > 0 ? "Otros inquilinos en tu cuenta" : "Inquilinos existentes"}
                            </p>
                            <Input
                              placeholder="Buscar por nombre, DNI o email…"
                              className="h-7 text-xs mb-1.5"
                              value={tenantSearch}
                              onChange={(e) => setTenantSearch(e.target.value)}
                            />
                            {tenantSearch.trim() ? (
                              filteredOther.length > 0 ? (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {filteredOther.map(i => (
                                    <button
                                      key={i.id}
                                      type="button"
                                      onClick={() => updateTenant(idx, { existingId: i.id })}
                                      className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md border transition-colors ${tenant.existingId === i.id ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40 hover:bg-muted/50 text-foreground"}`}
                                    >
                                      {i.nombre}{i.apellidos ? ` ${i.apellidos}` : ""} {i.dni ? <span className="text-muted-foreground">({i.dni})</span> : ""}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground px-1">Sin resultados</p>
                              )
                            ) : (
                              <p className="text-[10px] text-muted-foreground px-1">Escribe para buscar entre {otherTenants.length} inquilino{otherTenants.length !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {tenant.mode === "new" && (
                      <div className="space-y-2">
                        {/* Quick actions: DNI scan / Contract scan */}
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] flex-1"
                            onClick={() => {
                              setAnalyzeTargetTenantIdx(idx);
                              dniInputRef.current?.click();
                            }}
                            disabled={analyzing}
                          >
                            <ScanLine size={11} className="mr-1" /> Desde DNI
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] flex-1"
                            onClick={() => {
                              setAnalyzeTargetTenantIdx(idx);
                              contractInputRef.current?.click();
                            }}
                            disabled={analyzing}
                          >
                            <FileText size={11} className="mr-1" /> Desde contrato
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Nombre *</Label>
                            <Input value={tenant.nombre} onChange={(e) => updateTenant(idx, { nombre: e.target.value })} placeholder="Nombre" className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Apellidos</Label>
                            <Input value={tenant.apellidos} onChange={(e) => updateTenant(idx, { apellidos: e.target.value })} placeholder="Apellidos" className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px]">DNI/NIE</Label>
                            <Input value={tenant.dni} onChange={(e) => updateTenant(idx, { dni: e.target.value })} placeholder="12345678A" className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Email</Label>
                            <Input type="email" value={tenant.email} onChange={(e) => updateTenant(idx, { email: e.target.value })} placeholder="email@ejemplo.com" className="h-7 text-xs" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-[10px]">Teléfono</Label>
                            <Input value={tenant.telefono} onChange={(e) => updateTenant(idx, { telefono: e.target.value })} placeholder="600123456" className="h-7 text-xs" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Hidden file inputs for analysis */}
              <input
                ref={dniInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileAnalysis(f, "dni", analyzeTargetTenantIdx);
                  e.target.value = "";
                }}
              />
              <input
                ref={contractInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileAnalysis(f, "contract", analyzeTargetTenantIdx);
                  e.target.value = "";
                }}
              />

              {analyzing && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Analizando documento…
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Renta mensual (€)</Label>
                  <Input type="number" value={renta} onChange={(e) => setRenta(e.target.value)} placeholder="800" />
                </div>
                <div>
                  <Label className="text-xs">Fianza</Label>
                  <Input value={fianza} onChange={(e) => setFianza(e.target.value)} placeholder="1 mes de renta" />
                </div>
                <div>
                  <Label className="text-xs">Fecha inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Duración</Label>
                <Select value={duracion} onValueChange={setDuracion}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar duración" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 año">1 año</SelectItem>
                    <SelectItem value="2 años">2 años</SelectItem>
                    <SelectItem value="3 años">3 años (mínimo legal LAU)</SelectItem>
                    <SelectItem value="4 años">4 años</SelectItem>
                    <SelectItem value="5 años">5 años</SelectItem>
                    <SelectItem value="7 años">7 años</SelectItem>
                    <SelectItem value="10 años">10 años</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {profile?.nombre && (
                <p className="text-[11px] text-muted-foreground">
                  ✓ Datos del propietario: {profile.nombre} {profile.apellidos || ""} {profile.nif ? `(${profile.nif})` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
            <div className="space-y-4 py-2">
              {(() => {
                const missingFields = getMissingFields();
                return missingFields.length > 0 ? (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
                    <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Hay {missingFields.length} campo{missingFields.length > 1 ? "s" : ""} sin completar</p>
                        <p className="text-muted-foreground mt-0.5">Completa estos datos para evitar espacios en blanco o "[COMPLETAR]" en el contrato generado.</p>
                      </div>
                    </div>
                    <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      {missingFields.map((mf, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-muted-foreground">{mf.section}:</span>
                          <span className="font-medium">{mf.field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
                    <CheckCircle2 size={16} />
                    <p className="font-medium">Todos los datos están completos. El contrato se generará sin campos pendientes.</p>
                  </div>
                );
              })()}

              {/* Propietario */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Propietario (Arrendador)</h4>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  {[
                    { label: "Nombre completo", value: reviewPropietarioNombre, setter: setReviewPropietarioNombre, required: true },
                    { label: "NIF/DNI", value: reviewPropietarioNif, setter: setReviewPropietarioNif, required: true },
                    { label: "Domicilio", value: reviewPropietarioDomicilio, setter: setReviewPropietarioDomicilio, required: true },
                    { label: "Email", value: reviewPropietarioEmail, setter: setReviewPropietarioEmail, required: true },
                    { label: "Teléfono", value: reviewPropietarioTelefono, setter: setReviewPropietarioTelefono, required: true },
                    { label: "IBAN / Cuenta bancaria", value: reviewPropietarioIban, setter: setReviewPropietarioIban, required: true },
                  ].map(field => {
                    const isMissing = field.required && !field.value.trim();
                    return (
                      <div key={field.label}>
                        <Label className={`text-[11px] flex items-center gap-1 ${isMissing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {field.label}{field.required && <span className="text-amber-500">*</span>}
                          {!isMissing && field.value.trim() && <CheckCircle2 size={10} className="text-primary" />}
                        </Label>
                        <Input value={field.value} onChange={(e) => field.setter(e.target.value)} className={`h-8 text-xs ${isMissing ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inquilinos y Avalistas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Users size={13} /> Participantes — {reviewTenants.length}
                  </h4>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={addReviewTenant}>
                      <Plus size={10} /> Inquilino
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setReviewTenants(prev => [...prev, { tratamiento: "", nombre: "", dni: "", email: "", telefono: "", rol: "avalista" }])}>
                      <Plus size={10} /> Avalista
                    </Button>
                  </div>
                </div>

                {reviewTenants.map((rt, idx) => {
                  const nombreMissing = !rt.nombre.trim();
                  const dniMissing = rt.nombre.trim() && !rt.dni.trim();
                  return (
                    <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <select
                            value={rt.rol}
                            onChange={(e) => updateReviewTenant(idx, "rol", e.target.value)}
                            className="text-[11px] font-medium bg-transparent border border-border rounded px-1.5 py-0.5 text-foreground"
                          >
                            <option value="inquilino">Inquilino</option>
                            <option value="avalista">Avalista</option>
                          </select>
                          <span className="text-[11px] text-muted-foreground">#{idx + 1}</span>
                        </div>
                        {reviewTenants.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeReviewTenant(idx)}>
                            <Trash2 size={11} />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Tratamiento</Label>
                          <select
                            value={rt.tratamiento}
                            onChange={(e) => updateReviewTenant(idx, "tratamiento", e.target.value)}
                            className="h-8 text-xs bg-transparent border border-border rounded px-1.5 w-full text-foreground"
                          >
                            <option value="">—</option>
                            <option value="Don">Don</option>
                            <option value="Doña">Doña</option>
                          </select>
                        </div>
                        <div>
                          <Label className={`text-[11px] flex items-center gap-1 ${nombreMissing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            Nombre completo <span className="text-amber-500">*</span>
                            {!nombreMissing && <CheckCircle2 size={10} className="text-primary" />}
                          </Label>
                          <Input value={rt.nombre} onChange={(e) => updateReviewTenant(idx, "nombre", e.target.value)} className={`h-8 text-xs ${nombreMissing ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`} />
                        </div>
                        <div>
                          <Label className={`text-[11px] flex items-center gap-1 ${dniMissing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            DNI/NIE <span className="text-amber-500">*</span>
                            {!dniMissing && rt.dni.trim() && <CheckCircle2 size={10} className="text-primary" />}
                          </Label>
                          <Input value={rt.dni} onChange={(e) => updateReviewTenant(idx, "dni", e.target.value)} className={`h-8 text-xs ${dniMissing ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Email</Label>
                          <Input value={rt.email} onChange={(e) => updateReviewTenant(idx, "email", e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Teléfono</Label>
                          <Input value={rt.telefono} onChange={(e) => updateReviewTenant(idx, "telefono", e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inmueble */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Inmueble</h4>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  {[
                    { label: "Dirección completa", value: reviewDireccion, setter: setReviewDireccion, required: true, colSpan: true },
                    { label: "Referencia catastral", value: reviewRefCatastral, setter: setReviewRefCatastral, required: true },
                    { label: "Superficie (m²)", value: reviewSuperficie, setter: setReviewSuperficie, required: true, type: "number" },
                  ].map(field => {
                    const isMissing = field.required && !field.value.trim();
                    return (
                      <div key={field.label} className={(field as any).colSpan ? "col-span-2" : ""}>
                        <Label className={`text-[11px] flex items-center gap-1 ${isMissing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {field.label}{field.required && <span className="text-amber-500">*</span>}
                          {!isMissing && field.value.trim() && <CheckCircle2 size={10} className="text-primary" />}
                        </Label>
                        <Input type={(field as any).type || "text"} value={field.value} onChange={(e) => field.setter(e.target.value)} className={`h-8 text-xs ${isMissing ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Condiciones */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Condiciones</h4>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  {[
                    { label: "Renta mensual (€)", value: renta, setter: setRenta, required: true, type: "number" },
                    { label: "Fianza", value: fianza, setter: setFianza, required: false },
                    { label: "Fecha de inicio", value: fechaInicio, setter: setFechaInicio, required: true, type: "date" },
                    { label: "Duración", value: duracion, setter: setDuracion, required: false },
                  ].map(field => {
                    const isMissing = field.required && !field.value.trim();
                    return (
                      <div key={field.label}>
                        <Label className={`text-[11px] flex items-center gap-1 ${isMissing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {field.label}{field.required && <span className="text-amber-500">*</span>}
                          {!isMissing && field.value.trim() && <CheckCircle2 size={10} className="text-primary" />}
                        </Label>
                        <Input type={field.type || "text"} value={field.value} onChange={(e) => field.setter(e.target.value)} className={`h-8 text-xs ${isMissing ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inventario opcional */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-muted-foreground" />
                    <Label className="text-xs font-semibold">Inventario de enseres</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{incluirInventario ? "Incluido" : "No incluido"}</span>
                    <Switch checked={incluirInventario} onCheckedChange={setIncluirInventario} />
                  </div>
                </div>

                {incluirInventario && (
                  <InventarioEditor items={inventarioItems} onChange={setInventarioItems} />
                )}
              </div>
            </div>
          </div>
        )}

        {step === "template" && (
          <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
            <div className="space-y-4 py-2">
              <div className="text-center space-y-2 py-4">
                <FileUp size={32} className="mx-auto text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Usar plantilla de contrato</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Sube tu propia plantilla de contrato y la IA la rellenará con los datos del contrato.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {["PDF", "Word (.doc, .docx)", "Pages", "OpenDocument (.odt)", "Texto (.txt, .md)"].map(fmt => (
                    <span key={fmt} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{fmt}</span>
                  ))}
                </div>
              </div>

              {/* Upload new template */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => templateInputRef.current?.click()}
                  disabled={loadingTemplateContent}
                >
                  {loadingTemplateContent ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Subir plantilla desde el ordenador
                </Button>
                <p className="text-[10px] text-muted-foreground text-center -mt-1">
                  Formatos: .doc, .docx, .pages, .pdf, .odt, .txt, .md
                </p>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".txt,.md,.text,.doc,.docx,.pages,.pdf,.odt,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleTemplateUpload(f, true);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Saved templates */}
              {savedPlantillas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <FolderOpen size={13} className="text-muted-foreground" />
                    Plantillas guardadas
                  </Label>
                  <div className="space-y-1.5">
                    {savedPlantillas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => loadSavedTemplate(p)}
                        disabled={loadingTemplateContent}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                      >
                        <FileText size={14} className="text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{p.nombre}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{p.archivo_nombre}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingPlantillas && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                  <Loader2 size={12} className="animate-spin" /> Cargando plantillas…
                </p>
              )}

              {/* Template loaded confirmation */}
              {useTemplate && templateText && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
                  <CheckCircle2 size={16} />
                  <div>
                    <p className="font-medium">Plantilla cargada correctamente</p>
                    <p className="text-muted-foreground mt-0.5">{templateText.length} caracteres · Lista para generar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="flex-1 overflow-y-auto max-h-[50vh]" ref={scrollRef}>
            <div className="prose prose-sm max-w-none px-1">
              <ReactMarkdown>{generatedText}</ReactMarkdown>
            </div>
            {generating && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> Generando contrato…
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "form" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={populateReview}>
                <ClipboardCheck size={14} className="mr-1" /> Completar contrato
              </Button>
            </div>
          )}
          {step === "review" && !generating && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep("form")}>
                Volver
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("template")}>
                  <FileUp size={14} className="mr-1" /> Generar contrato desde plantilla
                </Button>
                <Button onClick={() => handleGenerate(false)}>
                  <Sparkles size={14} className="mr-1" /> Generar contrato automático
                </Button>
              </div>
            </div>
          )}
          {step === "template" && !generating && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep("review")}>
                Volver
              </Button>
              {useTemplate && templateText && (
                <Button onClick={() => handleGenerate(true)}>
                  <Sparkles size={14} className="mr-1" /> Generar desde plantilla
                </Button>
              )}
            </div>
          )}
          {step === "result" && generatedText && !generating && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" size="sm" onClick={() => { setGeneratedText(""); setStep("review"); }}>
                Volver
              </Button>
              <div className="flex gap-2 flex-wrap">
                {incluirInventario && inventarioItems.filter(i => i.nombre.trim()).length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSaveInventarioPdf} disabled={savingInventario}>
                    {savingInventario ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Package size={14} className="mr-1" />}
                    {savingInventario ? "Guardando…" : "Guardar inventario PDF"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download size={14} className="mr-1" /> Descargar .md
                </Button>
                <Button size="sm" onClick={handleSaveContract} disabled={saving}>
                  {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                  {saving ? "Guardando…" : "Guardar contrato"}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GeneradorContrato;
