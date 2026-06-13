import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import {
  calcularCompletitud,
  type GrupoId,
  type ResultadoCompletitud,
} from "@/lib/ficha/completitud";
import { cn } from "@/lib/utils";

interface Props {
  property: Property;
  variant?: "full" | "compact";
  className?: string;
  onClick?: () => void;
}

const GRUPO_LABEL: Record<GrupoId, string> = {
  basico: "Básico",
  caracteristicas: "Características",
  fiscal: "Fiscal",
  completo: "Completo",
};

const GRUPOS: GrupoId[] = ["basico", "caracteristicas", "fiscal", "completo"];

/**
 * Barra de progreso gamificada de la ficha del activo.
 * Reutilizable. Nunca bloquea: solo informa y celebra.
 */
export default function FichaCompletitudBar({
  property,
  variant = "full",
  className,
  onClick,
}: Props) {
  const r = calcularCompletitud(property);
  const [celebrar, setCelebrar] = useState<GrupoId | null>(null);
  const prev = useRef<ResultadoCompletitud | null>(null);

  useEffect(() => {
    if (prev.current) {
      for (const g of GRUPOS) {
        if (prev.current.grupos[g] < 100 && r.grupos[g] === 100) {
          setCelebrar(g);
          setTimeout(() => setCelebrar(null), 900);
          break;
        }
      }
    }
    prev.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.porcentaje, r.grupos.basico, r.grupos.caracteristicas, r.grupos.fiscal, r.grupos.completo]);

  const Container = onClick ? "button" : "div";

  if (variant === "compact") {
    return (
      <Container
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg border bg-card px-3 py-2.5 transition-colors",
          onClick && "hover:bg-muted/40 min-h-[44px]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate text-sm font-medium">
              Ficha del activo
            </span>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {r.porcentaje}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${r.porcentaje}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full bg-primary"
          />
        </div>
        {r.siguienteCampo && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {r.siguienteCampo}
          </p>
        )}
      </Container>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Completitud de la ficha</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{r.mensaje}</p>
        </div>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {r.porcentaje}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${r.porcentaje}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full bg-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRUPOS.map((g) => {
          const pct = r.grupos[g];
          const done = pct === 100;
          return (
            <div
              key={g}
              className={cn(
                "rounded-md border bg-background p-2 text-xs transition-colors",
                done && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{GRUPO_LABEL[g]}</span>
                <AnimatePresence>
                  {done && (
                    <motion.span
                      key={celebrar === g ? "celebrar" : "done"}
                      initial={{ scale: celebrar === g ? 0.4 : 1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 14 }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn("h-full", done ? "bg-primary" : "bg-foreground/40")}
                />
              </div>
              <div className="mt-1 font-mono tabular-nums text-muted-foreground">
                {pct}%
              </div>
            </div>
          );
        })}
      </div>

      {r.siguienteCampo && (
        <p className="text-xs text-muted-foreground">
          Siguiente: <span className="font-medium text-foreground">{r.siguienteCampo}</span>
        </p>
      )}
    </div>
  );
}