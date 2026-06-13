import { useState, useEffect, useRef } from "react";
import { ArrowLeft, FileText, Trash2, Download, Home, Upload, Copy, Check, ChevronDown, ChevronUp, BookOpen, ExternalLink, Leaf } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { validateFile } from "@/lib/fileValidation";
import type { Property } from "@/hooks/useProperties";
import { SecureFileLink } from "@/components/common/SecureFileLink";

interface Props {
  properties: Property[];
  onBack: () => void;
}

interface CeeDoc {
  id: string;
  property_id: string;
  nombre_archivo: string;
  url: string;
  storage_path: string;
  created_at: string;
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

const CEESection = ({ properties, onBack }: Props) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [uploadPropertyId, setUploadPropertyId] = useState<string>(properties[0]?.id ?? "");
  const [docs, setDocs] = useState<CeeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePropertyId, setGuidePropertyId] = useState<string>(properties[0]?.id ?? "");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("property_documentos")
        .select("id, property_id, nombre_archivo, url, storage_path, created_at")
        .eq("categoria", "cee")
        .order("created_at", { ascending: false });

      if (selectedPropertyId !== "all") {
        query = query.eq("property_id", selectedPropertyId);
      }

      const { data } = await query;
      setDocs((data as CeeDoc[]) ?? []);
      setLoading(false);
    };
    load();
  }, [selectedPropertyId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !uploadPropertyId) return;

    const validation = validateFile(file, "document", 10);
    if (!validation.valid) {
      toast({ title: "Archivo no válido", description: validation.error, variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${uploadPropertyId}/cee_${Date.now()}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("inquilino-documentos")
      .upload(path, file);

    if (storageError) {
      toast({ title: "Error al subir", description: storageError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from("inquilino-documentos")
      .createSignedUrl(path, 3600);

    const { error: dbError } = await supabase.from("property_documentos").insert({
      property_id: uploadPropertyId,
      user_id: user.id,
      nombre_archivo: file.name,
      storage_path: path,
      url: urlData?.signedUrl || "",
      categoria: "cee",
    });

    if (dbError) {
      toast({ title: "Error al guardar", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "CEE subido correctamente" });
      // Reload
      const { data } = await supabase
        .from("property_documentos")
        .select("id, property_id, nombre_archivo, url, storage_path, created_at")
        .eq("categoria", "cee")
        .order("created_at", { ascending: false });
      setDocs((data as CeeDoc[]) ?? []);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (doc: CeeDoc) => {
    await supabase.storage.from("inquilino-documentos").remove([doc.storage_path]);
    await supabase.from("property_documentos").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: "Certificado eliminado" });
  };

  const getPropertyName = (propertyId: string) =>
    properties.find((p) => p.id === propertyId)?.nombre_interno ?? "Activo";

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const guideProperty = properties.find((p) => p.id === guidePropertyId);

  const copyableFields = guideProperty
    ? [
        { label: "Dirección completa", value: guideProperty.direccion_completa || "No disponible", key: "dir" },
        { label: "Código postal", value: guideProperty.codigo_postal || "No disponible", key: "cp" },
        { label: "Ciudad", value: guideProperty.ciudad || "No disponible", key: "ciudad" },
        { label: "Provincia", value: guideProperty.provincia || "No disponible", key: "prov" },
        { label: "Referencia catastral", value: guideProperty.referencia_catastral || "No disponible", key: "catastro" },
        { label: "Superficie (m²)", value: guideProperty.superficie_m2 ? `${guideProperty.superficie_m2} m²` : "No disponible", key: "sup" },
        { label: "Año de construcción", value: guideProperty.ano_construccion ? String(guideProperty.ano_construccion) : "No disponible", key: "ano" },
        { label: "Tipo de vivienda", value: guideProperty.tipo_vivienda || "No disponible", key: "tipo" },
      ]
    : [];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a documentación
      </button>

      <h2 className="text-lg font-semibold text-foreground mb-1">Certificado de Eficiencia Energética (CEE)</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Sube el certificado energético de tus activos o consulta cómo obtenerlo.
      </p>

      {/* Upload section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Upload size={16} className="text-primary" /> Subir certificado energético
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={uploadPropertyId} onValueChange={setUploadPropertyId}>
            <SelectTrigger className="h-10 rounded-xl text-sm sm:max-w-[240px]">
              <SelectValue placeholder="Selecciona activo" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleUpload}
              className="hidden"
              id="cee-upload"
            />
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              disabled={uploading || !uploadPropertyId}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {uploading ? "Subiendo..." : "Seleccionar archivo"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG o WEBP · máx. 10 MB</p>
      </div>

      {/* Documents list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Certificados subidos</h3>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-[180px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los activos</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando...</p>
        ) : docs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
            <FileText size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay certificados subidos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <FileText size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.nombre_archivo}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Home size={10} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{getPropertyName(doc.property_id)}</span>
                    <span className="text-xs text-muted-foreground">· {new Date(doc.created_at).toLocaleDateString("es-ES")}</span>
                  </div>
                </div>
                <SecureFileLink
                  bucket="inquilino-documentos"
                  path={doc.storage_path}
                  fallbackUrl={doc.url}
                  className="text-primary hover:text-primary/80 shrink-0"
                >
                  <Download size={16} />
                </SecureFileLink>
                <button onClick={() => handleDelete(doc)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guide section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-foreground">Conseguir el CEE de tu vivienda</span>
            <p className="text-xs text-muted-foreground mt-0.5">Guía paso a paso para solicitarlo</p>
          </div>
          {guideOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>

        {guideOpen && (
          <div className="px-5 pb-5 border-t border-border pt-4 space-y-5">
            {/* Property selector for guide */}
            {properties.length > 1 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Vivienda para la que necesitas el CEE</label>
                <Select value={guidePropertyId} onValueChange={setGuidePropertyId}>
                  <SelectTrigger className="h-9 rounded-lg text-sm max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Copyable property data */}
            {guideProperty && (
              <div className="bg-muted/40 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Datos de tu vivienda (copia y pega)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {copyableFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
                        <p className="text-sm text-foreground truncate">{f.value}</p>
                      </div>
                      {f.value !== "No disponible" && (
                        <button
                          onClick={() => copyToClipboard(f.value, f.key)}
                          className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                          title="Copiar"
                        >
                          {copiedField === f.key ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step-by-step guide */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">¿Qué es el CEE?</h4>
              <p className="text-sm text-muted-foreground">
                El Certificado de Eficiencia Energética (CEE) es un documento oficial obligatorio para alquilar o vender una vivienda en España. Clasifica el inmueble de la A (más eficiente) a la G (menos eficiente) según su consumo energético.
              </p>

              <h4 className="text-sm font-semibold text-foreground">Pasos para obtener el CEE</h4>

              <div className="space-y-3">
                <StepCard
                  number={1}
                  title="Busca un técnico certificador"
                  description="Debe ser un arquitecto, arquitecto técnico o ingeniero habilitado. Puedes encontrar certificadores en tu zona a través de plataformas online o colegios profesionales."
                >
                  <div className="flex flex-wrap gap-2 mt-2">
                    <a href="https://www.certicalia.com" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> Certicalia
                    </a>
                    <a href="https://www.certificadodeeficienciaenergetica.com" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> CertificadoDeEficiencia
                    </a>
                  </div>
                </StepCard>

                <StepCard
                  number={2}
                  title="Solicita presupuesto y agenda visita"
                  description="El técnico necesitará visitar la vivienda para tomar medidas, comprobar la instalación de calefacción, ventanas, aislamiento, etc. El coste medio es de 60–150 € dependiendo del tamaño."
                />

                <StepCard
                  number={3}
                  title="Facilita los datos de la vivienda"
                  description="El técnico te pedirá la dirección completa, referencia catastral, superficie y año de construcción. Copia los datos de tu vivienda desde el panel superior."
                />

                <StepCard
                  number={4}
                  title="El técnico realiza la visita e inspección"
                  description="Tomará medidas del inmueble, comprobará las instalaciones térmicas (caldera, aire acondicionado), tipo de ventanas, aislamiento y orientación de la vivienda."
                />

                <StepCard
                  number={5}
                  title="Recibe el certificado y la etiqueta energética"
                  description="El técnico genera el certificado con el programa oficial (CE3X o HULC) y lo registra en el organismo competente de tu comunidad autónoma. Recibirás el documento PDF y la etiqueta con la calificación."
                />

                <StepCard
                  number={6}
                  title="Registra el CEE en tu comunidad autónoma"
                  description="En la mayoría de comunidades, el propio técnico puede registrarlo online. En otras, deberás hacerlo tú. El registro suele ser gratuito o tener una tasa reducida."
                >
                  <div className="flex flex-wrap gap-2 mt-2">
                    <a href="https://energia.gob.es/desarrollo/EficienciaEnergetica/CertificacionEnergetica/Paginas/certificacion.aspx" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> IDAE · Info oficial
                    </a>
                  </div>
                </StepCard>

                <StepCard
                  number={7}
                  title="Sube el certificado a CapitalRent"
                  description="Una vez tengas el PDF o imagen del certificado, súbelo desde el formulario de arriba asociándolo a la vivienda correspondiente. Así lo tendrás siempre accesible."
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 mt-4">
                <p className="text-sm text-amber-900 dark:text-amber-200 font-medium mb-1">⚠️ Vigencia del CEE</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  El certificado tiene una validez de <strong>10 años</strong> desde su fecha de emisión. Si la calificación es G, la validez se reduce a <strong>5 años</strong> en algunas comunidades. Asegúrate de renovarlo antes de que caduque.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StepCard = ({ number, title, description, children }: { number: number; title: string; description: string; children?: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
      {number}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      {children}
    </div>
  </div>
);

export default CEESection;
