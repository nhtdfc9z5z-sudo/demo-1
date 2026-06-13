import { useState, useMemo } from "react";
import { ScrollText, FileText, ExternalLink, Loader2, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contrato } from "@/hooks/useContratos";
import { useAltaAlquiler } from "@/components/propietarios/AltaAlquilerContext";
import {
  resolveOriginalContractDocument,
  resolveGeneratedContractDocument,
  openContractDocumentFromRef,
} from "@/lib/contractDocumentUtils";

interface Props {
  contratos: Contrato[];
  propertyId: string;
  onViewContrato?: () => void;
  onCreateContrato?: () => void;
}

const PropertyContratoBlock = ({ contratos, propertyId, onViewContrato, onCreateContrato }: Props) => {
  const [openingPdf, setOpeningPdf] = useState(false);
  const altaAlquiler = useAltaAlquiler();

  const activeContrato = useMemo(() => {
    return contratos.find(c => c.property_id === propertyId && c.estado === "vigente") || null;
  }, [contratos, propertyId]);

  const originalDoc = useMemo(() => {
    if (!activeContrato) return null;
    return resolveOriginalContractDocument(activeContrato);
  }, [activeContrato]);

  const generatedDoc = useMemo(() => {
    if (!activeContrato) return null;
    return resolveGeneratedContractDocument(activeContrato);
  }, [activeContrato]);

  const hasContract = !!activeContrato;

  if (!hasContract) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ScrollText size={20} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Sin contrato vinculado</p>
          <p className="text-xs text-muted-foreground mt-0.5">Este activo no tiene contrato de arrendamiento asociado.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button
            variant="default"
            size="sm"
            className="rounded-lg gap-1.5"
            onClick={() => altaAlquiler.open({ viviendaId: propertyId, origen: "vivienda", modoInicial: "contrato" })}
            title="Dar de alta con la vivienda preseleccionada"
          >
            <Wand2 size={14} />
            Dar de alta
          </Button>
          {onCreateContrato && (
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={onCreateContrato}>
              <Plus size={14} />
              Crear contrato
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/[0.15] flex items-center justify-center shrink-0">
          <ScrollText size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {originalDoc ? "Contrato disponible" : "Contrato generado"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeContrato.titulo}
            {activeContrato.renta_mensual ? ` · ${Number(activeContrato.renta_mensual).toLocaleString("es-ES")} €/mes` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {originalDoc && (
          <Button
            variant="default"
            size="sm"
            className="rounded-lg gap-1.5"
            disabled={openingPdf}
            onClick={async () => {
              setOpeningPdf(true);
              await openContractDocumentFromRef(originalDoc);
              setOpeningPdf(false);
            }}
          >
            {openingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Ver PDF original
          </Button>
        )}

        {generatedDoc && (
          <Button
            variant={originalDoc ? "outline" : "default"}
            size="sm"
            className="rounded-lg gap-1.5"
            onClick={async () => {
              await openContractDocumentFromRef(generatedDoc);
            }}
          >
            <ScrollText size={14} />
            Ver resumen
          </Button>
        )}

        {onViewContrato && (
          <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-muted-foreground" onClick={onViewContrato}>
            <ExternalLink size={14} />
            Ver ficha del contrato
          </Button>
        )}
      </div>
    </div>
  );
};

export default PropertyContratoBlock;
