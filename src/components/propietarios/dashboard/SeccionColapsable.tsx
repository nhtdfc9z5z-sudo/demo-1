import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: { label: string; tone?: "warn" | "info" | "ok" } | null;
  children: ReactNode;
}

/**
 * Sección colapsable visual. Los hijos quedan SIEMPRE montados (solo
 * se oculta visualmente el contenido) para no romper efectos internos
 * de los componentes hijos (CentroSaludPatrimonio, SmartRemindersPanel,
 * TareasPendientesPanel, etc.).
 */
export default function SeccionColapsable({ title, subtitle, icon, defaultOpen = false, badge, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const toneCls =
    badge?.tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : badge?.tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-primary/10 text-primary border-primary/15";

  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary/40 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm md:text-base font-semibold text-foreground tracking-tight truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneCls}`}>
              {badge.label}
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-muted-foreground" />
          </motion.span>
        </div>
      </button>

      {/* Children stay mounted — only visually hidden when collapsed */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 p-4 md:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Off-screen mount when collapsed to preserve effects */}
      {!open && (
        <div aria-hidden className="sr-only" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
          {children}
        </div>
      )}
    </section>
  );
}
