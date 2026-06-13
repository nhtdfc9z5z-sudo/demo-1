import { useState, useRef } from "react";
import { Receipt, Upload, FileSearch, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SectionCard, { FormRow } from "./SectionCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const FacturaSection = ({ data, onChange }: Props) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success(`Factura "${file.name}" importada`);
    }
  };

  const analyzeFactura = async () => {
    if (!selectedFile) {
      toast.error("Primero sube una factura");
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const { data: result, error } = await supabase.functions.invoke("analyze-factura", {
        body: { imageBase64: base64, mimeType: selectedFile.type },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const fieldMap: Record<string, string> = {
        factura_emisor_nombre: "factura_emisor_nombre",
        factura_emisor_nif: "factura_emisor_nif",
        factura_receptor_nombre: "factura_receptor_nombre",
        factura_receptor_nif: "factura_receptor_nif",
        factura_numero: "factura_numero",
        factura_fecha: "factura_fecha",
        factura_base_imponible: "factura_base_imponible",
        factura_iva_porcentaje: "factura_iva_porcentaje",
        factura_cuota_iva: "factura_cuota_iva",
        factura_total: "factura_total",
      };

      let filled = 0;
      for (const [key, field] of Object.entries(fieldMap)) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== "") {
          onChange(field, result[key]);
          filled++;
        }
      }
      toast.success(`Factura analizada: ${filled} campos autocompletados`);
    } catch (err: any) {
      console.error("Error analyzing factura:", err);
      toast.error(err.message || "Error al analizar la factura");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SectionCard title="Factura" icon={Receipt}>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
          />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
            <Upload size={13} /> Subir factura
          </span>
        </label>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
          />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
            📷 Hacer foto
          </span>
        </label>
        {selectedFile && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            📄 {selectedFile.name}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={analyzeFactura}
          disabled={analyzing || !selectedFile}
        >
          {analyzing ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
          {analyzing ? "Analizando..." : "Analizar factura"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Emisor</p>
          <FormRow label="Nombre">
            <Input value={data.factura_emisor_nombre || ""} onChange={e => onChange("factura_emisor_nombre", e.target.value)} />
          </FormRow>
          <FormRow label="NIF">
            <Input value={data.factura_emisor_nif || ""} onChange={e => onChange("factura_emisor_nif", e.target.value)} className="max-w-[160px]" />
          </FormRow>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Receptor</p>
          <FormRow label="Nombre">
            <Input value={data.factura_receptor_nombre || ""} onChange={e => onChange("factura_receptor_nombre", e.target.value)} />
          </FormRow>
          <FormRow label="NIF">
            <Input value={data.factura_receptor_nif || ""} onChange={e => onChange("factura_receptor_nif", e.target.value)} className="max-w-[160px]" />
          </FormRow>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground mt-4 mb-2 uppercase tracking-wider">Datos factura</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Número</label>
          <Input value={data.factura_numero || ""} onChange={e => onChange("factura_numero", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Fecha</label>
          <Input type="date" value={data.factura_fecha || ""} onChange={e => onChange("factura_fecha", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Base imponible</label>
          <Input type="number" value={data.factura_base_imponible ?? ""} onChange={e => onChange("factura_base_imponible", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">IVA %</label>
          <Input type="number" value={data.factura_iva_porcentaje ?? ""} onChange={e => onChange("factura_iva_porcentaje", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cuota IVA</label>
          <Input type="number" value={data.factura_cuota_iva ?? ""} onChange={e => onChange("factura_cuota_iva", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Total</label>
          <Input type="number" value={data.factura_total ?? ""} onChange={e => onChange("factura_total", Number(e.target.value))} />
        </div>
      </div>
    </SectionCard>
  );
};

export default FacturaSection;
