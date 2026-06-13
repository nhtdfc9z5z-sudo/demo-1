import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Upload, ExternalLink, CheckCircle2, Clock, AlertCircle, ChevronDown, Plus,
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SecureFileLink } from "@/components/common/SecureFileLink";

const DOCS_POR_TIPO: Record<string, { categoria: string; label: string }[]> = {
  asalariado: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "contrato_trabajo", label: "Contrato de trabajo" },
    { categoria: "nominas", label: "Últimas 3 nóminas" },
    { categoria: "vida_laboral", label: "Vida laboral" },
    { categoria: "irpf", label: "Declaración de la renta (IRPF)" },
  ],
  autonomo: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "alta_autonomos", label: "Alta de autónomos" },
    { categoria: "irpf", label: "Última declaración de la renta" },
    { categoria: "modelo_trimestral", label: "Modelo trimestral (130/131)" },
    { categoria: "resumen_iva", label: "Resumen anual IVA (390)" },
  ],
  pensionista: [
    { categoria: "dni", label: "DNI / NIE" },
    { categoria: "certificado_pension", label: "Certificado de pensión / justificante de ingresos" },
  ],
};

interface TenantDoc {
  id: string;
  inquilino_id: string;
  user_id: string;
  categoria: string;
  nombre_archivo: string;
  storage_path: string;
  url: string;
  created_at: string;
  visible_para_inquilino: boolean;
  subido_por: string;
}

interface Props {
  inquilinoId: string;
  tipoInquilino: string | null;
}

const DocumentosSection = ({ inquilinoId, tipoInquilino }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<TenantDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const otroInputRef = useRef<HTMLInputElement | null>(null);

  const tipo = tipoInquilino?.toLowerCase() || "asalariado";
  const requiredDocs = DOCS_POR_TIPO[tipo] || DOCS_POR_TIPO.asalariado;

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inquilino_documentos")
      .select("*")
      .eq("inquilino_id", inquilinoId)
      .order("created_at", { ascending: true });
    if (data) setDocumentos(data as unknown as TenantDoc[]);
    setLoading(false);
  }, [inquilinoId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (file: File, categoria: string) => {
    if (!user) return;
    setUploading(categoria);

    try {
      const ext = file.name.split(".").pop() || "pdf";
      const fileName = `${Date.now()}.${ext}`;
      const storagePath = `${user.id}/${inquilinoId}/${categoria}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inquilino-documentos")
        .upload(storagePath, file);

      if (uploadError) {
        toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
        console.error(uploadError);
        return;
      }

      const { data: urlData } = await supabase.storage
        .from("inquilino-documentos")
        .createSignedUrl(storagePath, 3600);

      const { error: insertError } = await supabase
        .from("inquilino_documentos")
        .insert({
          inquilino_id: inquilinoId,
          user_id: user.id,
          categoria,
          nombre_archivo: file.name,
          storage_path: storagePath,
          url: urlData?.signedUrl || "",
          visible_para_inquilino: true,
          subido_por: "inquilino",
        } as any);

      if (insertError) {
        toast({ title: "Error", description: "No se pudo registrar el documento.", variant: "destructive" });
        console.error(insertError);
        return;
      }

      toast({ title: "Documento subido", description: file.name });
      await fetchDocs();
    } finally {
      setUploading(null);
    }
  };

  const getDocsForCategory = (categoria: string) =>
    documentos.filter(d => d.categoria === categoria);

  const totalRequired = requiredDocs.length;
  const totalUploaded = requiredDocs.filter(req => getDocsForCategory(req.categoria).length > 0).length;

  const otrosDocs = documentos.filter(d => d.categoria === "otro" && d.subido_por === "inquilino");
  const ownerDocs = documentos.filter(d => d.subido_por === "propietario" && !requiredDocs.some(r => r.categoria === d.categoria));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Mis documentos</h3>
                <p className="text-xs text-muted-foreground">
                  {totalUploaded}/{totalRequired} documentos requeridos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "text-[10px]",
                  totalUploaded === totalRequired
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {totalUploaded === totalRequired ? "Completo" : "Pendiente"}
              </Badge>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {requiredDocs.map(req => {
                const docs = getDocsForCategory(req.categoria);
                const hasDoc = docs.length > 0;

                return (
                  <div
                    key={req.categoria}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      hasDoc ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {hasDoc ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{req.label}</p>
                          {hasDoc && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {docs.map(doc => (
                                <SecureFileLink
                                  key={doc.id}
                                  bucket="inquilino-documentos"
                                  path={doc.storage_path}
                                  fallbackUrl={doc.url}
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {doc.nombre_archivo}
                                </SecureFileLink>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <input
                          type="file"
                          ref={el => { fileInputRefs.current[req.categoria] = el; }}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(file, req.categoria);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={uploading === req.categoria}
                          onClick={() => fileInputRefs.current[req.categoria]?.click()}
                        >
                          {uploading === req.categoria ? (
                            <Clock className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-1" />
                              {hasDoc ? "Añadir" : "Subir"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Otra documentación */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Otra documentación
                  </p>
                  <div>
                    <input
                      type="file"
                      ref={otroInputRef}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, "otro");
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading === "otro"}
                      onClick={() => otroInputRef.current?.click()}
                    >
                      {uploading === "otro" ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Subir documento
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {otrosDocs.length > 0 && (
                  <div className="space-y-2">
                    {otrosDocs.map(doc => (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-border p-3 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <SecureFileLink
                            bucket="inquilino-documentos"
                            path={doc.storage_path}
                            fallbackUrl={doc.url}
                            className="text-sm text-primary hover:underline truncate block text-left"
                          >
                            {doc.nombre_archivo}
                          </SecureFileLink>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Owner-uploaded documents visible to tenant */}
              {ownerDocs.length > 0 && (
                <>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Documentos del propietario
                    </p>
                  </div>
                  {ownerDocs.map(doc => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-border p-3 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <SecureFileLink
                          bucket="inquilino-documentos"
                          path={doc.storage_path}
                          fallbackUrl={doc.url}
                          className="text-sm text-primary hover:underline truncate block text-left"
                        >
                          {doc.nombre_archivo}
                        </SecureFileLink>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
};

export default DocumentosSection;
