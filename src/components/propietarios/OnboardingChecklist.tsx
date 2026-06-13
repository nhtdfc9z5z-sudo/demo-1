import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissOnboarding,
  type OnboardingProgress,
  type OnboardingStepId,
} from "@/hooks/useOnboardingProgress";

interface Props {
  progress: OnboardingProgress;
  onStepAction: (step: OnboardingStepId) => void;
}

/**
 * Sprint 4.0 — Checklist de puesta en marcha visible al inicio de Patrimonio.
 * Autocolapsa cuando los 5 pasos están hechos; permite descartar manualmente.
 */
export default function OnboardingChecklist({ progress, onStepAction }: Props) {
  const { steps, completed, total, allDone, dismissed } = progress;
  const [collapsed, setCollapsed] = useState(allDone);
  const [hidden, setHidden] = useState(dismissed);

  if (hidden) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-sm"
      aria-label="Checklist de puesta en marcha"
    >
      <div className="flex items-start gap-3 px-4 sm:px-5 py-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles size={20} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {allDone ? "¡Onboarding completo!" : "Primeros pasos en CapitalRent"}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="h-9 w-9 rounded-lg hover:bg-muted/60 text-muted-foreground flex items-center justify-center"
                aria-label={collapsed ? "Expandir checklist" : "Colapsar checklist"}
              >
                {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              {allDone && (
                <button
                  onClick={() => {
                    dismissOnboarding();
                    setHidden(true);
                  }}
                  className="h-9 w-9 rounded-lg hover:bg-muted/60 text-muted-foreground flex items-center justify-center"
                  aria-label="Ocultar checklist"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completed} de {total} completados · {pct}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border/60"
          >
            {steps.map((s, idx) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${
                  idx < steps.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    s.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {s.done ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-semibold">{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      s.done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.hint}</p>
                </div>
                {!s.done && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStepAction(s.id)}
                    className="rounded-lg h-9 px-3 text-xs"
                  >
                    Hacerlo
                  </Button>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.section>
  );
}