import { useState, useEffect, useCallback, useRef } from "react";
import TitularidadStep, { defaultTitularidadFields, buildTitularidadSaveData, parseTitularidadFromRow, type TitularidadFields, type Copropietario } from "@/components/inmuebles/TitularidadStep";
import { motion } from "framer-motion";
import { ChevronDown, Save, ArrowLeft, UserPlus, ScrollText, Upload, FileText, Trash2, Loader2 } from "lucide-react";
import type { Contrato } from "@/hooks/useContratos";
import PropertyContratoBlock from "./PropertyContratoBlock";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TextField, NumberField, SelectField, SelectFieldWithOther, SwitchField, Field } from "./FormFields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ImpuestosSection from "./ImpuestosSection";
import SegurosSection from "./SegurosSection";
import PhotoGallery from "./PhotoGallery";
import PropertyCompletionAssistant from "./PropertyCompletionAssistant";
import FichaCompletitudBar from "./ficha/FichaCompletitudBar";
import type { Property, PropertyPhoto, InsuranceEntry } from "@/hooks/useProperties";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PropertyFormProps {
  property?: Property | null;
  photos: PropertyPhoto[];
  initialData?: Record<string, unknown> | null;
  inquilinos?: { nombre: string; apellidos?: string | null; rol_inquilino?: string | null }[];
  contratos?: Contrato[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onSaveAndAddInquilino?: (data: Record<string, unknown>) => Promise<void>;
  onSaveAndAddContrato?: (data: Record<string, unknown>) => Promise<void>;
  onUploadPhotos: (files: File[]) => Promise<void>;
  onDeletePhoto: (photo: PropertyPhoto) => void;
  onBack: () => void;
  uploading?: boolean;
  onViewContrato?: () => void;
  onCreateContrato?: () => void;
  /** Notifica si hay cambios sin guardar respecto al snapshot inicial. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Si se pasa, renderiza el botón Eliminar junto a Guardar. */
  onDelete?: (property: Property) => Promise<void> | void;
  /** El form se renderiza dentro de otro contenedor con su propia cabecera. */
  embedded?: boolean;
}

const TIPOS_VIVIENDA = [
  { value: "piso", label: "Piso" },
  { value: "casa", label: "Casa" },
  { value: "estudio", label: "Estudio" },
  { value: "atico", label: "Ático" },
  { value: "duplex", label: "Dúplex" },
  { value: "chalet", label: "Chalet" },
  { value: "adosado", label: "Adosado" },
  { value: "local", label: "Local" },
];
const TIPOS_VIA = [
  { value: "Calle", label: "Calle" },
  { value: "Avenida", label: "Avenida" },
  { value: "Paseo", label: "Paseo" },
  { value: "Plaza", label: "Plaza" },
  { value: "Carretera", label: "Carretera" },
  { value: "Ronda", label: "Ronda" },
  { value: "Travesía", label: "Travesía" },
  { value: "Camino", label: "Camino" },
  { value: "Pasaje", label: "Pasaje" },
  { value: "Bulevar", label: "Bulevar" },
  { value: "Glorieta", label: "Glorieta" },
  { value: "Urbanización", label: "Urbanización" },
  { value: "Rambla", label: "Rambla" },
  { value: "Callejón", label: "Callejón" },
  { value: "Senda", label: "Senda" },
  { value: "Vía", label: "Vía" },
];

const ESTADO_GENERAL = [
  { value: "obra nueva", label: "Obra nueva" },
  { value: "reformado", label: "Reformado" },
  { value: "buen estado", label: "Buen estado" },
  { value: "a reformar", label: "A reformar" },
];

const ESTADO_BANOS = [
  { value: "obra nueva", label: "Obra nueva" },
  { value: "reformados", label: "Reformados" },
  { value: "buen estado", label: "Buen estado" },
  { value: "a reformar", label: "A reformar" },
];

const ESTADO_COCINA = [
  { value: "nueva", label: "Nueva" },
  { value: "buen_estado", label: "Buen estado" },
  { value: "a reformar", label: "A reformar" },
];

const EQUIPAMIENTO_COCINA = ["Nevera", "Horno", "Vitrocerámica", "Lavavajillas", "Microondas", "Lavadora"];

const FORMAS_PAGO_DERRAMA = [
  { value: "unico", label: "Pago único" },
  { value: "mensual", label: "Pago mensual" },
  { value: "trimestral", label: "Pago trimestral" },
  { value: "junto_comunidad", label: "Junto a la cuota de comunidad" },
  { value: "otro", label: "Otro" },
];

const FRECUENCIAS_CUOTA_COMUNIDAD = [
  { value: "mensual", label: "Al mes" },
  { value: "trimestral", label: "Al trimestre" },
  { value: "semestral", label: "Al semestre" },
  { value: "anual", label: "Al año" },
];

const FRECUENCIA_MESES: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const SUELOS = [
  { value: "parquet", label: "Parquet" },
  { value: "ceramica", label: "Cerámica" },
  { value: "terrazo", label: "Terrazo" },
  { value: "tarima", label: "Tarima flotante" },
  { value: "marmol", label: "Mármol" },
  { value: "otro", label: "Otro" },
];

const PAREDES = [
  { value: "lisas", label: "Lisas" },
  { value: "gotele", label: "Gotelé" },
  { value: "papel", label: "Papel pintado" },
  { value: "otro", label: "Otro" },
];

const VENTANAS = [
  { value: "climalit", label: "Climalit" },
  { value: "madera", label: "Madera" },
  { value: "aluminio", label: "Aluminio" },
  { value: "pvc", label: "PVC" },
  { value: "otro", label: "Otro" },
];

const ELECTRICIDAD = [
  { value: "sin actualizar", label: "Sin actualizar" },
  { value: "parcialmente actualizada", label: "Parcialmente actualizada" },
  { value: "actualizada normativa 2022", label: "Actualizada (normativa 2022)" },
];

const CANERIAS = [
  { value: "plomo", label: "Plomo (original)" },
  { value: "actualizadas", label: "Actualizadas" },
];

const CALEFACCION = [
  { value: "gas natural", label: "Gas natural" },
  { value: "electrica", label: "Eléctrica" },
  { value: "gasoil", label: "Gasóil" },
  { value: "aerotermia", label: "Aerotermia" },
  { value: "suelo radiante", label: "Suelo radiante" },
];

const AIRE = [
  { value: "split", label: "Split" },
  { value: "centralizado", label: "Centralizado" },
  { value: "conductos", label: "Por conductos" },
];

const CERT_ENERGETICO = ["A", "B", "C", "D", "E", "F", "G"].map((v) => ({ value: v, label: v }));

const ESTADO_VIVIENDA = [
  { value: "reformas", label: "Reformas" },
  { value: "libre", label: "Libre" },
  { value: "alquilada", label: "Alquilada" },
  { value: "okupada", label: "Okupada" },
  { value: "sin uso", label: "Sin uso" },
  { value: "uso propio", label: "Uso propio" },
  { value: "inqui-okupada", label: "Inqui-okupada" },
];

const SALUD = [
  { value: "green", label: "Al día (verde)" },
  { value: "yellow", label: "Desfase (amarillo)" },
  { value: "red", label: "Impagos (rojo)" },
];

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section = ({ title, defaultOpen = false, children }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between py-3 px-1 text-sm font-semibold text-foreground hover:text-primary transition">
          {title}
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-4 space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const CeeUpload = ({ propertyId, userId }: { propertyId?: string; userId?: string }) => {
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<{ id: string; nombre_archivo: string; url: string }[]>([]);

  const loadDocs = useCallback(async () => {
    if (!propertyId || !userId) return;
    const { data } = await supabase
      .from("property_documentos")
      .select("id, nombre_archivo, url")
      .eq("property_id", propertyId)
      .eq("categoria", "cee")
      .order("created_at", { ascending: false });
    if (data) setDocs(data);
  }, [propertyId, userId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !propertyId || !userId) return;
    if (file.size > 20 * 1024 * 1024) return;
    setUploading(true);
    try {
      const path = `${userId}/${propertyId}/cee/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("property-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(path);
      await supabase.from("property_documentos").insert({
        property_id: propertyId,
        user_id: userId,
        categoria: "cee",
        nombre_archivo: file.name,
        storage_path: path,
        url: urlData.publicUrl,
      });
      await loadDocs();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (doc: { id: string; nombre_archivo: string }) => {
    await supabase.from("property_documentos").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  };

  if (!propertyId) {
    return <p className="text-xs text-muted-foreground">Guarda el activo primero para poder subir el CEE.</p>;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Documento CEE</Label>
      {docs.map((doc) => (
        <div key={doc.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <FileText size={14} className="text-primary shrink-0" />
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground hover:underline truncate flex-1">
            {doc.nombre_archivo}
          </a>
          <button onClick={() => handleDelete(doc)} className="text-destructive hover:text-destructive/80 shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:text-primary/80 transition">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Subiendo..." : "Subir certificado energético"}
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
};

const PropertyForm = ({
  property,
  photos,
  initialData,
  inquilinos = [],
  contratos = [],
  onSave,
  onSaveAndAddInquilino,
  onSaveAndAddContrato,
  onUploadPhotos,
  onDeletePhoto,
  onBack,
  uploading,
  onViewContrato,
  onCreateContrato,
  onDirtyChange,
  onDelete,
  embedded,
}: PropertyFormProps) => {
  const { user } = useAuth();
  const isEditing = !!property;
  const isFromContrato = !isEditing && initialData?._fromContrato === true;
  const [deleting, setDeleting] = useState(false);
  const initialSnapshotRef = useRef<string | null>(null);

  // Form state - all fields
  const [f, setF] = useState({
    nombre_interno: "",
    tipo_via: "",
    direccion_completa: "",
    numero_portal: "",
    puerta: "",
    urbanizacion: "",
    codigo_postal: "",
    ciudad: "",
    municipio: "",
    provincia: "",
    comunidad_autonoma: "",
    tipo_vivienda: "",
    planta: "",
    tiene_ascensor: false,
    tiene_terraza: false,
    tiene_patio: false,
    tiene_balcon: false,
    superficie_m2: null as number | null,
    num_habitaciones: null as number | null,
    num_banos: null as number | null,
    referencia_catastral: "",
    ano_construccion: null as number | null,
    estado_general: "",
    estado_banos: "",
    estado_cocina: "",
    cocina_equipamiento: [] as string[],
    tipo_suelos: "",
    estado_paredes: "",
    tipo_ventanas: "",
    puente_termico: false,
    estado_electricidad: "",
    estado_canerias: "",
    ano_actualizacion_canerias: null as number | null,
    tiene_calefaccion: false,
    tipo_calefaccion: "",
    tiene_aire_acondicionado: false,
    tipo_aire_acondicionado: "",
    ubicacion_aire: "",
    tiene_certificado_energetico: false,
    calificacion_energetica: "",
    nombre_administracion: "",
    datos_empresa_administracion: "",
    cuota_comunidad: null as number | null,
    cuota_comunidad_frecuencia: "mensual",
    tiene_derrama: false,
    importe_derrama: null as number | null,
    forma_pago_derrama: "",
    fecha_fin_derrama: "",
    derrama_concepto: "",
    derrama_importe_cuota: null as number | null,
    derrama_fecha_inicio: "",
    derrama_num_cuotas: null as number | null,
    derrama_incluida_comunidad: false,
    nombre_presidente: "",
    telefono_presidente: "",
    email_presidente: "",
    presidente_vivienda: "",
    ibi_importe: null as number | null,
    ibi_fecha_pago: "",
    basuras_importe: null as number | null,
    basuras_fecha_pago: "",
    seguros: [] as InsuranceEntry[],
    valor_compra: null as number | null,
    ano_compra: null as number | null,
    gastos_compra: null as number | null,
    fuente_estimacion: "automatica",
    valor_mercado_manual: null as number | null,
    estado: "libre",
    salud_ingresos: "green",
    inquilino_nombre: "",
    compartir_habilitado: false,
    otros_datos: "",
  });

  const [titularidad, setTitularidad] = useState<TitularidadFields>(defaultTitularidadFields);

  useEffect(() => {
    if (property) {
      setF({
        nombre_interno: property.nombre_interno ?? "",
        tipo_via: (property as any).tipo_via ?? "",
        direccion_completa: property.direccion_completa ?? "",
        numero_portal: (property as any).numero_portal ?? "",
        puerta: (property as any).puerta ?? "",
        urbanizacion: (property as any).urbanizacion ?? "",
        codigo_postal: property.codigo_postal ?? "",
        ciudad: property.ciudad ?? "",
        municipio: (property as any).municipio ?? "",
        provincia: property.provincia ?? "",
        comunidad_autonoma: (property as any).comunidad_autonoma ?? "",
        tipo_vivienda: property.tipo_vivienda ?? "",
        planta: property.planta ?? "",
        tiene_ascensor: property.tiene_ascensor ?? false,
        tiene_terraza: (property as any).tiene_terraza ?? false,
        tiene_patio: (property as any).tiene_patio ?? false,
        tiene_balcon: (property as any).tiene_balcon ?? false,
        superficie_m2: property.superficie_m2,
        num_habitaciones: property.num_habitaciones,
        num_banos: property.num_banos,
        referencia_catastral: property.referencia_catastral ?? "",
        ano_construccion: (property as any).ano_construccion ?? null,
        estado_general: property.estado_general ?? "",
        estado_banos: property.estado_banos ?? "",
        estado_cocina: property.estado_cocina ?? "",
        cocina_equipamiento: property.cocina_equipamiento ?? [],
        tipo_suelos: property.tipo_suelos ?? "",
        estado_paredes: property.estado_paredes ?? "",
        tipo_ventanas: property.tipo_ventanas ?? "",
        puente_termico: property.puente_termico ?? false,
        estado_electricidad: property.estado_electricidad ?? "",
        estado_canerias: property.estado_canerias ?? "",
        ano_actualizacion_canerias: property.ano_actualizacion_canerias,
        tiene_calefaccion: property.tiene_calefaccion ?? false,
        tipo_calefaccion: property.tipo_calefaccion ?? "",
        tiene_aire_acondicionado: property.tiene_aire_acondicionado ?? false,
        tipo_aire_acondicionado: property.tipo_aire_acondicionado ?? "",
        ubicacion_aire: property.ubicacion_aire ?? "",
        tiene_certificado_energetico: property.tiene_certificado_energetico ?? false,
        calificacion_energetica: property.calificacion_energetica ?? "",
        nombre_administracion: property.nombre_administracion ?? "",
        datos_empresa_administracion: property.datos_empresa_administracion ?? "",
        cuota_comunidad: property.cuota_comunidad,
        cuota_comunidad_frecuencia: (property as any).cuota_comunidad_frecuencia ?? "mensual",
        tiene_derrama: property.tiene_derrama ?? false,
        importe_derrama: property.importe_derrama,
        forma_pago_derrama: property.forma_pago_derrama ?? "",
        fecha_fin_derrama: property.fecha_fin_derrama ?? "",
        derrama_concepto: (property as any).derrama_concepto ?? "",
        derrama_importe_cuota: (property as any).derrama_importe_cuota ?? null,
        derrama_fecha_inicio: (property as any).derrama_fecha_inicio ?? "",
        derrama_num_cuotas: (property as any).derrama_num_cuotas ?? null,
        derrama_incluida_comunidad: (property as any).derrama_incluida_comunidad ?? false,
        nombre_presidente: property.nombre_presidente ?? "",
        telefono_presidente: property.telefono_presidente ?? "",
        email_presidente: property.email_presidente ?? "",
        presidente_vivienda: (property as any).presidente_vivienda ?? "",
        ibi_importe: property.ibi_importe,
        ibi_fecha_pago: property.ibi_fecha_pago ?? "",
        basuras_importe: property.basuras_importe,
        basuras_fecha_pago: property.basuras_fecha_pago ?? "",
        seguros: (property.seguros as unknown as InsuranceEntry[] | null) ?? [],
        valor_compra: property.valor_compra,
        ano_compra: property.ano_compra,
        gastos_compra: (property as any).gastos_compra ?? null,
        fuente_estimacion: (property as any).fuente_estimacion ?? "automatica",
        valor_mercado_manual: (property as any).valor_mercado_manual ?? null,
        estado: property.estado ?? "libre",
        salud_ingresos: property.salud_ingresos ?? "green",
        inquilino_nombre: property.inquilino_nombre ?? "",
        compartir_habilitado: property.compartir_habilitado ?? false,
        otros_datos: property.otros_datos ?? "",
      });
      // Load titularidad (compat hacia atrás vía parseTitularidadFromRow)
      setTitularidad(parseTitularidadFromRow(property as any));
    }
  }, [property]);

  // Apply initialData from document analysis (only for new properties)
  useEffect(() => {
    if (!property && initialData) {
      setF((prev) => {
        const next = { ...prev };
        const keys = Object.keys(next) as (keyof typeof next)[];
        for (const key of keys) {
          if (key in initialData && initialData[key] != null) {
            (next as any)[key] = initialData[key];
          }
        }
        return next;
      });
    }
  }, [initialData, property]);

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  // Auto-fill relationship between derrama total / nº cuotas / importe cuota.
  // If two of the three are provided, derive the third automatically.
  useEffect(() => {
    if (!f.tiene_derrama) return;
    const total = f.importe_derrama;
    const num = f.derrama_num_cuotas;
    const cuota = f.derrama_importe_cuota;
    const hasTotal = total != null && total > 0;
    const hasNum = num != null && num > 0;
    const hasCuota = cuota != null && cuota > 0;
    if (hasTotal && hasNum && !hasCuota) {
      const c = Math.round((total! / num!) * 100) / 100;
      setF((prev) => ({ ...prev, derrama_importe_cuota: c }));
    } else if (hasTotal && hasCuota && !hasNum) {
      const n = Math.round(total! / cuota!);
      if (n > 0) setF((prev) => ({ ...prev, derrama_num_cuotas: n }));
    } else if (hasCuota && hasNum && !hasTotal) {
      const t = Math.round(cuota! * num! * 100) / 100;
      setF((prev) => ({ ...prev, importe_derrama: t }));
    }
  }, [f.tiene_derrama, f.importe_derrama, f.derrama_num_cuotas, f.derrama_importe_cuota]);

  // Auto-lookup & validation state
  const cpTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [addressError, setAddressError] = useState("");
  const [plantaError, setPlantaError] = useState("");
  const [puertaError, setPuertaError] = useState("");
  const [availableUnits, setAvailableUnits] = useState<{ planta: string; puerta: string }[]>([]);

  // Lookup address data: uses calle+número (direccion_completa) + municipio
  const lookupAddressData = useCallback(async (direccion: string, municipio: string, planta: string, puerta: string) => {
    if (!direccion.trim() || !municipio.trim()) return;
    setAddressError("");
    setPlantaError("");
    setPuertaError("");
    try {
      const query = encodeURIComponent(`${direccion.trim()}, ${municipio.trim()}, España`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1&countrycodes=es`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      const result = data?.[0];
      if (!result) {
        setAddressError("Dirección no encontrada. Revisa calle, número y municipio.");
        return;
      }

      // Auto-fill código postal, provincia & comunidad autónoma
      const postcode = result.address?.postcode;
      const state = result.address?.state; // Comunidad Autónoma
      const provincia = result.address?.province || result.address?.county; // Provincia
      const town = result.address?.town || result.address?.city || result.address?.village;
      if (postcode || state || provincia || town) {
        setF((prev) => ({
          ...prev,
          ...(postcode && !prev.codigo_postal ? { codigo_postal: postcode } : {}),
          ...(provincia && !prev.provincia ? { provincia } : {}),
          ...(state && !prev.comunidad_autonoma ? { comunidad_autonoma: state } : {}),
          ...(town && !prev.municipio ? { municipio: town } : {}),
        }));
      }

      // Auto-fill referencia catastral + superficie + año construcción via Catastro API
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      if (lat && lon) {
        try {
          const { data: catastroData } = await supabase.functions.invoke("catastro-lookup", {
            body: { lat, lon, planta, puerta, provincia: result.address?.state || municipio, ciudad: municipio },
          });
          if (catastroData?.success) {
            // Store available units for validation
            if (catastroData.availableUnits?.length) {
              setAvailableUnits(catastroData.availableUnits);

              // Validate planta
              const normalise = (s: string) => s?.replace(/[º°ª\s]/g, '').toUpperCase() || '';
              const normPl = normalise(planta);
              const normPu = normalise(puerta);
              const validPlantas = [...new Set(catastroData.availableUnits.map((u: any) => normalise(u.planta)))];
              const validPuertas = catastroData.availableUnits
                .filter((u: any) => normalise(u.planta) === normPl)
                .map((u: any) => normalise(u.puerta));

              if (normPl && !validPlantas.includes(normPl)) {
                const plantaLabels = [...new Set(catastroData.availableUnits.map((u: any) => u.planta))].filter(Boolean);
                setPlantaError(`Planta no válida. Disponibles: ${plantaLabels.join(', ')}`);
              }
              if (normPl && normPu && validPuertas.length > 0 && !validPuertas.includes(normPu)) {
                const puertaLabels = catastroData.availableUnits
                  .filter((u: any) => normalise(u.planta) === normPl)
                  .map((u: any) => u.puerta)
                  .filter(Boolean);
                setPuertaError(`Puerta no válida. Disponibles: ${[...new Set(puertaLabels)].join(', ')}`);
              }
            }

            setF((prev) => {
              const updates: Partial<typeof prev> = {};
              if (catastroData.rc && !prev.referencia_catastral) {
                updates.referencia_catastral = catastroData.rc;
              }
              if (catastroData.superficie && !prev.superficie_m2) {
                updates.superficie_m2 = catastroData.superficie;
              }
              if (catastroData.anoConstruccion && !prev.ano_construccion) {
                updates.ano_construccion = catastroData.anoConstruccion;
              }
              return Object.keys(updates).length ? { ...prev, ...updates } : prev;
            });
          }
        } catch {
          // silently fail
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    clearTimeout(cpTimerRef.current);
    cpTimerRef.current = setTimeout(() => {
      lookupAddressData(f.direccion_completa, f.municipio, f.planta, f.puerta);
    }, 1200);
    return () => clearTimeout(cpTimerRef.current);
  }, [f.direccion_completa, f.municipio, f.planta, f.puerta, lookupAddressData]);

  const toggleEquipamiento = (item: string) => {
    set(
      "cocina_equipamiento",
      f.cocina_equipamiento.includes(item)
        ? f.cocina_equipamiento.filter((x) => x !== item)
        : [...f.cocina_equipamiento, item]
    );
  };

  // Simple value estimation: compra * (1 + IPC_avg * years)
  const estimatedValue = (() => {
    if (!f.valor_compra || !f.ano_compra) return null;
    const years = new Date().getFullYear() - f.ano_compra;
    const avgIpc = 0.025; // 2.5% average annual
    return Math.round(f.valor_compra * Math.pow(1 + avgIpc, years));
  })();

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  // ── Dirty tracking: compara snapshot serializado del estado editable.
  useEffect(() => {
    const snapshot = JSON.stringify({ f, titularidad });
    if (initialSnapshotRef.current === null) {
      initialSnapshotRef.current = snapshot;
      onDirtyChange?.(false);
      return;
    }
    onDirtyChange?.(snapshot !== initialSnapshotRef.current);
  }, [f, titularidad, onDirtyChange]);

  // Resetea el snapshot cuando cambia el property cargado (otra ficha).
  useEffect(() => {
    initialSnapshotRef.current = null;
  }, [property?.id]);

  const handleSave = async () => {
    if (!f.nombre_interno.trim()) {
      setValidationError("El nombre interno es obligatorio. Pon un nombre corto para identificar el activo (ej: \"Piso Centro\", \"Garaje 3\").");
      return;
    }
    setValidationError("");
    setSaving(true);

    // Auto-calculate fecha_fin_derrama from fecha_inicio + num_cuotas + forma_pago
    let fechaFinDerrama: string | null = null;
    if (f.tiene_derrama && f.derrama_fecha_inicio && f.derrama_num_cuotas) {
      const start = new Date(f.derrama_fecha_inicio);
      if (!isNaN(start.getTime())) {
        const periodMonths = f.forma_pago_derrama === "trimestral" ? 3 : f.forma_pago_derrama === "mensual" ? 1 : 0;
        if (periodMonths > 0) {
          const end = new Date(start);
          end.setMonth(end.getMonth() + periodMonths * f.derrama_num_cuotas);
          fechaFinDerrama = end.toISOString().split("T")[0];
        } else if (f.forma_pago_derrama === "unico") {
          fechaFinDerrama = f.derrama_fecha_inicio;
        }
      }
    }

    const finalEstimatedValue = f.fuente_estimacion === "manual" ? f.valor_mercado_manual : estimatedValue;

    await onSave({
      ...f,
      fecha_fin_derrama: fechaFinDerrama,
      valor_estimado: finalEstimatedValue,
      ...buildTitularidadSaveData(titularidad),
    });
    // Tras guardar, el estado actual pasa a ser el nuevo "limpio".
    initialSnapshotRef.current = JSON.stringify({ f, titularidad });
    onDirtyChange?.(false);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {!embedded && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
            <ArrowLeft size={18} />
          </Button>
          <h2 className="text-xl font-semibold text-foreground">
            {isEditing ? `Editar ${f.nombre_interno}` : "Nuevo activo"}
          </h2>
        </div>
        {!isEditing && (onSaveAndAddInquilino || onSaveAndAddContrato) && (
          <div className="flex gap-2 sm:ml-auto">
            {onSaveAndAddInquilino && (
              <Button
                onClick={async () => {
                  if (!f.nombre_interno?.trim()) {
                    setValidationError("El nombre interno es obligatorio.");
                    return;
                  }
                  setValidationError(null);
                  setSaving(true);
                  try {
                    await onSaveAndAddInquilino({
                      ...f,
                      fecha_fin_derrama: f.tiene_derrama ? (f as any).fecha_fin_derrama || null : null,
                      forma_pago_derrama: f.tiene_derrama ? (f as any).forma_pago_derrama || null : null,
                      valor_estimado: estimatedValue,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
              >
                <UserPlus size={14} />
                Vincular inquilino
              </Button>
            )}
            {onSaveAndAddContrato && (
              <Button
                onClick={async () => {
                  if (!f.nombre_interno?.trim()) {
                    setValidationError("El nombre interno es obligatorio.");
                    return;
                  }
                  setValidationError(null);
                  setSaving(true);
                  try {
                    await onSaveAndAddContrato({
                      ...f,
                      fecha_fin_derrama: f.tiene_derrama ? (f as any).fecha_fin_derrama || null : null,
                      forma_pago_derrama: f.tiene_derrama ? (f as any).forma_pago_derrama || null : null,
                      valor_estimado: estimatedValue,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
              >
                <ScrollText size={14} />
                Vincular contrato
              </Button>
            )}
          </div>
        )}
      </div>
      )}

      {isFromContrato && (
        <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <ScrollText size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Creación desde contrato</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Al crear el activo, los inquilinos detectados y el contrato original se vincularán automáticamente.
            </p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Photos at top */}
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Fotos del activo</h3>
          <PhotoGallery
            photos={photos}
            onUpload={onUploadPhotos}
            onDelete={onDeletePhoto}
            uploading={uploading}
          />
        </div>

        {/* Contract block — only when editing an existing property */}
        {isEditing && property && (
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Contrato de arrendamiento</h3>
            <PropertyContratoBlock
              contratos={contratos}
              propertyId={property.id}
              onViewContrato={onViewContrato}
              onCreateContrato={onCreateContrato}
            />
          </div>
        )}

        <div className="p-5 space-y-1 divide-y divide-border">
          {/* Basic info - always open */}
          <Section title="Datos básicos" defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Nombre interno *" value={f.nombre_interno} onChange={(v) => set("nombre_interno", v)} placeholder="PV6, Casa Playa..." />
              <SelectField label="Tipo de vivienda" value={f.tipo_vivienda} onChange={(v) => set("tipo_vivienda", v)} options={TIPOS_VIVIENDA} />
              <div className="sm:col-span-2 grid grid-cols-[140px_1fr] gap-2">
                <SelectField label="Tipo de vía" value={f.tipo_via} onChange={(v) => set("tipo_via", v)} options={TIPOS_VIA} />
                <div>
                  <TextField label="Nombre de vía y número" value={f.direccion_completa} onChange={(v) => set("direccion_completa", v)} placeholder="Mayor 12" />
                  {addressError && <p className="text-xs text-destructive mt-1">{addressError}</p>}
                </div>
              </div>
              <TextField label="Nº portal" value={f.numero_portal} onChange={(v) => set("numero_portal", v)} placeholder="Portal 2" />
              <div>
                <TextField label="Planta" value={f.planta} onChange={(v) => set("planta", v)} placeholder="3º" />
                {plantaError && <p className="text-xs text-destructive mt-1">{plantaError}</p>}
              </div>
              <div>
                <TextField label="Puerta" value={f.puerta} onChange={(v) => set("puerta", v)} placeholder="A" />
                {puertaError && <p className="text-xs text-destructive mt-1">{puertaError}</p>}
              </div>
              <TextField label="Urbanización" value={f.urbanizacion} onChange={(v) => set("urbanizacion", v)} placeholder="Urb. Los Pinos" />
              <TextField label="Municipio" value={f.municipio} onChange={(v) => set("municipio", v)} placeholder="Alcorcón" />
              <TextField label="Provincia" value={f.provincia} onChange={(v) => set("provincia", v)} placeholder="Se autocompleta" />
              <TextField label="Comunidad Autónoma" value={f.comunidad_autonoma} onChange={(v) => set("comunidad_autonoma", v)} placeholder="Comunidad de Madrid" />
              <TextField label="Código postal" value={f.codigo_postal} onChange={(v) => set("codigo_postal", v)} placeholder="Se autocompleta" />
              <NumberField label="Superficie" value={f.superficie_m2} onChange={(v) => set("superficie_m2", v)} placeholder="Se autocompleta" suffix="m²" />
              <NumberField label="Habitaciones" value={f.num_habitaciones} onChange={(v) => set("num_habitaciones", v)} placeholder="3" />
              <NumberField label="Baños" value={f.num_banos} onChange={(v) => set("num_banos", v)} placeholder="2" />
              <SwitchField label="Tiene ascensor" checked={f.tiene_ascensor} onChange={(v) => set("tiene_ascensor", v)} />
              <SwitchField label="Tiene terraza" checked={f.tiene_terraza} onChange={(v) => set("tiene_terraza", v)} />
              <SwitchField label="Tiene patio" checked={f.tiene_patio} onChange={(v) => set("tiene_patio", v)} />
              <SwitchField label="Tiene balcón" checked={f.tiene_balcon} onChange={(v) => set("tiene_balcon", v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Referencia catastral" value={f.referencia_catastral} onChange={(v) => set("referencia_catastral", v)} placeholder="Se autocompleta" />
              <NumberField label="Año de construcción" value={f.ano_construccion} onChange={(v) => set("ano_construccion", v)} placeholder="Se autocompleta" />
            </div>
          </Section>

          {/* Titularidad */}
          <Section title="Titularidad y propiedad">
            <TitularidadStep fields={titularidad} onChange={setTitularidad} />
          </Section>

          {/* Property state */}
          <Section title="Estado del activo">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Estado general" value={f.estado_general} onChange={(v) => set("estado_general", v)} options={ESTADO_GENERAL} />
              <SelectField label="Baños" value={f.estado_banos} onChange={(v) => set("estado_banos", v)} options={ESTADO_BANOS} />
              <SelectField label="Cocina" value={f.estado_cocina} onChange={(v) => set("estado_cocina", v)} options={ESTADO_COCINA} />
            </div>
            <Field label="Equipamiento cocina">
              <div className="flex flex-wrap gap-2 pt-1">
                {EQUIPAMIENTO_COCINA.map((item) => (
                  <label key={item} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={f.cocina_equipamiento.includes(item)}
                      onCheckedChange={() => toggleEquipamiento(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectFieldWithOther label="Suelos" value={f.tipo_suelos} onChange={(v) => set("tipo_suelos", v)} options={SUELOS} otherPlaceholder="Tipo de suelo..." />
              <SelectFieldWithOther label="Paredes" value={f.estado_paredes} onChange={(v) => set("estado_paredes", v)} options={PAREDES} otherPlaceholder="Tipo de paredes..." />
              <SelectFieldWithOther label="Ventanas" value={f.tipo_ventanas} onChange={(v) => set("tipo_ventanas", v)} options={VENTANAS} otherPlaceholder="Tipo de ventanas..." />
              <SwitchField label="Puente térmico" checked={f.puente_termico} onChange={(v) => set("puente_termico", v)} />
              <SelectField label="Electricidad" value={f.estado_electricidad} onChange={(v) => set("estado_electricidad", v)} options={ELECTRICIDAD} />
              <SelectField label="Cañerías" value={f.estado_canerias} onChange={(v) => set("estado_canerias", v)} options={CANERIAS} />
            </div>
            {f.estado_canerias === "actualizadas" && (
              <NumberField label="Año actualización cañerías" value={f.ano_actualizacion_canerias} onChange={(v) => set("ano_actualizacion_canerias", v)} placeholder="2020" />
            )}
          </Section>

          {/* Climate */}
          <Section title="Climatización, energía y CEE">
            <SwitchField label="Tiene calefacción" checked={f.tiene_calefaccion} onChange={(v) => set("tiene_calefaccion", v)} />
            {f.tiene_calefaccion && (
              <SelectField label="Tipo de calefacción" value={f.tipo_calefaccion} onChange={(v) => set("tipo_calefaccion", v)} options={CALEFACCION} />
            )}
            <SwitchField label="Tiene aire acondicionado" checked={f.tiene_aire_acondicionado} onChange={(v) => set("tiene_aire_acondicionado", v)} />
            {f.tiene_aire_acondicionado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Tipo A/C" value={f.tipo_aire_acondicionado} onChange={(v) => set("tipo_aire_acondicionado", v)} options={AIRE} />
                <TextField label="Ubicación A/C" value={f.ubicacion_aire} onChange={(v) => set("ubicacion_aire", v)} placeholder="Todas las habitaciones" />
              </div>
            )}
            <SwitchField label="Certificado energético" checked={f.tiene_certificado_energetico} onChange={(v) => set("tiene_certificado_energetico", v)} />
            {f.tiene_certificado_energetico && (
              <SelectField label="Calificación" value={f.calificacion_energetica} onChange={(v) => set("calificacion_energetica", v)} options={CERT_ENERGETICO} />
            )}
            <CeeUpload propertyId={property?.id} userId={user?.id} />
          </Section>

          {/* Community */}
          <Section title="Comunidad de propietarios">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Cuota ordinaria de la comunidad"
                value={f.cuota_comunidad}
                onChange={(v) => set("cuota_comunidad", v)}
                placeholder="50"
                suffix="€"
              />
              <SelectField
                label="Frecuencia de pago"
                value={f.cuota_comunidad_frecuencia}
                onChange={(v) => set("cuota_comunidad_frecuencia", v)}
                options={FRECUENCIAS_CUOTA_COMUNIDAD}
              />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Cuota habitual de comunidad, <strong>sin incluir derrama</strong>. La derrama se suma aparte.
            </p>

            {/* Cuota total = ordinaria + derrama equivalente a la misma frecuencia */}
            {(() => {
              const ordinaria = f.cuota_comunidad ?? 0;
              const freqMeses = FRECUENCIA_MESES[f.cuota_comunidad_frecuencia] ?? 1;
              const freqLabel = FRECUENCIAS_CUOTA_COMUNIDAD.find(o => o.value === f.cuota_comunidad_frecuencia)?.label.toLowerCase() ?? "al mes";
              let derramaEquiv = 0;
              if (f.tiene_derrama) {
                const total = f.importe_derrama ?? 0;
                const cuota = f.derrama_importe_cuota ?? 0;
                const num = f.derrama_num_cuotas ?? 0;
                const forma = f.forma_pago_derrama;
                // Derrama mensualizada
                let derramaMes = 0;
                if (forma === "junto_comunidad") {
                  // mismo período que la cuota ordinaria
                  derramaMes = cuota ? cuota / freqMeses : (total && num ? total / (num * freqMeses) : 0);
                } else if (forma === "unico") {
                  derramaMes = total && num ? total / Math.max(num, 1) : 0;
                } else {
                  const periodMonths = forma === "trimestral" ? 3 : forma === "mensual" ? 1 : 1;
                  derramaMes = cuota ? cuota / periodMonths : 0;
                }
                derramaEquiv = derramaMes * freqMeses;
              }
              const total = ordinaria + derramaEquiv;
              if (total <= 0) return null;
              const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cuota total ({freqLabel})</p>
                    <p className="text-xs text-muted-foreground">Ordinaria + derrama prorrateada</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{fmt(total)} €</p>
                </div>
              );
            })()}

            <h4 className="text-xs font-semibold text-muted-foreground pt-3">Presidente de la comunidad</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Nombre" value={f.nombre_presidente} onChange={(v) => set("nombre_presidente", v)} placeholder="Juan Pérez" />
              <TextField label="Vivienda" value={f.presidente_vivienda} onChange={(v) => set("presidente_vivienda", v)} placeholder="Ej: 2ºA, Bajo B..." />
              <TextField label="Teléfono" value={f.telefono_presidente} onChange={(v) => set("telefono_presidente", v)} placeholder="+34 600..." />
              <TextField label="Email" value={f.email_presidente} onChange={(v) => set("email_presidente", v)} placeholder="presidente@email.com" />
            </div>

            <h4 className="text-xs font-semibold text-muted-foreground pt-3">Administración de fincas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Empresa" value={f.nombre_administracion} onChange={(v) => set("nombre_administracion", v)} placeholder="Nombre de la empresa" />
              <TextField label="Datos de contacto" value={f.datos_empresa_administracion} onChange={(v) => set("datos_empresa_administracion", v)} placeholder="CIF, teléfono..." />
            </div>
            <SwitchField label="Existe derrama" checked={f.tiene_derrama} onChange={(v) => set("tiene_derrama", v)} />
            {f.tiene_derrama && (
              <div className="space-y-4 bg-muted/30 rounded-xl p-4 border border-border">
                <TextField label="Concepto de la derrama" value={f.derrama_concepto} onChange={(v) => set("derrama_concepto", v)} placeholder="Ej: Rehabilitación fachada, ascensor..." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField label="Derrama total" value={f.importe_derrama} onChange={(v) => set("importe_derrama", v)} placeholder="12000" suffix="€" />
                  <SelectField label="Forma de pago" value={f.forma_pago_derrama} onChange={(v) => set("forma_pago_derrama", v)} options={FORMAS_PAGO_DERRAMA} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField label="Importe por cuota" value={f.derrama_importe_cuota} onChange={(v) => set("derrama_importe_cuota", v)} placeholder="200" suffix="€" />
                  <TextField label="Fecha de inicio" value={f.derrama_fecha_inicio} onChange={(v) => set("derrama_fecha_inicio", v)} placeholder="2025-01-01" type="date" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField label="Número de cuotas" value={f.derrama_num_cuotas} onChange={(v) => set("derrama_num_cuotas", v)} placeholder="12" />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Hasta cuándo (fin estimado)</Label>
                    <p className="text-sm font-medium text-foreground h-10 flex items-center">
                      {(() => {
                        if (f.derrama_fecha_inicio && f.derrama_num_cuotas) {
                          const start = new Date(f.derrama_fecha_inicio);
                          if (!isNaN(start.getTime())) {
                            const periodMonths = f.forma_pago_derrama === "trimestral" ? 3
                              : f.forma_pago_derrama === "mensual" ? 1
                              : f.forma_pago_derrama === "junto_comunidad" ? (FRECUENCIA_MESES[f.cuota_comunidad_frecuencia] ?? 1)
                              : 0;
                            if (periodMonths > 0) {
                              const end = new Date(start);
                              end.setMonth(end.getMonth() + periodMonths * f.derrama_num_cuotas);
                              return end.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
                            }
                            if (f.forma_pago_derrama === "unico") return start.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
                          }
                        }
                        return "—";
                      })()}
                    </p>
                  </div>
                </div>

                {/* Resumen calculado de la derrama */}
                {(() => {
                  const total = f.importe_derrama ?? 0;
                  const cuota = f.derrama_importe_cuota ?? 0;
                  const num = f.derrama_num_cuotas ?? 0;
                  const forma = f.forma_pago_derrama;
                  const periodMonths = forma === "trimestral" ? 3
                    : forma === "mensual" ? 1
                    : forma === "junto_comunidad" ? (FRECUENCIA_MESES[f.cuota_comunidad_frecuencia] ?? 1)
                    : forma === "unico" ? 0
                    : 1;
                  // Equivalente mensual de la derrama
                  const derramaMes = forma === "unico"
                    ? (total && num ? total / Math.max(num, 1) : 0)
                    : (cuota && periodMonths ? cuota / periodMonths : 0);

                  // Cuotas ya pagadas según fecha de inicio y hoy
                  let cuotasPagadas = 0;
                  if (f.derrama_fecha_inicio && periodMonths > 0) {
                    const start = new Date(f.derrama_fecha_inicio);
                    if (!isNaN(start.getTime())) {
                      const now = new Date();
                      const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                      cuotasPagadas = Math.max(0, Math.floor(monthsElapsed / periodMonths));
                      if (num) cuotasPagadas = Math.min(cuotasPagadas, num);
                    }
                  } else if (forma === "unico" && f.derrama_fecha_inicio) {
                    const start = new Date(f.derrama_fecha_inicio);
                    if (!isNaN(start.getTime()) && start <= new Date()) cuotasPagadas = num || 1;
                  }
                  const cuotasRestantes = num ? Math.max(0, num - cuotasPagadas) : null;
                  const importeRestante = cuotasRestantes != null && cuota
                    ? Math.round(cuotasRestantes * cuota * 100) / 100
                    : (total && cuotasPagadas && num ? Math.round((total - (total / num) * cuotasPagadas) * 100) / 100 : total || 0);
                  const mesesRestantes = cuotasRestantes != null ? cuotasRestantes * (periodMonths || 1) : null;

                  const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                  const ordinariaMes = (f.cuota_comunidad ?? 0) / (FRECUENCIA_MESES[f.cuota_comunidad_frecuencia] ?? 1);
                  const totalMes = ordinariaMes + derramaMes;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Derrama al mes</p>
                        <p className="text-sm font-semibold text-foreground">{derramaMes > 0 ? `${fmt(derramaMes)} €` : "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total cuota mes</p>
                        <p className="text-sm font-semibold text-foreground">{totalMes > 0 ? `${fmt(totalMes)} €` : "—"}</p>
                        <p className="text-[9px] text-muted-foreground">Ordinaria + derrama</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Queda por pagar</p>
                        <p className="text-sm font-semibold text-foreground">{importeRestante > 0 ? `${fmt(importeRestante)} €` : "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tiempo restante</p>
                        <p className="text-sm font-semibold text-foreground">
                          {mesesRestantes != null && mesesRestantes > 0
                            ? `${mesesRestantes} ${mesesRestantes === 1 ? "mes" : "meses"}${cuotasRestantes ? ` · ${cuotasRestantes} ${cuotasRestantes === 1 ? "cuota" : "cuotas"}` : ""}`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </Section>

          {/* Taxes */}
          <Section title="Impuestos y tasas">
            {property?.id ? (
              <ImpuestosSection propertyId={property.id} />
            ) : (
              <p className="text-sm text-muted-foreground">Guarda el activo primero para añadir impuestos.</p>
            )}
          </Section>

          {/* Insurance */}
          <Section title="Seguros">
            {property?.id ? (
              <SegurosSection propertyId={property.id} />
            ) : (
              <p className="text-sm text-muted-foreground">Guarda el activo primero para añadir seguros.</p>
            )}
          </Section>

          {/* Value */}
          <Section title="Valor del activo">
            <h4 className="text-xs font-semibold text-muted-foreground">Datos de adquisición</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField label="Precio de compra" value={f.valor_compra} onChange={(v) => set("valor_compra", v)} placeholder="180000" suffix="€" />
              <NumberField label="Año de compra" value={f.ano_compra} onChange={(v) => set("ano_compra", v)} placeholder="2015" />
              <NumberField label="Gastos de compra" value={f.gastos_compra} onChange={(v) => set("gastos_compra", v)} placeholder="15000" suffix="€" />
            </div>

            <h4 className="text-xs font-semibold text-muted-foreground pt-3">Valor actual estimado</h4>
            {estimatedValue && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Estimación automática del valor actual</p>
                <p className="text-2xl font-semibold text-primary mt-1">
                  {estimatedValue.toLocaleString("es-ES")} €
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Basado en IPC medio (2,5% anual). No sustituye una tasación profesional.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Fuente de estimación"
                value={f.fuente_estimacion}
                onChange={(v) => set("fuente_estimacion", v)}
                options={[
                  { value: "automatica", label: "Estimación automática del sistema" },
                  { value: "indice_precios", label: "Índice de precios de vivienda" },
                  { value: "manual", label: "Valor introducido manualmente" },
                ]}
              />
              {f.fuente_estimacion === "manual" && (
                <NumberField label="Valor de mercado manual" value={f.valor_mercado_manual} onChange={(v) => set("valor_mercado_manual", v)} placeholder="220000" suffix="€" />
              )}
            </div>
          </Section>

          {/* Status & tenant */}
          <Section title="Estado y alquiler">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Estado vivienda" value={f.estado} onChange={(v) => set("estado", v)} options={ESTADO_VIVIENDA} />
              <SelectField label="Salud ingresos" value={f.salud_ingresos} onChange={(v) => set("salud_ingresos", v)} options={SALUD} />
            </div>
            {/* Show linked tenants */}
            {isEditing && inquilinos.length > 0 && (
              <div className="mt-2 bg-secondary/50 rounded-xl p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Inquilinos vinculados</p>
                <div className="space-y-1">
                  {inquilinos.map((inq, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${inq.rol_inquilino === "avalista" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span>{inq.nombre} {inq.apellidos || ""}</span>
                      {inq.rol_inquilino === "avalista" && <span className="text-[10px] text-muted-foreground">(avalista)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isEditing && inquilinos.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay inquilinos vinculados a este activo.</p>
            )}
          </Section>

          {/* Sharing & other */}
          <Section title="Otros">
            <SwitchField
              label="Habilitar compartir datos generales (sin info personal)"
              checked={f.compartir_habilitado}
              onChange={(v) => set("compartir_habilitado", v)}
            />
            <Field label="Otros datos de interés">
              <Textarea
                value={f.otros_datos}
                onChange={(e) => set("otros_datos", e.target.value)}
                placeholder="Notas adicionales sobre el activo..."
                className="rounded-xl min-h-[80px]"
              />
            </Field>
          </Section>
        </div>

        {/* Save button */}
        <div className="p-5 border-t border-border bg-secondary/30">
          {validationError && (
            <p className="text-sm text-destructive mb-3">{validationError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <Save size={16} />
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : isFromContrato ? "Crear activo con contrato" : "Crear vivienda"}
            </Button>
            {!isEditing && onSaveAndAddInquilino && (
              <Button
                onClick={async () => {
                  if (!f.nombre_interno?.trim()) {
                    setValidationError("El nombre interno es obligatorio.");
                    return;
                  }
                  setValidationError(null);
                  setSaving(true);
                  try {
                    await onSaveAndAddInquilino({
                      ...f,
                      fecha_fin_derrama: f.tiene_derrama ? (f as any).fecha_fin_derrama || null : null,
                      forma_pago_derrama: f.tiene_derrama ? (f as any).forma_pago_derrama || null : null,
                      valor_estimado: estimatedValue,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                variant="outline"
                className="w-full sm:w-auto rounded-xl gap-2"
              >
                <UserPlus size={16} />
                Crear y vincular inquilino
              </Button>
            )}
            {!isEditing && onSaveAndAddContrato && (
              <Button
                onClick={async () => {
                  if (!f.nombre_interno?.trim()) {
                    setValidationError("El nombre interno es obligatorio.");
                    return;
                  }
                  setValidationError(null);
                  setSaving(true);
                  try {
                    await onSaveAndAddContrato({
                      ...f,
                      fecha_fin_derrama: f.tiene_derrama ? (f as any).fecha_fin_derrama || null : null,
                      forma_pago_derrama: f.tiene_derrama ? (f as any).forma_pago_derrama || null : null,
                      valor_estimado: estimatedValue,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                variant="outline"
                className="w-full sm:w-auto rounded-xl gap-2"
              >
                <ScrollText size={16} />
                Crear y vincular contrato
              </Button>
            )}
            {isEditing && property && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving || deleting}
                    className="w-full sm:w-auto sm:ml-auto rounded-xl gap-2"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este activo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          await onDelete(property);
                          onBack();
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      Sí, eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Completion Assistant - only for existing properties */}
      {isEditing && property && (
        <PropertyCompletionAssistant
          property={property}
          formValues={f}
          onUpdate={(key, value) => set(key as any, value)}
        />
      )}

      {isEditing && property && (
        <>
          <div className="my-4">
            <FichaCompletitudBar
              property={property}
              variant="compact"
            />
          </div>
        </>
      )}
    </motion.div>
  );
};

export default PropertyForm;
