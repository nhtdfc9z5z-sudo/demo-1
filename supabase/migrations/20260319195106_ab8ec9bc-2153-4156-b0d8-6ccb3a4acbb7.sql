-- Add proveedor_id to facturas table
ALTER TABLE public.facturas
ADD COLUMN proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- Add proveedor_id to property_gastos table
ALTER TABLE public.property_gastos
ADD COLUMN proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;