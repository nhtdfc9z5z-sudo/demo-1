import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Euro, Calendar, ExternalLink, FileText, AlertCircle } from "lucide-react";
import type { Contrato } from "@/hooks/useContratos";
import type { Inquilino } from "@/hooks/useInquilinos";
import { SecureFileLink } from "@/components/common/SecureFileLink";

interface ContratoActivoCardProps {
  inquilino: Inquilino;
  contratos: Contrato[];
}

const ContratoActivoCard = ({ inquilino, contratos }: ContratoActivoCardProps) => {
  const activeContrato = useMemo(
    () => contratos.find(c => c.inquilino_id === inquilino.id && !c.archivado && c.estado !== "finalizado"),
    [contratos, inquilino.id]
  );

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Contract signals
  const signals = useMemo(() => {
    if (!activeContrato) return [];
    const items: { label: string; color: string }[] = [];
    const now = new Date();

    // Preaviso próximo (within preaviso_meses of fecha_fin)
    if (activeContrato.fecha_fin) {
      const fin = new Date(activeContrato.fecha_fin);
      const preavisoMeses = activeContrato.preaviso_meses ?? 2;
      const preavisoDate = new Date(fin);
      preavisoDate.setMonth(preavisoDate.getMonth() - preavisoMeses);
      if (now >= preavisoDate && now < fin) {
        items.push({ label: "Preaviso próximo", color: "bg-amber-100 text-amber-800" });
      }
      // Contract expired
      if (now > fin) {
        items.push({ label: "Contrato vencido", color: "bg-red-100 text-red-800" });
      }
    }

    // IPC: if contract is >12 months old and fecha_inicio exists, hint IPC review
    if (activeContrato.fecha_inicio) {
      const inicio = new Date(activeContrato.fecha_inicio);
      const monthsActive = (now.getFullYear() - inicio.getFullYear()) * 12 + (now.getMonth() - inicio.getMonth());
      // Suggest IPC review if contract anniversary passed and it's been at least 12 months
      if (monthsActive >= 12 && monthsActive % 12 <= 1) {
        items.push({ label: "Revisión IPC", color: "bg-sky-100 text-sky-800" });
      }
    }

    return items;
  }, [activeContrato]);

  if (activeContrato) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Contrato activo</h4>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {activeContrato.estado}
              </span>
              {signals.map((s, i) => (
                <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${s.color}`}>
                  <AlertCircle size={10} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-foreground font-medium">{activeContrato.titulo}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={12} />
              <span>Inicio: {formatDate(activeContrato.fecha_inicio)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={12} />
              <span>Fin: {formatDate(activeContrato.fecha_fin)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Euro size={12} />
              <span>Renta: {activeContrato.renta_mensual != null ? `${activeContrato.renta_mensual} €/mes` : "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Euro size={12} />
              <span>Fianza: {activeContrato.fianza_importe != null ? `${activeContrato.fianza_importe} €` : "—"}</span>
            </div>
          </div>
          {(activeContrato.archivo_url || (activeContrato as any).storage_path) && (
            <SecureFileLink
              bucket="contratos"
              path={(activeContrato as any).storage_path}
              fallbackUrl={activeContrato.archivo_url}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
            >
              <ExternalLink size={12} /> Ver contrato PDF
            </SecureFileLink>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback: no active contract — show legacy data
  const renta = inquilino.renta_mensual;
  const fianza = inquilino.fianza;
  const hasLegacy = renta != null || fianza != null || inquilino.fecha_entrada;

  if (!hasLegacy) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground italic">Sin contrato vinculado. Crea uno desde la ficha de la propiedad.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-amber-600" />
          <h4 className="text-sm font-semibold text-foreground">Datos manuales</h4>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Sin contrato</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {inquilino.fecha_entrada && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>Entrada: {formatDate(inquilino.fecha_entrada)}</span>
            </div>
          )}
          {inquilino.fecha_salida && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>Salida: {formatDate(inquilino.fecha_salida)}</span>
            </div>
          )}
          {renta != null && (
            <div className="flex items-center gap-1.5">
              <Euro size={12} />
              <span>Renta: {renta} €/mes</span>
            </div>
          )}
          {fianza != null && (
            <div className="flex items-center gap-1.5">
              <Euro size={12} />
              <span>Fianza: {fianza} €</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContratoActivoCard;
