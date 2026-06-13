/**
 * FichaInmuebleSheet — Contenedor visual de la ficha del activo.
 *
 * Es un wrapper de PropertyForm: aporta sheet lateral, modo expandido
 * (pantalla completa) y la cabecera con Volver / Maximize / Cerrar.
 * Toda la edición vive en PropertyForm — única fuente de verdad.
 */
import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProperties, type Property, type PropertyPhoto } from "@/hooks/useProperties";
import { useInquilinos } from "@/hooks/useInquilinos";
import { useContratos } from "@/hooks/useContratos";
import { useToast } from "@/hooks/use-toast";
import PropertyForm from "../PropertyForm";

interface Props {
  open: boolean;
  onClose: () => void;
  property: Property | null;
  onDelete?: (property: Property) => Promise<void> | void;
}

export default function FichaInmuebleSheet({ open, onClose, property, onDelete }: Props) {
  const { toast } = useToast();
  const { updateProperty, uploadPhoto, getPhotos, deletePhoto } = useProperties();
  const { inquilinos } = useInquilinos();
  const { contratos } = useContratos();

  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingClose, setPendingClose] = useState<null | "close" | "toggleExpand">(null);

  // Cargar fotos al abrir / cambiar de activo.
  useEffect(() => {
    if (!open || !property) return;
    let cancel = false;
    (async () => {
      try {
        const ps = await getPhotos(property.id);
        if (!cancel) setPhotos(ps);
      } catch {
        if (!cancel) setPhotos([]);
      }
    })();
    return () => { cancel = true; };
  }, [open, property?.id, getPhotos]);

  // Reset al cerrar.
  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setDirty(false);
      setPhotos([]);
      setPendingClose(null);
    }
  }, [open]);

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    if (!property) return;
    try {
      await updateProperty(property.id, data as Partial<Property>);
      toast({ title: "Cambios guardados", description: "La ficha se ha actualizado correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la ficha.", variant: "destructive" });
    }
  }, [property, updateProperty, toast]);

  const handleUploadPhotos = useCallback(async (files: File[]) => {
    if (!property) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadPhoto(property.id, files[i], photos.length + i);
      }
      const updated = await getPhotos(property.id);
      setPhotos(updated);
    } finally {
      setUploading(false);
    }
  }, [property, photos.length, uploadPhoto, getPhotos]);

  const handleDeletePhoto = useCallback(async (photo: PropertyPhoto) => {
    await deletePhoto(photo);
    if (property) {
      const updated = await getPhotos(property.id);
      setPhotos(updated);
    }
  }, [property, deletePhoto, getPhotos]);

  const requestClose = () => {
    if (dirty) { setPendingClose("close"); return; }
    onClose();
  };

  const requestToggleExpand = () => {
    setExpanded((v) => !v);
  };

  const filteredInquilinos = property
    ? (inquilinos || []).filter((i: any) => i.property_id === property.id)
    : [];

  if (!property) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); }}>
      <SheetContent
        side="right"
        className={`w-full overflow-y-auto transition-[max-width] duration-300 ease-out ${expanded ? "sm:max-w-full" : "sm:max-w-2xl"}`}
      >
        <motion.div
          key={expanded ? "expanded" : "compact"}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="-mx-6 -mt-6 mb-4 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={requestClose}
              className="min-h-[44px] gap-2 px-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={requestToggleExpand}
                      className="min-h-[44px] gap-2 px-3"
                      aria-label={expanded ? "Salir de pantalla completa" : "Ver en pantalla completa"}
                    >
                      {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {expanded ? "Salir de pantalla completa" : "Ver en pantalla completa"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={requestClose}
                className="min-h-[44px] min-w-[44px]"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <PropertyForm
            property={property}
            photos={photos}
            inquilinos={filteredInquilinos as any}
            contratos={contratos || []}
            onSave={handleSave}
            onUploadPhotos={handleUploadPhotos}
            onDeletePhoto={handleDeletePhoto}
            onBack={requestClose}
            uploading={uploading}
            onDirtyChange={setDirty}
            onDelete={onDelete ? async (p) => { await onDelete(p); onClose(); } : undefined}
            embedded
          />
        </motion.div>

        <AlertDialog open={pendingClose !== null} onOpenChange={(v) => { if (!v) setPendingClose(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
              <AlertDialogDescription>
                Hay cambios sin guardar en la ficha. Si sales ahora, se perderán.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setPendingClose(null); onClose(); }}
              >
                Salir sin guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
