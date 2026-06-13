import { useState, useRef } from "react";
import { X, Plus, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PropertyPhoto } from "@/hooks/useProperties";

interface PhotoGalleryProps {
  photos: PropertyPhoto[];
  onUpload: (files: File[]) => void;
  onDelete: (photo: PropertyPhoto) => void;
  uploading?: boolean;
  editable?: boolean;
}

const PhotoGallery = ({ photos, onUpload, onDelete, uploading, editable = true }: PhotoGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mainPhoto = photos[selectedIndex] ?? null;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onUpload(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
        {mainPhoto ? (
          <>
            <img
              src={mainPhoto.url}
              alt="Foto vivienda"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightboxOpen(true)}
            />
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm p-1.5 rounded-lg hover:bg-background transition"
            >
              <Maximize2 size={14} className="text-foreground" />
            </button>
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedIndex((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm p-1.5 rounded-full hover:bg-background"
                >
                  <ChevronLeft size={16} className="text-foreground" />
                </button>
                <button
                  onClick={() => setSelectedIndex((i) => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm p-1.5 rounded-full hover:bg-background"
                >
                  <ChevronRight size={16} className="text-foreground" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sin fotos
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative shrink-0 group">
            <button
              onClick={() => setSelectedIndex(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                i === selectedIndex ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </button>
            {editable && (
              <button
                onClick={() => onDelete(photo)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {editable && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition shrink-0"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus size={18} />
            )}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-none">
          {mainPhoto && (
            <div className="relative">
              <img
                src={mainPhoto.url}
                alt="Foto vivienda"
                className="w-full max-h-[80vh] object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedIndex((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 p-2 rounded-full"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setSelectedIndex((i) => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 p-2 rounded-full"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 px-3 py-1 rounded-full text-xs text-foreground">
                {selectedIndex + 1} / {photos.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoGallery;
