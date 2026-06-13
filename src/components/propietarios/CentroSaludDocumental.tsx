import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileWarning, Clock, ShieldAlert, FileText, FileX2, AlertCircle, ArrowRight,
} from "lucide-react";
import { useDocumentos } from "@/hooks/useDocumentos";
import { useProperties } from "@/hooks/useProperties";
import { useContratos } from "@/hooks/useContratos";
import { computeDocumentSalud } from "@/lib/documentSalud";

interface Props {
  onVerDocumentos: () => void;
}

type Tone = "ok" | "warn" | "danger";

const toneStyles: Record<Tone, { ring: string; bg: string; chip: string }> = {
  ok: { ring: "border-emerald-200/60", bg: "bg-emerald-50/40", chip: "bg-emerald-100/70 text-emerald-700" },
  warn: { ring: "border-amber-200/70", bg: "bg-amber-50/50", chip: "bg-amber-100/70 text-amber-700" },
  danger: { ring: "border-red-200/70", bg: "bg-red-50/50", chip: "bg-red-100/70 text-red-700" },
};

function Card({
  icon: Icon, label, value, detail, emptyMsg, tone, onClick,
}: {
  icon: typeof FileWarning; label: string; value: number; detail: string; emptyMsg: string; tone: Tone; onClick: () => void;
}) {
  const styles = toneStyles[tone];
  const isEmpty = value === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isEmpty}
      className={`group text-left rounded-xl border bg-card p-4 transition-all ${
        isEmpty ? "border-border/60 opacity-90 cursor-default" : `${styles.ring} ${styles.bg} hover:shadow-md`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isEmpty ? "bg-muted text-muted-foreground" : styles.chip}`}>
          <Icon size={18} />
        </div>
        {!isEmpty && <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`mt-1 font-mono text-2xl font-semibold ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
        <p className={`mt-1 text-xs ${isEmpty ? "text-muted-foreground" : "text-foreground/80"}`}>{isEmpty ? emptyMsg : detail}</p>
      </div>
    </button>
  );
}

/**
 * Sprint 4.2 — Centro de salud documental.
 * Lee documentos + contratos + activos y calcula 6 señales mediante `computeDocumentSalud`.
 * Sin IA: usa fechas y categorías introducidas por el usuario.
 */
export default function CentroSaludDocumental({ onVerDocumentos }: Props) {
  const { documentos, vinculos } = useDocumentos({ limit: 500 });
  const { properties } = useProperties();
  const { contratos } = useContratos();

  const salud = useMemo(() => {
    const contratosVigentes = contratos.filter((c: any) => (c.estado || "vigente") !== "finalizado");
    return computeDocumentSalud({
      documentos,
      vinculos,
      contratos: contratosVigentes.map((c: any) => ({ id: c.id, titulo: c.titulo, estado: c.estado })),
      activos: properties.map((p) => ({ id: p.id, nombre_interno: p.nombre_interno })),
    });
  }, [documentos, vinculos, contratos, properties]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
      aria-label="Centro de salud documental"
    >
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Salud documental</h2>
          <p className="text-xs text-muted-foreground">Vencimientos, recordatorios y huecos por cubrir.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card
          icon={FileWarning}
          label="Documentos vencidos"
          value={salud.vencidos.length}
          tone={salud.vencidos.length > 0 ? "danger" : "ok"}
          detail={salud.vencidos.length === 1 ? "1 documento ya caducado" : `${salud.vencidos.length} documentos ya caducados`}
          emptyMsg="Nada caducado"
          onClick={onVerDocumentos}
        />
        <Card
          icon={Clock}
          label="Vencen en 30 días"
          value={salud.vencenPronto.length}
          tone={salud.vencenPronto.length > 0 ? "warn" : "ok"}
          detail={salud.vencenPronto.length === 1 ? "1 documento vence pronto" : `${salud.vencenPronto.length} documentos vencen pronto`}
          emptyMsg="Ninguno vence pronto"
          onClick={onVerDocumentos}
        />
        <Card
          icon={ShieldAlert}
          label="Seguros por vencer"
          value={salud.segurosPorVencer.length}
          tone={salud.segurosPorVencer.length > 0 ? "warn" : "ok"}
          detail={salud.segurosPorVencer.length === 1 ? "1 seguro próximo a vencer" : `${salud.segurosPorVencer.length} seguros próximos a vencer`}
          emptyMsg="Seguros al día"
          onClick={onVerDocumentos}
        />
        <Card
          icon={FileText}
          label="Contratos sin PDF"
          value={salud.contratosSinDocumento.length}
          tone={salud.contratosSinDocumento.length > 0 ? "warn" : "ok"}
          detail={salud.contratosSinDocumento.length === 1 ? "1 contrato sin documento adjunto" : `${salud.contratosSinDocumento.length} contratos sin documento adjunto`}
          emptyMsg={contratos.length === 0 ? "Aún no hay contratos" : "Todos los contratos tienen PDF"}
          onClick={onVerDocumentos}
        />
        <Card
          icon={FileX2}
          label="Activos sin CEE"
          value={salud.activosSinCEE.length}
          tone={salud.activosSinCEE.length > 0 ? "warn" : "ok"}
          detail={salud.activosSinCEE.length === 1 ? "1 activo sin certificado energético" : `${salud.activosSinCEE.length} activos sin certificado energético`}
          emptyMsg={properties.length === 0 ? "Aún no hay activos" : "Todos con CEE"}
          onClick={onVerDocumentos}
        />
        <Card
          icon={AlertCircle}
          label="OCR fallidos"
          value={salud.ocrFallidos.length}
          tone={salud.ocrFallidos.length > 0 ? "warn" : "ok"}
          detail={salud.ocrFallidos.length === 1 ? "1 documento con OCR fallido" : `${salud.ocrFallidos.length} documentos con OCR fallido`}
          emptyMsg="OCR sin errores"
          onClick={onVerDocumentos}
        />
      </div>
    </motion.section>
  );
}