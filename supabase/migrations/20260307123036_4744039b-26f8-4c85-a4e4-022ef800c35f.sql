
-- Create incidencias table
CREATE TABLE public.incidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  numero_incidencia integer NOT NULL DEFAULT 0,
  direccion text,
  fecha_hora_incidencia timestamptz,
  concepto text,
  prioridad integer DEFAULT 3,
  estado text DEFAULT 'Abierta',
  responsable_pago text,
  referencia_interna text,
  inquilino_nombre text,
  inquilino_telefono text,
  inquilino_email text,
  inquilino_contacto_whatsapp boolean DEFAULT false,
  inquilino_contacto_llamada boolean DEFAULT false,
  inquilino_contacto_email boolean DEFAULT false,
  inquilino_observaciones text,
  disponibilidad_parte_dia text,
  disponibilidad_dias text[],
  disponibilidad_comentarios text,
  proveedor_nombre text,
  factura_emisor_nombre text,
  factura_emisor_nif text,
  factura_receptor_nombre text,
  factura_receptor_nif text,
  factura_numero text,
  factura_fecha date,
  factura_base_imponible numeric,
  factura_iva_porcentaje numeric,
  factura_cuota_iva numeric,
  factura_total numeric,
  origen_domicilio text,
  origen_lugar text,
  origen_responsable text,
  origen_nombre_responsable text,
  origen_telefono_responsable text,
  origen_seguro_nombre text,
  origen_seguro_poliza text,
  origen_seguro_ref_siniestro text,
  origen_seguro_telefono text,
  origen_seguro_email text,
  origen_seguro_observaciones text,
  afectado_domicilio text,
  afectado_lugar text,
  afectado_responsable text,
  afectado_nombre text,
  afectado_telefono text,
  afectado_seguro_nombre text,
  afectado_seguro_poliza text,
  afectado_seguro_ref_siniestro text,
  afectado_seguro_telefono text,
  afectado_seguro_email text,
  afectado_seguro_observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-increment numero_incidencia per user
CREATE OR REPLACE FUNCTION public.set_numero_incidencia()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.numero_incidencia := (
    SELECT COALESCE(MAX(numero_incidencia), 0) + 1
    FROM public.incidencias WHERE user_id = NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_numero_incidencia
BEFORE INSERT ON public.incidencias
FOR EACH ROW EXECUTE FUNCTION public.set_numero_incidencia();

CREATE TRIGGER trg_incidencias_updated_at
BEFORE UPDATE ON public.incidencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incidencias" ON public.incidencias FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incidencias" ON public.incidencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incidencias" ON public.incidencias FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incidencias" ON public.incidencias FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Mensajes table
CREATE TABLE public.incidencia_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id uuid NOT NULL REFERENCES public.incidencias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  autor text NOT NULL,
  mensaje text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidencia_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mensajes" ON public.incidencia_mensajes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mensajes" ON public.incidencia_mensajes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mensajes" ON public.incidencia_mensajes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mensajes" ON public.incidencia_mensajes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Evidencias table
CREATE TABLE public.incidencia_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id uuid NOT NULL REFERENCES public.incidencias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nombre_archivo text NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidencia_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidencias" ON public.incidencia_evidencias FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evidencias" ON public.incidencia_evidencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own evidencias" ON public.incidencia_evidencias FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('incidencia-archivos', 'incidencia-archivos', true);

CREATE POLICY "Auth users upload incidencia files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'incidencia-archivos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users view incidencia files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'incidencia-archivos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users delete incidencia files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'incidencia-archivos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public view incidencia files" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'incidencia-archivos');
