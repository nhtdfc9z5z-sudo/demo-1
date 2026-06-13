import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, X } from "lucide-react";
import SectionCard from "./SectionCard";
import type { IncidenciaEvidencia } from "@/hooks/useIncidencias";
import { resolveStorageUrl, inferStoragePathFromUrl } from "@/lib/storage/secureStorage";

interface Props {
  incidenciaId: string | null;
  evidencias: IncidenciaEvidencia[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (ev: IncidenciaEvidencia) => Promise<void>;
}

const EvidenciasSection = ({ incidenciaId, evidencias, onUpload, onDelete }: Props) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        evidencias.map(async (ev) => {
          let path = ev.storage_path;
          if (!path && ev.url) {
            const inferred = inferStoragePathFromUrl(ev.url);
            if (inferred?.bucket === "incidencia-archivos") path = inferred.path;
          }
          if (!path) {
            console.warn("[EvidenciasSection] legacy evidencia sin storage_path", ev.id);
            return [ev.id, ev.url || null] as const;
          }
          const url = await resolveStorageUrl("incidencia-archivos", path);
          return [ev.id, url ?? ev.url ?? null] as const;
        }),
      );
      if (cancelled) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) next[id] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [evidencias]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !incidenciaId) return;
    for (const file of Array.from(files)) {
      await onUpload(file);
    }
  }, [incidenciaId, onUpload]);

  return (
    <SectionCard title="Evidencias" icon={Camera}>
      {!incidenciaId ? (
        <p className="text-sm text-muted-foreground">Guarda la incidencia primero para subir evidencias.</p>
      ) : (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Arrastra fotos aquí o haz clic para seleccionar</p>
            <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>

          {evidencias.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
              {evidencias.map(ev => {
                const resolved = signedUrls[ev.id];
                return (
                  <div key={ev.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                    {resolved === undefined ? (
                      <div className="w-full h-full animate-pulse bg-muted" />
                    ) : resolved ? (
                      <img src={resolved} alt={ev.nombre_archivo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
                        No disponible
                      </div>
                    )}
                    <button
                      onClick={() => onDelete(ev)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
};

export default EvidenciasSection;
