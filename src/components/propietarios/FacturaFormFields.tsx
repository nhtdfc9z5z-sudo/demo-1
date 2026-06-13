import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Property } from "@/hooks/useProperties";
import type { Proveedor } from "@/hooks/useProveedores";

export const TIPOS_GASTO = [
  { value: "reparacion", label: "Reparación / mantenimiento" },
  { value: "comunidad", label: "Comunidad" },
  { value: "ibi", label: "IBI" },
  { value: "basuras", label: "Basuras" },
  { value: "seguro", label: "Seguro" },
  { value: "intereses_hipoteca", label: "Intereses hipoteca" },
  { value: "suministros", label: "Suministros" },
  { value: "honorarios", label: "Honorarios profesionales" },
  { value: "gestion_inmobiliaria", label: "Gestión inmobiliaria" },
  { value: "otro", label: "Otros" },
];

export interface FacturaFormData {
  categoria: string;
  emisor_nombre: string;
  emisor_nif: string;
  numero_factura: string;
  fecha: string;
  fecha_devengo: string;
  fecha_pago: string;
  base_imponible: string;
  cuota_iva: string;
  total: string;
  property_id: string;
  ano_fiscal: string;
  deducible_irpf: boolean;
  forma_pago: string;
  receptor_nombre: string;
  receptor_nif: string;
  proveedor_id: string;
}

export const emptyFacturaForm: FacturaFormData = {
  categoria: "otro",
  emisor_nombre: "",
  emisor_nif: "",
  numero_factura: "",
  fecha: "",
  fecha_devengo: "",
  fecha_pago: "",
  base_imponible: "",
  cuota_iva: "",
  total: "",
  property_id: "none",
  ano_fiscal: "",
  deducible_irpf: true,
  forma_pago: "",
  receptor_nombre: "",
  receptor_nif: "",
  proveedor_id: "",
};

interface Props {
  form: FacturaFormData;
  onChange: (form: FacturaFormData) => void;
  properties: Property[];
  proveedores?: Proveedor[];
  /** Owner profile data for auto-fill */
  profileNif?: string;
  profileDireccion?: string;
  /** Pre-selected property */
  defaultPropertyId?: string | null;
}

const FacturaFormFields = ({ form, onChange, properties, proveedores = [], profileNif, profileDireccion, defaultPropertyId }: Props) => {
  const set = (key: keyof FacturaFormData, value: any) => onChange({ ...form, [key]: value });
  const [provOpen, setProvOpen] = useState(false);

  // Auto-calculate total = base + iva
  useEffect(() => {
    const base = parseFloat(form.base_imponible) || 0;
    const iva = parseFloat(form.cuota_iva) || 0;
    if (base || iva) {
      set("total", (base + iva).toFixed(2));
    }
  }, [form.base_imponible, form.cuota_iva]);

  // Auto-calculate año fiscal from fecha
  useEffect(() => {
    if (form.fecha && !form.ano_fiscal) {
      const year = new Date(form.fecha).getFullYear();
      if (year > 2000) set("ano_fiscal", String(year));
    }
  }, [form.fecha]);

  // Auto-fill receptor from profile
  useEffect(() => {
    if (profileNif && !form.receptor_nif) set("receptor_nif", profileNif);
  }, [profileNif]);

  useEffect(() => {
    if (profileDireccion && !form.receptor_nombre) set("receptor_nombre", profileDireccion);
  }, [profileDireccion]);

  const selectedProperty = properties.find(p => p.id === form.property_id && form.property_id !== "none");
  const selectedProveedor = proveedores.find(p => p.id === form.proveedor_id);

  const handleSelectProveedor = (prov: Proveedor | null) => {
    if (prov) {
      onChange({
        ...form,
        proveedor_id: prov.id,
        emisor_nombre: prov.nombre,
        emisor_nif: prov.cif || form.emisor_nif,
      });
    } else {
      onChange({ ...form, proveedor_id: "" });
    }
    setProvOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* — Información básica — */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Información básica</p>
        <div>
          <Label className="text-xs">Tipo de gasto</Label>
          <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_GASTO.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* — Datos de la factura — */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Datos de la factura</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Provider selector */}
          <div className="col-span-2">
            <Label className="text-xs">Proveedor / Empresa</Label>
            {proveedores.length > 0 ? (
              <div className="flex gap-2">
                <Popover open={provOpen} onOpenChange={setProvOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between h-9 text-sm font-normal">
                      {selectedProveedor ? selectedProveedor.nombre : form.emisor_nombre || "Seleccionar proveedor..."}
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar proveedor..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => handleSelectProveedor(null)} className="text-xs text-muted-foreground">
                            Escribir manualmente
                          </CommandItem>
                          {proveedores.filter(p => p.activo).map(p => (
                            <CommandItem key={p.id} value={`${p.nombre} ${p.cif || ""}`} onSelect={() => handleSelectProveedor(p)}>
                              <Check className={cn("mr-2 h-3.5 w-3.5", form.proveedor_id === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm">{p.nombre}</span>
                                {p.cif && <span className="text-xs text-muted-foreground ml-2">{p.cif}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Input value={form.emisor_nombre} onChange={e => set("emisor_nombre", e.target.value)} placeholder="Nombre del proveedor" className="h-9 text-sm" />
            )}
            {/* Manual override when a provider is selected */}
            {!selectedProveedor && proveedores.length > 0 && (
              <Input value={form.emisor_nombre} onChange={e => set("emisor_nombre", e.target.value)} placeholder="Nombre del proveedor" className="h-9 text-sm mt-1.5" />
            )}
          </div>
          <div>
            <Label className="text-xs">NIF / CIF del proveedor</Label>
            <Input value={form.emisor_nif} onChange={e => set("emisor_nif", e.target.value)} placeholder="B12345678" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Nº factura</Label>
            <Input value={form.numero_factura} onChange={e => set("numero_factura", e.target.value)} placeholder="Si se dispone" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Fecha de factura</Label>
            <Input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Fecha de pago</Label>
            <Input type="date" value={form.fecha_pago} onChange={e => set("fecha_pago", e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Fecha de devengo (opcional)</Label>
            <Input type="date" value={form.fecha_devengo} onChange={e => set("fecha_devengo", e.target.value)} className="h-9 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Si se informa, se usará para imputación fiscal; si no, se usará la fecha de factura.
            </p>
          </div>
        </div>
      </div>

      {/* — Importe — */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Importe</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Base imponible €</Label>
            <Input type="number" step="0.01" value={form.base_imponible} onChange={e => set("base_imponible", e.target.value)} placeholder="0.00" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">IVA €</Label>
            <Input type="number" step="0.01" value={form.cuota_iva} onChange={e => set("cuota_iva", e.target.value)} placeholder="0.00" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Importe total €</Label>
            <Input type="number" step="0.01" value={form.total} onChange={e => set("total", e.target.value)} placeholder="Auto" className="h-9 text-sm bg-muted/30" />
            <p className="text-[10px] text-muted-foreground mt-0.5">Se calcula automáticamente</p>
          </div>
        </div>
      </div>

      {/* — Relación con el inmueble — */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Relación con el inmueble</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Inmueble asociado</Label>
            <Select value={form.property_id} onValueChange={v => set("property_id", v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre_interno}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Año fiscal</Label>
            <Input type="number" value={form.ano_fiscal} onChange={e => set("ano_fiscal", e.target.value)} placeholder="Auto" className="h-9 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-0.5">Se calcula de la fecha</p>
          </div>
        </div>
      </div>

      {/* — Cliente (propietario) — */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Datos del cliente (propietario)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">DNI / NIF</Label>
            <Input value={form.receptor_nif} onChange={e => set("receptor_nif", e.target.value)} placeholder="Auto desde perfil" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Dirección</Label>
            <Input
              value={form.receptor_nombre || (selectedProperty?.direccion_completa ?? "")}
              onChange={e => set("receptor_nombre", e.target.value)}
              placeholder="Auto de la vivienda"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* — Deducible IRPF — */}
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="deducible"
          checked={form.deducible_irpf}
          onCheckedChange={(c) => set("deducible_irpf", !!c)}
        />
        <Label htmlFor="deducible" className="text-sm cursor-pointer">Deducible en IRPF</Label>
      </div>
    </div>
  );
};

export default FacturaFormFields;
