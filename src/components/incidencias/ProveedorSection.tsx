import { useState, useRef, useEffect } from "react";
import { Wrench, Upload, FileSearch, Loader2, Plus, Star, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import SectionCard, { FormRow } from "./SectionCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Proveedor } from "@/hooks/useProveedores";
import { ESPECIALIDADES_PROVEEDOR } from "@/hooks/useProveedores";
import { cn } from "@/lib/utils";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  proveedores?: Proveedor[];
  onSelectProveedor?: (proveedor: Proveedor | null) => void;
  selectedProveedorId?: string | null;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const ProveedorSection = ({ data, onChange, proveedores = [], onSelectProveedor, selectedProveedorId = null }: Props) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "new">(selectedProveedorId ? "select" : "new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When a proveedor is selected from the combo, fill legacy fields
  const handleSelectProveedor = (proveedor: Proveedor) => {
    onSelectProveedor?.(proveedor);
    setMode("select");
    setComboOpen(false);
    // Sync legacy fields for backward compat
    onChange("proveedor_nombre", proveedor.nombre);
    onChange("proveedor_cif", proveedor.cif || "");
    onChange("proveedor_direccion", proveedor.direccion || "");
    onChange("proveedor_telefono", proveedor.telefono || "");
    onChange("proveedor_email", proveedor.email || "");
  };

  const handleClearProveedor = () => {
    onSelectProveedor?.(null);
    setMode("new");
    onChange("proveedor_nombre", "");
    onChange("proveedor_cif", "");
    onChange("proveedor_direccion", "");
    onChange("proveedor_telefono", "");
    onChange("proveedor_email", "");
  };

  const selectedProveedor = proveedores.find(p => p.id === selectedProveedorId) || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast.success(`Presupuesto "${file.name}" importado`);
    }
  };

  const analyzeDocument = async () => {
    if (!selectedFile) {
      toast.error("Primero importa un presupuesto");
      return;
    }

    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const { data: result, error } = await supabase.functions.invoke("analyze-presupuesto", {
        body: { imageBase64: base64, mimeType: selectedFile.type },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const fieldMap: Record<string, string> = {
        proveedor_nombre: "proveedor_nombre",
        proveedor_cif: "proveedor_cif",
        proveedor_direccion: "proveedor_direccion",
        proveedor_telefono: "proveedor_telefono",
        proveedor_email: "proveedor_email",
        presupuesto_descripcion: "presupuesto_descripcion",
        presupuesto_importe: "presupuesto_importe",
        presupuesto_iva_porcentaje: "presupuesto_iva_porcentaje",
        presupuesto_iva_cuota: "presupuesto_iva_cuota",
        presupuesto_total: "presupuesto_total",
        presupuesto_fecha: "presupuesto_fecha",
        presupuesto_validez: "presupuesto_validez",
        presupuesto_observaciones: "presupuesto_observaciones",
      };

      let filled = 0;
      for (const [key, field] of Object.entries(fieldMap)) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== "") {
          onChange(field, result[key]);
          filled++;
        }
      }

      // After OCR, try to match extracted proveedor to existing
      if (result.proveedor_cif || result.proveedor_nombre) {
        const matchByCif = result.proveedor_cif
          ? proveedores.find(p => p.cif && p.cif.trim().toUpperCase() === result.proveedor_cif.trim().toUpperCase())
          : null;
        const matchByName = !matchByCif && result.proveedor_nombre
          ? proveedores.filter(p => p.nombre.trim().toLowerCase() === result.proveedor_nombre.trim().toLowerCase())
          : [];

        if (matchByCif) {
          handleSelectProveedor(matchByCif);
          toast.success(`Proveedor reconocido: ${matchByCif.nombre}`);
        } else if (matchByName.length === 1) {
          handleSelectProveedor(matchByName[0]);
          toast.success(`Proveedor reconocido: ${matchByName[0].nombre}`);
        } else {
          setMode("new");
        }
      }

      toast.success(`Presupuesto analizado: ${filled} campos autocompletados`);
    } catch (err: any) {
      console.error("Error analyzing:", err);
      toast.error(err.message || "Error al analizar el presupuesto");
    } finally {
      setAnalyzing(false);
    }
  };

  const activeProveedores = proveedores.filter(p => p.activo);

  return (
    <SectionCard title="Proveedor y Presupuesto" icon={Wrench}>
      {/* Upload & analyze buttons */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
          />
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer">
            <Upload size={13} /> Importar presupuesto
          </span>
        </label>
        {selectedFile && (
          <span className="text-xs text-muted-foreground self-center truncate max-w-[200px]">
            📄 {selectedFile.name}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={analyzeDocument}
          disabled={analyzing || !selectedFile}
        >
          {analyzing ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
          {analyzing ? "Analizando..." : "Analizar presupuesto"}
        </Button>
      </div>

      {/* Proveedor selector */}
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Proveedor</p>

      {activeProveedores.length > 0 && (
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="justify-between text-xs h-9 min-w-[220px]"
              >
                {selectedProveedor ? (
                  <span className="flex items-center gap-1.5 truncate">
                    {selectedProveedor.es_habitual && <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                    {selectedProveedor.nombre}
                    {selectedProveedor.especialidad && (
                      <Badge variant="outline" className="text-[9px] ml-1">{selectedProveedor.especialidad}</Badge>
                    )}
                  </span>
                ) : (
                  "Seleccionar proveedor existente..."
                )}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar proveedor..." className="text-xs" />
                <CommandList>
                  <CommandEmpty className="text-xs p-3 text-muted-foreground">No se encontraron proveedores</CommandEmpty>
                  <CommandGroup>
                    {/* Habituales first */}
                    {activeProveedores
                      .sort((a, b) => (b.es_habitual ? 1 : 0) - (a.es_habitual ? 1 : 0) || a.nombre.localeCompare(b.nombre))
                      .map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.nombre} ${p.cif || ""} ${p.especialidad || ""}`}
                          onSelect={() => handleSelectProveedor(p)}
                          className="text-xs"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedProveedorId === p.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex items-center gap-1.5 truncate flex-1">
                            {p.es_habitual && <Star size={11} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                            <span className="truncate">{p.nombre}</span>
                            {p.especialidad && <Badge variant="outline" className="text-[9px]">{p.especialidad}</Badge>}
                            {p.cif && <span className="text-muted-foreground text-[10px]">{p.cif}</span>}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedProveedor && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={handleClearProveedor}>
              <Plus size={12} className="mr-1" /> Nuevo
            </Button>
          )}

          {!selectedProveedor && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={() => setMode("new")}>
              <Plus size={12} className="mr-1" /> Crear nuevo
            </Button>
          )}
        </div>
      )}

      {/* Proveedor fields — editable if new, read-only summary if selected */}
      {selectedProveedor && mode === "select" ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Empresa:</span> {selectedProveedor.nombre}</div>
            {selectedProveedor.cif && <div><span className="text-muted-foreground">CIF:</span> {selectedProveedor.cif}</div>}
            {selectedProveedor.telefono && <div><span className="text-muted-foreground">Tel:</span> {selectedProveedor.telefono}</div>}
            {selectedProveedor.email && <div><span className="text-muted-foreground">Email:</span> {selectedProveedor.email}</div>}
            {selectedProveedor.direccion && <div className="col-span-2"><span className="text-muted-foreground">Dir:</span> {selectedProveedor.direccion}</div>}
            {selectedProveedor.especialidad && <div><span className="text-muted-foreground">Especialidad:</span> {selectedProveedor.especialidad}</div>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div>
            <FormRow label="Empresa">
              <Input value={data.proveedor_nombre || ""} onChange={e => onChange("proveedor_nombre", e.target.value)} placeholder="Nombre o razón social" />
            </FormRow>
            <FormRow label="CIF / NIF">
              <Input value={data.proveedor_cif || ""} onChange={e => onChange("proveedor_cif", e.target.value)} placeholder="B12345678" className="max-w-[180px]" />
            </FormRow>
            <FormRow label="Dirección">
              <Input value={data.proveedor_direccion || ""} onChange={e => onChange("proveedor_direccion", e.target.value)} placeholder="Dirección del proveedor" />
            </FormRow>
          </div>
          <div>
            <FormRow label="Teléfono">
              <Input value={data.proveedor_telefono || ""} onChange={e => onChange("proveedor_telefono", e.target.value)} placeholder="Teléfono" className="max-w-[180px]" />
            </FormRow>
            <FormRow label="Email">
              <Input type="email" value={data.proveedor_email || ""} onChange={e => onChange("proveedor_email", e.target.value)} placeholder="email@proveedor.com" />
            </FormRow>
          </div>
        </div>
      )}

      {/* Datos del presupuesto */}
      <p className="text-xs font-semibold text-muted-foreground mt-5 mb-2 uppercase tracking-wider">Datos del presupuesto</p>
      <FormRow label="Descripción trabajos">
        <Textarea
          value={data.presupuesto_descripcion || ""}
          onChange={e => onChange("presupuesto_descripcion", e.target.value)}
          placeholder="Descripción de los trabajos o servicios presupuestados"
          className="min-h-[60px]"
        />
      </FormRow>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
        <div>
          <label className="text-xs text-muted-foreground">Base imponible</label>
          <Input type="number" value={data.presupuesto_importe ?? ""} onChange={e => onChange("presupuesto_importe", e.target.value ? Number(e.target.value) : null)} placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">IVA %</label>
          <Input type="number" value={data.presupuesto_iva_porcentaje ?? ""} onChange={e => onChange("presupuesto_iva_porcentaje", e.target.value ? Number(e.target.value) : null)} placeholder="21" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cuota IVA</label>
          <Input type="number" value={data.presupuesto_iva_cuota ?? ""} onChange={e => onChange("presupuesto_iva_cuota", e.target.value ? Number(e.target.value) : null)} placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Total</label>
          <Input type="number" value={data.presupuesto_total ?? ""} onChange={e => onChange("presupuesto_total", e.target.value ? Number(e.target.value) : null)} placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Fecha</label>
          <Input type="date" value={data.presupuesto_fecha || ""} onChange={e => onChange("presupuesto_fecha", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Validez</label>
          <Input value={data.presupuesto_validez || ""} onChange={e => onChange("presupuesto_validez", e.target.value)} placeholder="30 días" />
        </div>
      </div>
      <div className="mt-3">
        <FormRow label="Observaciones">
          <Textarea
            value={data.presupuesto_observaciones || ""}
            onChange={e => onChange("presupuesto_observaciones", e.target.value)}
            placeholder="Condiciones, notas adicionales..."
            className="min-h-[50px]"
          />
        </FormRow>
      </div>
    </SectionCard>
  );
};

export default ProveedorSection;
