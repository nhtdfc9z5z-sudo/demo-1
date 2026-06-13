import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MensajeInteligente } from "@/lib/progresoInteligente/seleccionMensaje";

interface Props {
  mensaje: MensajeInteligente | null;
  visible: boolean;
  onAccion: () => void;
  onCerrar: () => void;
}

/**
 * Banner flotante inteligente. Aparece de forma puntual con un único
 * mensaje prioritario. Reemplaza al widget fijo "Primeros pasos".
 */
export default function ProgresoInteligenteToast({
  mensaje,
  visible,
  onAccion,
  onCerrar,
}: Props) {
  return (
    <AnimatePresence>
      {visible && mensaje && (
        <motion.div
          key={mensaje.id}
          role="status"
          aria-live="polite"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 sm:max-w-xs"
        >
          <div className="rounded-2xl border border-border bg-card shadow-lg p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
                {mensaje.titulo}
              </div>
              <p className="text-xs text-foreground leading-snug">{mensaje.descripcion}</p>
              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={onAccion}
                  className="min-h-[36px] px-3 text-xs"
                >
                  {mensaje.ctaLabel}
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="shrink-0 h-11 w-11 -mr-1 -mt-1 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}