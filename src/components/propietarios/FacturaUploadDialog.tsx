import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFacturas } from "@/hooks/useFacturas";
import { useProfile } from "@/hooks/useProfile";
import { useProveedores } from "@/hooks/useProveedores";
import type { Property } from "@/hooks/useProperties";
import type { Proveedor } from "@/hooks/useProveedores";
import { toast } from "sonner";
import FacturaFormFields, { emptyFacturaForm, type FacturaFormData } from "./FacturaFormFields";
import { supabase } from "@/integrations/supabase/client";

interface FacturaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  proveedores?: Proveedor[];
  defaultPropertyId?: string | null;
  incidenciaId?: string | null;
  onSuccess?: () => void;
}

const FacturaUploadDialog = ({
  open,
  onOpenChange,
  properties,
  proveedores = [],
  defaultPropertyId = null,
  incidenciaId = null,
  onSuccess,
}: FacturaUploadDialogProps) => {
  const { uploadAndAnalyze, createManual } = useFacturas();
  const { profile } = useProfile();
  const { proveedores: hookProveedores } = useProveedores();
  const resolvedProveedores = proveedores.length > 0 ? proveedores : hookProveedores;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<string>("archivo");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FacturaFormData>({
    ...emptyFacturaForm,
    property_id: defaultPropertyId || "none",
    receptor_nif: "",
    receptor_nombre: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  const resetForm = () => {
    setForm({ ...emptyFacturaForm, property_id: defaultPropertyId || "none" });
    setSelectedFile(null);
    setOcrDone(false);
    setTab("archivo");
  };

  const resolvedPropertyId = form.property_id === "none" ? null : form.property_id;

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setUploading(true);
    toast.info(`Analizando "${file.name}" con OCR...`);

    try {
      const base64 = await fileToBase64(file);
      const { data: result, error } = await supabase.functions.invoke("analyze-factura", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (!error && result && !result.error) {
        // Try to auto-match provider by NIF then name
        let matchedProvId = "";
        const ocrNif = result.factura_emisor_nif?.trim();
        const ocrName = result.factura_emisor_nombre?.trim();
        if (ocrNif) {
          const byNif = resolvedProveedores.find(p => p.cif && p.cif.trim().toUpperCase() === ocrNif.toUpperCase());
          if (byNif) matchedProvId = byNif.id;
        }
        if (!matchedProvId && ocrName) {
          const norm = ocrName.toLowerCase();
          const byName = resolvedProveedores.filter(p => p.nombre.trim().toLowerCase() === norm);
          if (byName.length === 1) matchedProvId = byName[0].id;
        }

        setForm(prev => ({
          ...prev,
          emisor_nombre: result.factura_emisor_nombre || prev.emisor_nombre,
          emisor_nif: result.factura_emisor_nif || prev.emisor_nif,
          numero_factura: result.factura_numero || prev.numero_factura,
          fecha: result.factura_fecha || prev.fecha,
          base_imponible: result.factura_base_imponible ? String(result.factura_base_imponible) : prev.base_imponible,
          cuota_iva: result.factura_cuota_iva ? String(result.factura_cuota_iva) : prev.cuota_iva,
          total: result.factura_total ? String(result.factura_total) : prev.total,
          ...(matchedProvId ? { proveedor_id: matchedProvId } : {}),
        }));
        const fields = [result.factura_emisor_nombre, result.factura_numero, result.factura_total].filter(Boolean).length;
        toast.success(`${fields} campos detectados por OCR${matchedProvId ? " · Proveedor identificado" : ""}`);
      }
    } catch (err) {
      console.warn("OCR failed:", err);
    }
    setOcrDone(true);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (e.target) e.target.value = "";
  };

  const handleSave = async () => {
    const totalVal = parseFloat(form.total);
    if (!totalVal && totalVal !== 0) {
      toast.error("El importe total es obligatorio");
      return;
    }
    setUploading(true);

    if (selectedFile) {
      const result = await uploadAndAnalyze(selectedFile, resolvedPropertyId, {
        categoria: form.categoria,
        emisor_nombre: form.emisor_nombre || null,
        emisor_nif: form.emisor_nif || null,
        numero_factura: form.numero_factura || null,
        fecha: form.fecha || null,
        fecha_devengo: form.fecha_devengo || null,
        base_imponible: form.base_imponible ? parseFloat(form.base_imponible) : null,
        cuota_iva: form.cuota_iva ? parseFloat(form.cuota_iva) : null,
        total: totalVal,
        receptor_nif: form.receptor_nif || null,
        receptor_nombre: form.receptor_nombre || null,
        fecha_pago: form.fecha_pago || null,
        forma_pago: form.forma_pago || null,
        ano_fiscal: form.ano_fiscal ? parseInt(form.ano_fiscal) : null,
        deducible_irpf: form.deducible_irpf,
        proveedor_id: form.proveedor_id || null,
      });
      if (result) {
        toast.success("Factura guardada correctamente");
        onOpenChange(false);
        resetForm();
        onSuccess?.();
      }
    } else {
      const result = await createManual({
        property_id: resolvedPropertyId,
        emisor_nombre: form.emisor_nombre || null,
        emisor_nif: form.emisor_nif || null,
        numero_factura: form.numero_factura || null,
        fecha: form.fecha || null,
        fecha_devengo: form.fecha_devengo || null,
        base_imponible: form.base_imponible ? parseFloat(form.base_imponible) : null,
        cuota_iva: form.cuota_iva ? parseFloat(form.cuota_iva) : null,
        total: totalVal,
        categoria: form.categoria,
        receptor_nif: form.receptor_nif || null,
        receptor_nombre: form.receptor_nombre || null,
        fecha_pago: form.fecha_pago || null,
        forma_pago: form.forma_pago || null,
        ano_fiscal: form.ano_fiscal ? parseInt(form.ano_fiscal) : null,
        deducible_irpf: form.deducible_irpf,
        proveedor_id: form.proveedor_id || null,
      });
      if (result) {
        toast.success("Factura registrada correctamente");
        onOpenChange(false);
        resetForm();
        onSuccess?.();
      }
    }
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt size={18} className="text-primary" />
            Nueva factura
          </DialogTitle>
        </DialogHeader>

        {/* Document upload section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Documento</p>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="archivo" className="flex-1 gap-1.5 text-xs">
                <Upload size={13} /> Archivo
              </TabsTrigger>
              <TabsTrigger value="camara" className="flex-1 gap-1.5 text-xs">
                <Camera size={13} /> Cámara
              </TabsTrigger>
            </TabsList>

            <TabsContent value="archivo" className="mt-3">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">📄 {selectedFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ocrDone ? "✅ Analizado con OCR" : "Analizando..."}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">PDF, imagen o fotografía</p>
                  </>
                )}
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="text-xs">
                  {uploading ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Analizando...</> : selectedFile ? "Cambiar archivo" : "Seleccionar archivo"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5">Se analizará automáticamente con OCR</p>
              </div>
            </TabsContent>

            <TabsContent value="camara" className="mt-3">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <Camera size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-2">Haz una foto de la factura</p>
                <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()} className="text-xs">
                  {uploading ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Analizando...</> : "Abrir cámara"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Unified form fields */}
        <FacturaFormFields
          form={form}
          onChange={setForm}
          properties={properties}
          proveedores={resolvedProveedores}
          profileNif={profile.nif}
          profileDireccion={profile.direccion}
          defaultPropertyId={defaultPropertyId}
        />

        {/* Save button */}
        <Button className="w-full gap-2 mt-2" disabled={uploading || !form.total} onClick={handleSave}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
          {uploading ? "Guardando..." : "Registrar factura"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default FacturaUploadDialog;
