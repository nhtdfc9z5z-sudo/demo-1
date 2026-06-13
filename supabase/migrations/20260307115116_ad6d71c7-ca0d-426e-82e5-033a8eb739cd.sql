CREATE TABLE public.inquilinos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  dni TEXT,
  telefono TEXT,
  email TEXT,
  fecha_entrada DATE,
  fecha_salida DATE,
  renta_mensual NUMERIC,
  fianza NUMERIC,
  deposito_garantia NUMERIC,
  estado TEXT DEFAULT 'activo',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inquilinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenants" ON public.inquilinos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tenants" ON public.inquilinos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tenants" ON public.inquilinos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tenants" ON public.inquilinos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_inquilinos_updated_at BEFORE UPDATE ON public.inquilinos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();