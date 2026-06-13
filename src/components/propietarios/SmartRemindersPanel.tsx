import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Clock, FileText,
  TrendingUp, Wrench, ChevronRight, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PropertyHealth, Reminder, ReminderType } from "@/hooks/useSmartReminders";

interface Props {
  propertyHealths: PropertyHealth[];
  totalReminders: number;
  onNavigateProperty: (propertyId: string) => void;
  onNavigateIncidencias: (propertyId: string) => void;
  onIPCUpdate?: (contratoId: string, propertyId: string) => void;
}

const typeConfig: Record<ReminderType, { icon: typeof Clock; color: string; bg: string }> = {
  pago_pendiente: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50/80 border-amber-200/70" },
  ipc: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50/80 border-blue-200/70" },
  contrato_vence: { icon: FileText, color: "text-purple-600", bg: "bg-purple-50/80 border-purple-200/70" },
  incidencia_abierta: { icon: Wrench, color: "text-rose-600", bg: "bg-rose-50/80 border-rose-200/70" },
};

const statusDot: Record<string, string> = {
  ok: "bg-emerald-500",
  attention: "bg-amber-500",
  urgent: "bg-red-500",
};

export default function SmartRemindersPanel({
  propertyHealths,
  totalReminders,
  onNavigateProperty,
  onNavigateIncidencias,
  onIPCUpdate,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (propertyHealths.length === 0) return null;

  const urgentCount = propertyHealths.filter((h) => h.status === "urgent").length;
  const attentionCount = propertyHealths.filter((h) => h.status === "attention").length;
  const okCount = propertyHealths.filter((h) => h.status === "ok").length;

  // All ok — compact message
  if (totalReminders === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <p className="text-sm text-emerald-800 font-medium">
          Todo en orden — no tienes nada pendiente.
        </p>
      </div>
    );
  }

  // Collect all reminders with property context
  const allReminders = propertyHealths.flatMap((h) =>
    h.reminders.map((r) => ({ ...r, propertyName: h.property.nombre_interno, status: h.status }))
  );

  // Show max 3 collapsed, all expanded
  const visibleReminders = expanded ? allReminders : allReminders.slice(0, 3);
  const hasMore = allReminders.length > 3;

  const handleAction = (reminder: Reminder) => {
    if (reminder.type === "ipc" && reminder.contratoId && onIPCUpdate) {
      onIPCUpdate(reminder.contratoId, reminder.propertyId);
    } else if (reminder.type === "incidencia_abierta") {
      onNavigateIncidencias(reminder.propertyId);
    } else {
      onNavigateProperty(reminder.propertyId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Compact header with counts */}
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold text-foreground">Pendiente de revisión</h3>
        <div className="flex items-center gap-2 text-xs">
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {urgentCount}
            </span>
          )}
          {attentionCount > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {attentionCount}
            </span>
          )}
          {okCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {okCount}
            </span>
          )}
        </div>
      </div>

      {/* Reminder list */}
      <div className="space-y-1.5">
        <AnimatePresence>
          {visibleReminders.map((r) => {
            const config = typeConfig[r.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${config.bg} cursor-pointer hover:shadow-sm transition-all`}
                onClick={() => handleAction(r)}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                <span className="text-xs font-medium text-muted-foreground shrink-0 max-w-[100px] truncate">
                  {(r as any).propertyName}
                </span>
                <p className="text-sm text-foreground flex-1 min-w-0 truncate">{r.title}</p>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Ver menos" : `Ver ${allReminders.length - 3} más`}
        </button>
      )}
    </motion.div>
  );
}
