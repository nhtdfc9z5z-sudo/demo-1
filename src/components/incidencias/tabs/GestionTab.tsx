import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import ProveedorSection from "../ProveedorSection";
import FacturaSection from "../FacturaSection";
import CitacionesSection from "../CitacionesSection";
import type { Citacion } from "../CitacionesSection";
import type { Proveedor } from "@/hooks/useProveedores";

interface Props {
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  incidenciaId: string | null;
  citaciones: Citacion[];
  onRefreshRelated: () => void;
  citacionActions: {
    create: (id: string, d: any) => Promise<void>;
    update: (id: string, d: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  mensajeActions: {
    create: (id: string, autor: string, msg: string) => Promise<void>;
  };
  onLogPropertyMessage?: (propertyId: string, autor: string, mensaje: string, incidenciaId: string) => Promise<void>;
  proveedores?: Proveedor[];
  onSelectProveedor?: (proveedor: Proveedor | null) => void;
  selectedProveedorId?: string | null;
}

const GestionTab = ({
  data, onChange, incidenciaId, citaciones,
  onRefreshRelated, citacionActions, mensajeActions,
  onLogPropertyMessage,
  proveedores = [], onSelectProveedor, selectedProveedorId = null,
}: Props) => {
  const [showProveedor, setShowProveedor] = useState(!!data.proveedor_nombre || !!data.presupuesto_importe || !!selectedProveedorId);
  const [showFactura, setShowFactura] = useState(!!data.factura_numero || !!data.factura_total);

  return (
    <div className="space-y-6">
      {/* Añadir presupuesto - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowProveedor(!showProveedor)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Añadir presupuesto</span>
          <div className="flex items-center gap-2">
            {data.proveedor_nombre && <Badge variant="outline" className="text-[10px]">{data.proveedor_nombre}</Badge>}
            {data.presupuesto_total && <Badge variant="outline" className="text-[10px]">{Number(data.presupuesto_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</Badge>}
            {showProveedor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showProveedor && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <ProveedorSection
              data={data}
              onChange={onChange}
              proveedores={proveedores}
              onSelectProveedor={onSelectProveedor}
              selectedProveedorId={selectedProveedorId}
            />
          </div>
        )}
      </div>

      {/* Añadir factura - collapsible */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFactura(!showFactura)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <span>Añadir factura</span>
          <div className="flex items-center gap-2">
            {data.factura_numero && <Badge variant="outline" className="text-[10px]">Nº {data.factura_numero}</Badge>}
            {data.factura_total && <Badge variant="outline" className="text-[10px]">{Number(data.factura_total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</Badge>}
            {showFactura ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        {showFactura && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <FacturaSection data={data} onChange={onChange} />
          </div>
        )}
      </div>

      <CitacionesSection
        incidenciaId={incidenciaId}
        citaciones={citaciones}
        incidenciaData={data}
        onRefresh={onRefreshRelated}
        onCreate={async (citData) => {
          if (!incidenciaId) return;
          await citacionActions.create(incidenciaId, citData);
        }}
        onUpdate={citacionActions.update}
        onDelete={citacionActions.delete}
        onLogMessage={async (autor, mensaje) => {
          if (!incidenciaId) return;
          await mensajeActions.create(incidenciaId, autor, mensaje);
          if (onLogPropertyMessage && data.property_id) {
            await onLogPropertyMessage(data.property_id, autor, mensaje, incidenciaId);
          }
        }}
      />
    </div>
  );
};

export default GestionTab;
