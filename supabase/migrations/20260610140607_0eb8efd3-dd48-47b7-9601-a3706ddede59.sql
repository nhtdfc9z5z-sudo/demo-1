
ALTER TABLE public.property_gastos
  ADD COLUMN IF NOT EXISTS factura_id uuid NULL REFERENCES public.facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_property_gastos_factura_id ON public.property_gastos(factura_id);

ALTER TABLE public.property_documentos
  ADD COLUMN IF NOT EXISTS gasto_id uuid NULL REFERENCES public.property_gastos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_property_documentos_gasto_id ON public.property_documentos(gasto_id);

ALTER TABLE public.property_documentos ALTER COLUMN nombre_archivo DROP NOT NULL;
ALTER TABLE public.property_documentos ALTER COLUMN url DROP NOT NULL;
