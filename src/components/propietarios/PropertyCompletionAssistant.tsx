import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check, HelpCircle, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextField, NumberField, SelectField, SwitchField } from "./FormFields";
import type { Property } from "@/hooks/useProperties";

interface CompletionGroup {
  id: string;
  label: string;
  emoji: string;
  fields: CompletionField[];
  helpText?: string;
}

interface CompletionField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "switch";
  placeholder?: string;
  suffix?: string;
  options?: { value: string; label: string }[];
  helpTip?: string;
}

const TIPOS_VIVIENDA = [
  { value: "piso", label: "Piso" }, { value: "casa", label: "Casa" },
  { value: "estudio", label: "Estudio" }, { value: "atico", label: "Ático" },
  { value: "duplex", label: "Dúplex" }, { value: "chalet", label: "Chalet" },
  { value: "adosado", label: "Adosado" }, { value: "local", label: "Local" },
];

const COMPLETION_GROUPS: CompletionGroup[] = [
  {
    id: "ubicacion",
    label: "Ubicación",
    emoji: "📍",
    helpText: "Estos datos los encuentras en tu escritura, contrato de compraventa o en el recibo del IBI.",
    fields: [
      { key: "direccion_completa", label: "Calle y número", type: "text", placeholder: "Calle Mayor 10" },
      { key: "codigo_postal", label: "Código postal", type: "text", placeholder: "28001" },
      { key: "ciudad", label: "Ciudad", type: "text", placeholder: "Madrid" },
      { key: "provincia", label: "Provincia", type: "text", placeholder: "Madrid" },
      { key: "planta", label: "Planta", type: "text", placeholder: "3º" },
      { key: "puerta", label: "Puerta", type: "text", placeholder: "A" },
    ],
  },
  {
    id: "caracteristicas",
    label: "Características",
    emoji: "🏠",
    helpText: "Puedes encontrar estos datos en la ficha catastral (Sede Electrónica del Catastro) o en tu escritura.",
    fields: [
      { key: "tipo_vivienda", label: "Tipo de vivienda", type: "select", options: TIPOS_VIVIENDA },
      { key: "superficie_m2", label: "Superficie", type: "number", placeholder: "80", suffix: "m²", helpTip: "Consulta tu escritura o la ficha catastral" },
      { key: "num_habitaciones", label: "Habitaciones", type: "number", placeholder: "3" },
      { key: "num_banos", label: "Baños", type: "number", placeholder: "1" },
      { key: "referencia_catastral", label: "Ref. catastral", type: "text", placeholder: "1234567AB1234C0001XX", helpTip: "La encuentras en el recibo del IBI o en catastro.meh.es" },
      { key: "ano_construccion", label: "Año construcción", type: "number", placeholder: "1990" },
    ],
  },
  {
    id: "extras",
    label: "Extras",
    emoji: "✨",
    fields: [
      { key: "tiene_ascensor", label: "Tiene ascensor", type: "switch" },
      { key: "tiene_terraza", label: "Tiene terraza", type: "switch" },
      { key: "tiene_balcon", label: "Tiene balcón", type: "switch" },
      { key: "tiene_patio", label: "Tiene patio", type: "switch" },
    ],
  },
  {
    id: "comunidad",
    label: "Comunidad",
    emoji: "🏢",
    helpText: "Estos datos los encuentras en los recibos de comunidad o preguntando al administrador de fincas.",
    fields: [
      { key: "cuota_comunidad", label: "Cuota comunidad", type: "number", placeholder: "50", suffix: "€/mes", helpTip: "Consulta el último recibo de la comunidad" },
      { key: "nombre_presidente", label: "Presidente comunidad", type: "text", placeholder: "Nombre del presidente" },
    ],
  },
  {
    id: "impuestos",
    label: "Impuestos",
    emoji: "📋",
    helpText: "Los importes de IBI y basuras los encuentras en los recibos de tu ayuntamiento o en la sede electrónica.",
    fields: [
      { key: "ibi_importe", label: "IBI anual", type: "number", placeholder: "400", suffix: "€/año", helpTip: "Consulta el recibo del IBI de tu ayuntamiento" },
      { key: "basuras_importe", label: "Tasa basuras", type: "number", placeholder: "120", suffix: "€/año", helpTip: "Consulta el recibo de tasas municipales" },
    ],
  },
  {
    id: "valoracion",
    label: "Valoración",
    emoji: "💰",
    helpText: "El valor de compra está en tu escritura de compraventa. Los gastos incluyen notaría, registro, impuestos, etc.",
    fields: [
      { key: "valor_compra", label: "Precio de compra", type: "number", placeholder: "150000", suffix: "€" },
      { key: "ano_compra", label: "Año de compra", type: "number", placeholder: "2015" },
      { key: "gastos_compra", label: "Gastos de adquisición", type: "number", placeholder: "15000", suffix: "€", helpTip: "Notaría + registro + impuestos + gestoría" },
    ],
  },
];

interface PropertyCompletionAssistantProps {
  property: Property;
  onUpdate: (key: string, value: any) => void;
  formValues: Record<string, any>;
}

const PropertyCompletionAssistant = ({ property, onUpdate, formValues }: PropertyCompletionAssistantProps) => {
  const [open, setOpen] = useState(false);
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Calculate which groups have missing fields
  const { incompleteGroups, completionPercent, totalFields, filledFields } = useMemo(() => {
    const allFields: string[] = [];
    const incomplete: typeof COMPLETION_GROUPS = [];

    for (const group of COMPLETION_GROUPS) {
      const missing = group.fields.filter(f => {
        const val = formValues[f.key];
        if (f.type === "switch") return false; // switches are always "filled"
        return val === null || val === undefined || val === "" || val === 0;
      });
      allFields.push(...group.fields.filter(f => f.type !== "switch").map(f => f.key));
      if (missing.length > 0) incomplete.push({ ...group, fields: missing });
    }

    const total = allFields.length;
    const filled = allFields.filter(k => {
      const v = formValues[k];
      return v !== null && v !== undefined && v !== "" && v !== 0;
    }).length;

    return {
      incompleteGroups: incomplete,
      completionPercent: total > 0 ? Math.round((filled / total) * 100) : 100,
      totalFields: total,
      filledFields: filled,
    };
  }, [formValues]);

  if (completionPercent === 100 || dismissed) return null;

  const currentGroup = incompleteGroups[Math.min(currentGroupIdx, incompleteGroups.length - 1)];
  if (!currentGroup) return null;

  // Floating assistant button
  if (!open) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-primary text-primary-foreground pl-4 pr-5 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-shadow group"
      >
        <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-lg shrink-0">
          🧑‍💼
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold leading-tight">Completar ficha</p>
          <p className="text-xs opacity-80">{completionPercent}% completado · {totalFields - filledFields} datos pendientes</p>
        </div>
        <div className="ml-1">
          <Progress value={completionPercent} className="w-12 h-1.5 bg-primary-foreground/20 [&>div]:bg-primary-foreground" />
        </div>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🧑‍💼</span>
              <div>
                <p className="text-sm font-bold leading-tight">Asistente de ficha</p>
                <p className="text-xs opacity-80">Te ayudo a completar tu activo</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setDismissed(true); setOpen(false); }} className="text-primary-foreground/60 hover:text-primary-foreground/90 text-xs px-2 py-1 rounded-lg transition-colors">
                Cerrar
              </button>
              <button onClick={() => setOpen(false)} className="text-primary-foreground/60 hover:text-primary-foreground/90 p-1 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={completionPercent} className="flex-1 h-2 bg-primary-foreground/20 [&>div]:bg-primary-foreground" />
            <span className="text-xs font-bold">{completionPercent}%</span>
          </div>
        </div>

        {/* Group navigation pills */}
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-border bg-muted/30">
          {incompleteGroups.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setCurrentGroupIdx(i)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === Math.min(currentGroupIdx, incompleteGroups.length - 1)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{g.emoji}</span>
              {g.label}
              <span className="opacity-60">({g.fields.length})</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Help text */}
          {currentGroup.helpText && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-accent/50 border border-accent">
              <Info size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{currentGroup.helpText}</p>
            </div>
          )}

          {/* Fields */}
          {currentGroup.fields.map((field) => (
            <div key={field.key} className="space-y-1">
              {field.type === "text" && (
                <TextField
                  label={field.label}
                  value={formValues[field.key] ?? ""}
                  onChange={(v) => onUpdate(field.key, v)}
                  placeholder={field.placeholder}
                />
              )}
              {field.type === "number" && (
                <NumberField
                  label={field.label}
                  value={formValues[field.key] ?? null}
                  onChange={(v) => onUpdate(field.key, v)}
                  placeholder={field.placeholder}
                  suffix={field.suffix}
                />
              )}
              {field.type === "select" && field.options && (
                <SelectField
                  label={field.label}
                  value={formValues[field.key] ?? ""}
                  onChange={(v) => onUpdate(field.key, v)}
                  options={field.options}
                />
              )}
              {field.type === "switch" && (
                <SwitchField
                  label={field.label}
                  checked={!!formValues[field.key]}
                  onChange={(v) => onUpdate(field.key, v)}
                />
              )}
              {field.helpTip && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1">
                  <HelpCircle size={10} className="shrink-0" /> {field.helpTip}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer navigation */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            disabled={currentGroupIdx === 0}
            onClick={() => setCurrentGroupIdx(i => Math.max(0, i - 1))}
          >
            <ChevronLeft size={14} /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {Math.min(currentGroupIdx + 1, incompleteGroups.length)} / {incompleteGroups.length}
          </span>
          {currentGroupIdx < incompleteGroups.length - 1 ? (
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setCurrentGroupIdx(i => Math.min(incompleteGroups.length - 1, i + 1))}
            >
              Siguiente <ChevronRight size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setOpen(false)}
            >
              <Check size={14} /> Listo
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PropertyCompletionAssistant;
