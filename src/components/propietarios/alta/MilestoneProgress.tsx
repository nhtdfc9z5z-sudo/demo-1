import { Check, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Milestone {
  id: string;
  label: string;
  done: boolean;
}

interface Props {
  milestones: Milestone[];
  className?: string;
}

/**
 * Visual milestone checklist for the Alta guiada de alquiler wizard.
 * Replaces a plain progress bar with explicit, human-readable hitos.
 */
export function MilestoneProgress({ milestones, className }: Props) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4",
        className,
      )}
      aria-label="Progreso del alta"
    >
      {milestones.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 text-sm"
          aria-checked={m.done}
          role="checkbox"
        >
          <motion.span
            initial={false}
            animate={{ scale: m.done ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0 transition-colors",
              m.done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background text-muted-foreground",
            )}
          >
            {m.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
          </motion.span>
          <span
            className={cn(
              "transition-colors",
              m.done ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {m.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default MilestoneProgress;