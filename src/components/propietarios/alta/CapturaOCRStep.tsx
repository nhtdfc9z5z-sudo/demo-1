import { useState } from "react";
import { FileText, Loader2, Sparkles, Upload, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { analizarDocumento } from "@/lib/ocr/analizarDocumento";
import type { AnalizarDocumentoResult } from "@/lib/ocr/types";
import TrasvaseIntencionBanner from "./TrasvaseIntencionBanner";

interface Props {
  onComplete: (result: AnalizarDocumentoResult, files: File[]) => void;
  /** El usuario decide saltar OCR y continuar manualmente. */
  onSkip: () => void;
  /** Archivos pre-cargados (p.ej. capturados desde el picker inicial). */
  initialFiles?: File[];
}

/**
 * Paso 0 (solo intención = "pdf"): captura de uno o varios archivos del
 * contrato (PDF / fotos), análisis OCR vía edge function `analyze-contrato`
 * y fusión con `analizarDocumento(File[])`. El usuario revisa los datos
 * en los pasos siguientes; aquí solo decide qué subir.
 */
export default function CapturaOCRStep({ onComplete, onSkip, initialFiles }: Props) {
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalizarDocumentoResult | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
    setResult(null);
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || analyzing) return;
    setAnalyzing(true);
    try {
      const r = await analizarDocumento(files);
      setResult(r);
      if (r.fusionado) {
        // Damos al usuario un latido visual antes de avanzar.
        setTimeout(() => onComplete(r, files), 400);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Sube el contrato</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Adjunta el PDF, fotos del papel o varias páginas. Leeremos todo y
          rellenaremos lo que podamos para que solo tengas que revisarlo.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
        <Upload className="h-4 w-4" />
        <span>Añadir PDF o fotos (puedes elegir varios)</span>
        <input
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Archivos ({files.length})</Label>
          <ul className="space-y-1.5">
            {files.map((f, idx) => {
              const per = result?.porArchivo[idx];
              return (
                <li
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{f.name}</span>
                    {per?.status === "ok" && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                    {per?.status === "error" && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {per.error || "Error"}
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAt(idx)}
                    disabled={analyzing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {result && result.okCount > 0 && result.errorCount > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-600" />
          {result.errorCount} de {result.porArchivo.length} archivos no se pudieron
          leer. Continuamos con los que sí.
        </div>
      )}

      {result && result.okCount === 0 && (
        <TrasvaseIntencionBanner
          title="No hemos podido leer ningún archivo"
          description="Puedes reintentar con otros archivos o continuar rellenando los datos a mano."
          ctaLabel="Continuar manualmente"
          onCta={onSkip}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={analyzing}
        >
          Prefiero rellenarlo a mano
        </Button>
        <Button
          type="button"
          onClick={handleAnalyze}
          disabled={files.length === 0 || analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analizar y continuar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}