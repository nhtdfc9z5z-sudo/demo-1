import { Sheet, SheetContent } from "@/components/ui/sheet";
import PagosHistorial from "./PagosHistorial";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Contrato } from "@/hooks/useContratos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import { resolveFechasContrato, resolveRentaEsperada } from "@/lib/rentaUtils";

interface PagosHistorialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string | null;
  properties: Property[];
  inquilinos: Inquilino[];
  contratos: Contrato[];
  pagos: PagoRenta[];
  userId: string;
  onUpdatePago: (pagoId: string, datos: { importe_pagado?: number; tipo_pago?: string; notas_acuerdo?: string | null; propietario_confirmado?: boolean }) => Promise<void>;
  onDeletePago: (pagoId: string) => Promise<void>;
  onConfirmarPago: (propertyId: string, inquilinoId: string, mes: number, anio: number, datos: any, ownerId: string) => Promise<void>;
}

/**
 * Wrapper que muestra <PagosHistorial /> dentro de un Sheet desde PropietariosPanel.
 * Evita depender de que PropertiesTabContent esté montado/visible.
 */
const PagosHistorialSheet = ({
  open,
  onOpenChange,
  propertyId,
  properties,
  inquilinos,
  contratos,
  pagos,
  userId,
  onUpdatePago,
  onDeletePago,
  onConfirmarPago,
}: PagosHistorialSheetProps) => {
  if (!propertyId) return null;

  const prop = properties.find((p) => p.id === propertyId);
  const inq = inquilinos.find((i) => i.property_id === propertyId && i.rol_inquilino !== "avalista");
  const fechas = resolveFechasContrato(propertyId, inquilinos, contratos || []);
  const contrato = (contratos || []).find(
    (c) => c.property_id === propertyId && !c.archivado && c.estado !== "finalizado",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto p-4 sm:p-6"
      >
        <PagosHistorial
          pagos={pagos.filter((p) => p.property_id === propertyId)}
          rentaMensual={resolveRentaEsperada(propertyId, inquilinos, contratos || [])}
          propertyName={prop?.nombre_interno || ""}
          propertyId={propertyId}
          inquilinoId={inq?.id}
          fechaInicio={fechas.fechaInicio}
          fechaFin={fechas.fechaFin}
          fechaInicioControl={contrato?.fecha_inicio_control || contrato?.fecha_inicio || null}
          userId={userId}
          onBack={() => onOpenChange(false)}
          onUpdatePago={onUpdatePago}
          onDeletePago={onDeletePago}
          onConfirmarPago={onConfirmarPago}
        />
      </SheetContent>
    </Sheet>
  );
};

export default PagosHistorialSheet;