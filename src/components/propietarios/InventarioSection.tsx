import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Download, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/hooks/useProperties";

interface InventarioDoc {
  id: string;
  nombre_archivo: string;
  url: string;
  storage_path?: string;
  created_at: string;
  inquilino_id: string;
  inquilino_nombre?: string;
  property_nombre?: string;
}

interface InventarioSectionProps {
  properties: Property[];
  onBack: () => void;
}

const InventarioSection = ({ properties, onBack }: InventarioSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<InventarioDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("inquilino_documentos")
        .select("id, nombre_archivo, url, storage_path, created_at, inquilino_id")
        .eq("user_id", user.id)
        .eq("categoria", "inventario")
        .order("created_at", { ascending: false });

      if (data) {
        // Enrich with inquilino and property names
        const { data: inquilinos } = await supabase
          .from("inquilinos")
          .select("id, nombre, apellidos, property_id")
          .eq("user_id", user.id);

        const enriched: InventarioDoc[] = data.map((d: any) => {
          const inq = inquilinos?.find((i: any) => i.id === d.inquilino_id);
          const prop = inq ? properties.find((p) => p.id === inq.property_id) : null;
          return {
            ...d,
            inquilino_nombre: inq
              ? `${inq.nombre}${inq.apellidos ? " " + inq.apellidos : ""}`
              : undefined,
            property_nombre: prop?.nombre_interno || undefined,
          };
        });
        setDocs(enriched);
      }
      if (error) console.error(error);
      setLoading(false);
    };
    fetchDocs();
  }, [user, properties]);

  const getDocUrl = async (doc: InventarioDoc) => {
    if (doc.storage_path) {
      const { data, error } = await supabase.storage
        .from("contratos")
        .createSignedUrl(doc.storage_path, 60 * 60);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }

      // Bucket privado: si la firma falla, devolvemos vacío.
      return "";
    }

    return doc.url?.startsWith("http") ? doc.url : "";
  };

  const openDoc = async (doc: InventarioDoc) => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    const url = await getDocUrl(doc);

    if (!url) {
      popup?.close();
      toast({ title: "No disponible", description: "No se pudo abrir este inventario." });
      return;
    }

    if (popup) {
      popup.location.href = url;
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const handleDelete = async (doc: InventarioDoc) => {
    if (!confirm("¿Eliminar este inventario?")) return;
    await supabase.from("inquilino_documentos").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: "Eliminado", description: "Inventario eliminado." });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-1 text-muted-foreground">
        <ArrowLeft size={14} /> Volver a documentación
      </Button>

      <h2 className="text-lg font-semibold text-foreground mb-1">Inventarios</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Documentos de inventario generados desde el generador de contratos. Cada uno incluye tabla de enseres y fotografías.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay inventarios guardados todavía.</p>
          <p className="text-xs mt-1">
            Puedes generar uno desde <strong>Contratos → Generar contrato</strong> activando la opción de inventario.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => openDoc(doc)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.property_nombre || "Inventario"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {doc.inquilino_nombre && `${doc.inquilino_nombre} · `}
                  {new Date(doc.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDoc(doc);
                  }}
                >
                  <ExternalLink size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InventarioSection;
