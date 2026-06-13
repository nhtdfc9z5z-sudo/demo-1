import { useState, useRef } from "react";
import { Camera, Upload, Plus, Trash2, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface InventarioItemPhoto {
  file: File;
  preview: string;
}

export interface InventarioItem {
  nombre: string;
  marca: string;
  caracteristicas: string;
  fotos: InventarioItemPhoto[];
}

interface InventarioEditorProps {
  items: InventarioItem[];
  onChange: (items: InventarioItem[]) => void;
}

const InventarioEditor = ({ items, onChange }: InventarioEditorProps) => {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const addItem = () =>
    onChange([...items, { nombre: "", marca: "", caracteristicas: "", fotos: [] }]);

  const removeItem = (idx: number) => {
    // Revoke object URLs
    items[idx].fotos.forEach((f) => URL.revokeObjectURL(f.preview));
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, field: "nombre" | "marca" | "caracteristicas", value: string) =>
    onChange(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const addPhotos = (idx: number, files: FileList) => {
    const newPhotos: InventarioItemPhoto[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    onChange(
      items.map((item, i) =>
        i === idx ? { ...item, fotos: [...item.fotos, ...newPhotos] } : item
      )
    );
  };

  const removePhoto = (itemIdx: number, photoIdx: number) => {
    URL.revokeObjectURL(items[itemIdx].fotos[photoIdx].preview);
    onChange(
      items.map((item, i) =>
        i === itemIdx
          ? { ...item, fotos: item.fotos.filter((_, pi) => pi !== photoIdx) }
          : item
      )
    );
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">
          Añade los enseres que se incluyen con el activo
        </p>
      )}

      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
        >
          {/* Fields row */}
          <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 items-start">
            <div>
              <Label className="text-[10px] text-muted-foreground">Enser *</Label>
              <Input
                value={item.nombre}
                onChange={(e) => updateField(idx, "nombre", e.target.value)}
                placeholder="Ej: Lavadora"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Marca / Modelo</Label>
              <Input
                value={item.marca}
                onChange={(e) => updateField(idx, "marca", e.target.value)}
                placeholder="Ej: Bosch Serie 6"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Características</Label>
              <Input
                value={item.caracteristicas}
                onChange={(e) => updateField(idx, "caracteristicas", e.target.value)}
                placeholder="Ej: 8kg, estado bueno"
                className="h-7 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 mt-4 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(idx)}
            >
              <Trash2 size={12} />
            </Button>
          </div>

          {/* Photo thumbnails */}
          {item.fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.fotos.map((foto, photoIdx) => (
                <div
                  key={photoIdx}
                  className="relative w-16 h-16 rounded-md overflow-hidden border border-border group"
                >
                  <img
                    src={foto.preview}
                    alt={`${item.nombre} foto ${photoIdx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx, photoIdx)}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Photo action buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[11px] gap-1 h-7"
              onClick={() => fileInputRefs.current[idx]?.click()}
            >
              <Upload size={11} /> Subir foto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[11px] gap-1 h-7"
              onClick={() => cameraInputRefs.current[idx]?.click()}
            >
              <Camera size={11} /> Cámara
            </Button>
            <span className="text-[10px] text-muted-foreground self-center ml-1">
              {item.fotos.length > 0
                ? `${item.fotos.length} foto${item.fotos.length > 1 ? "s" : ""}`
                : "Sin fotos"}
            </span>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={(el) => { fileInputRefs.current[idx] = el; }}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addPhotos(idx, e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={(el) => { cameraInputRefs.current[idx] = el; }}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addPhotos(idx, e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs gap-1"
        onClick={addItem}
      >
        <Plus size={12} /> Añadir enser
      </Button>
    </div>
  );
};

export default InventarioEditor;
