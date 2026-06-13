import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ArrowLeft, Camera, FileText, Home, KeyRound, Pencil, UserPlus, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export type AltaPickerIntencion = "activo" | "alquiler" | "vinculacion";
export type AltaPickerModo = "pdf" | "camera" | "manual";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vinculación se resuelve fuera (no necesita paso de modo). */
  onSelectVinculacion: () => void;
  /** Modo elegido para activo/alquiler. `files` viene relleno si modo = pdf|camera. */
  onSelectModo: (intencion: "activo" | "alquiler", modo: AltaPickerModo, files?: File[]) => void;
  /**
   * Si se informa "manual", el sheet salta el paso 2: al elegir intención
   * (activo/alquiler) abre directamente el wizard correspondiente sin
   * preguntar PDF / cámara / manual de nuevo.
   */
  modoForzado?: AltaPickerModo;
}

interface IntencionCard {
  id: AltaPickerIntencion;
  icon: typeof Home;
  title: string;
  microcopy: string;
  hint: string;
}

const INTENCION_CARDS: IntencionCard[] = [
  {
    id: "activo",
    icon: Home,
    title: "Un inmueble",
    microcopy: "Vivienda, garaje, trastero, local y otros",
    hint: "Aún no está alquilado",
  },
  {
    id: "alquiler",
    icon: KeyRound,
    title: "Un inmueble ya alquilado",
    microcopy: "Inmueble + inquilino + contrato",
    hint: "Lo damos todo de alta a la vez",
  },
  {
    id: "vinculacion",
    icon: UserPlus,
    title: "Un inquilino o contrato",
    microcopy: "Sobre un inmueble que ya tienes",
    hint: "Vincula sobre algo existente",
  },
];

/**
 * AltaPickerSheet — entrada unificada del alta.
 *
 * Sustituye al par `AltaIntencionPicker` + `ModoEntradaPicker` por un
 * único Sheet con navegación interna (paso 1 → paso 2). En móvil aparece
 * como bottom sheet; en desktop como panel lateral derecho.
 *
 * Paso 1 — ¿Qué quieres dar de alta?  (3 tarjetas de intención)
 * Paso 2 — ¿Cómo quieres añadirlo?    (PDF / Cámara / Manual)
 *
 * La opción "vinculación" salta directamente al picker correspondiente
 * (no necesita modo de entrada).
 */
export default function AltaPickerSheet({
  open,
  onOpenChange,
  onSelectVinculacion,
  onSelectModo,
  modoForzado,
}: Props) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2>(1);
  const [intencion, setIntencion] = useState<"activo" | "alquiler" | null>(null);
  const [tieneCamera, setTieneCamera] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset al abrir/cerrar.
  useEffect(() => {
    if (!open) {
      setStep(1);
      setIntencion(null);
    }
  }, [open]);

  // Detectar cámara una sola vez al abrir.
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        const has = !!devices?.some((d) => d.kind === "videoinput");
        const isTouch =
          window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
        if (!cancel) setTieneCamera(has && isTouch);
      } catch {
        if (!cancel) setTieneCamera(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open]);

  const handleIntencion = (id: AltaPickerIntencion) => {
    if (id === "vinculacion") {
      onOpenChange(false);
      onSelectVinculacion();
      return;
    }
    // Si el usuario llegó con "manual" forzado, no preguntamos modo otra vez.
    if (modoForzado === "manual") {
      onOpenChange(false);
      onSelectModo(id, "manual");
      return;
    }
    setIntencion(id);
    setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleManual = () => {
    if (!intencion) return;
    onOpenChange(false);
    onSelectModo(intencion, "manual");
  };

  const handleFilesPicked = (
    e: React.ChangeEvent<HTMLInputElement>,
    modo: "pdf" | "camera",
  ) => {
    const list = e.target.files;
    if (!list || list.length === 0 || !intencion) return;
    const files = Array.from(list);
    e.target.value = "";
    onOpenChange(false);
    onSelectModo(intencion, modo, files);
  };

  const title =
    step === 1
      ? "¿Qué quieres dar de alta?"
      : intencion === "activo"
        ? "¿Cómo quieres añadir el inmueble?"
        : "¿Cómo quieres añadirlo?";

  const subtitle =
    step === 1
      ? "Elige el flujo que mejor encaja. Puedes cambiar después."
      : "Sube el documento, hazle una foto o rellénalo a mano.";

  const side = isMobile ? "bottom" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={
          isMobile
            ? "p-0 gap-0 rounded-t-2xl max-h-[90vh] overflow-y-auto"
            : "p-0 gap-0 w-full sm:max-w-xl overflow-y-auto"
        }
      >
        {/* Header fijo */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
          {step === 2 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Atrás"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <h2 className="flex-1 text-base sm:text-lg font-semibold text-foreground text-center truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-2">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {step === 1 && (
          <div className="p-4 grid grid-cols-1 gap-3 pb-6">
            {INTENCION_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleIntencion(c.id)}
                  className="group text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[88px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <Icon size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-foreground">{c.title}</div>
                      <div className="text-sm text-foreground/80">{c.microcopy}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && intencion && (
          <div className="p-4 grid grid-cols-1 gap-3 pb-6">
            {/* A. PDF/foto — destacada */}
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="group text-left rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors p-4 min-h-[100px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground shrink-0">
                  <FileText size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-foreground">Subir PDF o foto</span>
                    <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-semibold">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-0.5">
                    Contrato, escritura o nota simple. La IA rellena todo.
                  </p>
                </div>
              </div>
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFilesPicked(e, "pdf")}
            />

            {/* B. Cámara — solo si el dispositivo tiene cámara disponible */}
            {tieneCamera && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="group text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[100px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <Camera size={22} />
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground">Hacer foto ahora</div>
                  <p className="text-sm text-foreground/80 mt-0.5">
                    Usa la cámara de tu móvil. Puedes hacer varias fotos.
                  </p>
                </div>
              </div>
            </button>
            )}
            {tieneCamera && (
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleFilesPicked(e, "camera")}
              />
            )}

            {/* C. Manual */}
            <button
              type="button"
              onClick={handleManual}
              className="group text-left rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors p-4 min-h-[100px] flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <Pencil size={22} />
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground">Rellenar a mano</div>
                  <p className="text-sm text-foreground/80 mt-0.5">
                    Paso a paso, tú controlas cada campo.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        <p className="px-6 pb-5 pt-1 text-xs text-muted-foreground text-center">
          Puedes cambiar de modo en cualquier momento.
        </p>
      </SheetContent>
    </Sheet>
  );
}