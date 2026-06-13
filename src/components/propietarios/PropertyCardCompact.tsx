import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Clock, Home, BedDouble, Car, Archive, Briefcase, Store, Mountain, Building2, ScrollText, FileText, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import type { Contrato } from "@/hooks/useContratos";
import type { Incidencia } from "@/hooks/useIncidencias";
import { resolveRentaEsperada } from "@/lib/rentaUtils";
import { openContractDocumentFromRef, resolveOriginalContractDocument, resolveGeneratedContractDocument } from "@/lib/contractDocumentUtils";

const tipoConfig: Record<string, { icon: typeof Home }> = {
  vivienda: { icon: Home },
  habitacion: { icon: BedDouble },
  garaje: { icon: Car },
  trastero: { icon: Archive },
  oficina: { icon: Briefcase },
  local_nave: { icon: Store },
  terreno: { icon: Mountain },
  edificio: { icon: Building2 },
};

interface Props {
  property: Property;
  inquilinos: Inquilino[];
  incidencias: Incidencia[];
  allPagos: PagoRenta[];
  contratos?: Contrato[];
  onClick: () => void;
  onMarcarCobrado?: (propertyId: string, inquilinoId: string) => void;
  onViewContrato?: (propertyId: string) => void;
  isSelected?: boolean;
}

type CardStatus = "pagado" | "pendiente" | "incidencia" | "libre";

const PropertyCardCompact = ({ property, inquilinos, incidencias, allPagos, contratos, onClick, onMarcarCobrado, onViewContrato, isSelected }: Props) => {
  const navigate = useNavigate();
  const [openingDoc, setOpeningDoc] = useState(false);
  const propertyInquilinos = inquilinos.filter(i => i.property_id === property.id && i.rol_inquilino !== "avalista");
  const hasRealTenants = propertyInquilinos.length > 0;

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const rentaDisplay = useMemo(() => resolveRentaEsperada(property.id, inquilinos, contratos || []) || 0, [property.id, inquilinos, contratos]);

  const activeContrato = useMemo(() => {
    if (!contratos) return null;
    return contratos.find(c => c.property_id === property.id && c.estado === "vigente") || null;
  }, [contratos, property.id]);

  const originalDocument = useMemo(() => {
    if (!activeContrato) return null;
    return resolveOriginalContractDocument(activeContrato);
  }, [activeContrato]);

  const generatedDocument = useMemo(() => {
    if (!activeContrato) return null;
    return resolveGeneratedContractDocument(activeContrato);
  }, [activeContrato]);

  const cardStatus = useMemo((): CardStatus => {
    if (!hasRealTenants) return "libre";
    const openInc = incidencias.filter(i => i.property_id === property.id && i.estado !== "Cerrada");
    const pagoMes = allPagos.find(p => p.property_id === property.id && p.mes === mesActual && p.anio === anioActual);
    const isPaid = pagoMes?.propietario_confirmado === true;
    if (openInc.length > 0 && !isPaid) return "incidencia";
    if (isPaid) return "pagado";
    return "pendiente";
  }, [hasRealTenants, incidencias, allPagos, property.id, mesActual, anioActual]);

  const primaryTenant = useMemo(() => {
    if (propertyInquilinos.length === 0) return null;
    // Prefer (in order):
    //  1) Titular declared in the active contract (contrato.inquilino_id).
    //  2) Inquilino con rol_inquilino === "inquilino" (titular principal por defecto).
    //  3) Primer inquilino que NO sea cotitular ni avalista.
    //  4) Como último recurso, el primero de la lista.
    const titularId = activeContrato?.inquilino_id ?? null;
    const titular =
      (titularId && propertyInquilinos.find(i => i.id === titularId)) ||
      propertyInquilinos.find(i => (i.rol_inquilino || "").toLowerCase() === "inquilino") ||
      propertyInquilinos.find(i => {
        const rol = (i.rol_inquilino || "").toLowerCase();
        return rol !== "cotitular" && rol !== "avalista";
      }) ||
      propertyInquilinos[0];
    const extra = propertyInquilinos.length > 1 ? ` +${propertyInquilinos.length - 1}` : "";
    return titular.nombre + extra;
  }, [propertyInquilinos, activeContrato]);

  const statusDisplay = {
    pagado: {
      icon: CheckCircle2, label: "Pagado este mes", dotBg: "bg-emerald-500",
      textColor: "text-emerald-700 dark:text-emerald-400", cardBorder: "border-emerald-200 dark:border-emerald-800/50",
    },
    pendiente: {
      icon: Clock, label: "Pendiente de pago", dotBg: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400", cardBorder: "border-amber-200 dark:border-amber-800/50",
    },
    incidencia: {
      icon: AlertTriangle, label: "Incidencia abierta", dotBg: "bg-amber-500",
      textColor: "text-amber-600 dark:text-amber-400", cardBorder: "border-amber-200 dark:border-amber-800/50",
    },
    libre: {
      icon: Home, label: "Sin inquilino", dotBg: "bg-muted-foreground/40",
      textColor: "text-muted-foreground", cardBorder: "border-border/50",
    },
  };

  const sd = statusDisplay[cardStatus];
  const tipoInmueble = (property as any).tipo_inmueble || "vivienda";
  const TipoIcon = (tipoConfig[tipoInmueble] || tipoConfig.vivienda).icon;

  const handleCobrar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarcarCobrado && propertyInquilinos.length > 0) {
      onMarcarCobrado(property.id, propertyInquilinos[0].id);
    }
  };

  const handleFinanzas = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/finanzas?propertyId=${property.id}`);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const hasOriginal = !!originalDocument;
  const hasGenerated = !!generatedDocument;
  const canOpenSummary = hasGenerated || !!onViewContrato;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      className={`w-full text-left rounded-xl border transition-all duration-200 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
          : `${sd.cardBorder} bg-card shadow-sm hover:shadow-md hover:border-primary/20`
      }`}
    >
      <div className="p-4">
        {/* Row 1: Icon + Name */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/[0.15] flex items-center justify-center shrink-0">
            <TipoIcon size={20} strokeWidth={2} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground truncate leading-tight">
            {property.nombre_interno}
          </h3>
        </div>

        {/* Row 2: Status badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${sd.dotBg} shrink-0`} />
          <span className={`text-sm font-semibold ${sd.textColor}`}>{sd.label}</span>
        </div>

        {/* Row 3: Tenant + Renta */}
        {hasRealTenants && (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground mb-2">
            <span className="truncate">{primaryTenant}</span>
            {rentaDisplay > 0 && (
              <span className="font-semibold text-foreground shrink-0">
                {rentaDisplay.toLocaleString("es-ES")} €
              </span>
            )}
          </div>
        )}

        {/* Row 4: Contract — Popover with options */}
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          {activeContrato && (hasOriginal || canOpenSummary) && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary font-medium transition-colors"
                >
                  {openingDoc ? <Loader2 size={13} className="animate-spin" /> : <ScrollText size={13} />}
                  Ver contrato
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="bottom"
                className="w-auto min-w-[220px] p-1"
                onClick={(e) => e.stopPropagation()}
              >
                {hasOriginal && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setOpeningDoc(true);
                      await openContractDocumentFromRef(originalDocument);
                      setOpeningDoc(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <FileText size={13} />
                    Ver PDF
                  </button>
                )}

                {canOpenSummary && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (hasGenerated) {
                        setOpeningDoc(true);
                        await openContractDocumentFromRef(generatedDocument);
                        setOpeningDoc(false);
                        return;
                      }

                      onViewContrato?.(property.id);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <ScrollText size={13} />
                    Ver resumen del contrato
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}
          <button
            onClick={handleFinanzas}
            className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary font-medium transition-colors"
            aria-label="Ver finanzas del activo"
          >
            <Wallet size={13} />
            Finanzas
          </button>
        </div>
      </div>

      {/* Action bar: "Marcar como cobrado" */}
      {cardStatus === "pendiente" && onMarcarCobrado && (
        <div className="border-t border-border/40 px-4 py-2.5">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs font-semibold gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
            onClick={handleCobrar}
          >
            <CheckCircle2 size={14} />
            Marcar como cobrado
          </Button>
        </div>
      )}
    </div>
  );
};

export default PropertyCardCompact;
