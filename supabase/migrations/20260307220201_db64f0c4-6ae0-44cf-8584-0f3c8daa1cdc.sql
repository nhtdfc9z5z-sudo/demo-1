
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  mensaje text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  enlace text,
  referencia_id uuid,
  referencia_tipo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, leida) WHERE leida = false;

-- Trigger: notify owner when tenant reports payment
CREATE OR REPLACE FUNCTION public.notify_pago_notificado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inquilino_nombre text;
  v_property_nombre text;
  v_owner_id uuid;
BEGIN
  IF NEW.inquilino_notificado = true AND (OLD.inquilino_notificado IS NULL OR OLD.inquilino_notificado = false) THEN
    SELECT nombre, user_id INTO v_inquilino_nombre, v_owner_id
    FROM public.inquilinos WHERE id = NEW.inquilino_id;
    
    SELECT nombre_interno INTO v_property_nombre
    FROM public.properties WHERE id = NEW.property_id;

    INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, referencia_id, referencia_tipo)
    VALUES (
      COALESCE(v_owner_id, NEW.user_id),
      'pago',
      'Pago de renta notificado',
      COALESCE(v_inquilino_nombre, 'Inquilino') || ' ha notificado el pago de ' || 
        COALESCE(v_property_nombre, 'una propiedad') || ' (' || 
        CASE NEW.mes WHEN 1 THEN 'Ene' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Abr' WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago' WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dic' END || ' ' || NEW.anio || ')',
      NEW.id,
      'pago_renta'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_pago_notificado
  AFTER UPDATE ON public.pagos_renta
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pago_notificado();

-- Trigger: notify owner when new incidencia is created
CREATE OR REPLACE FUNCTION public.notify_nueva_incidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- If created by tenant (user_id is the property owner set by trigger)
  INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, referencia_id, referencia_tipo)
  VALUES (
    NEW.user_id,
    'incidencia',
    'Nueva incidencia #' || NEW.numero_incidencia,
    COALESCE(NEW.concepto, 'Sin concepto') || ' - ' || COALESCE(NEW.direccion, 'Sin dirección'),
    NEW.id,
    'incidencia'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_nueva_incidencia
  AFTER INSERT ON public.incidencias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nueva_incidencia();

-- Trigger: notify owner 30 days before contract expires
CREATE OR REPLACE FUNCTION public.notify_vencimiento_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin - INTERVAL '30 days' <= now() AND NEW.fecha_fin > now() AND NEW.estado = 'vigente' THEN
    -- Check if notification already exists for this contract
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE referencia_id = NEW.id AND referencia_tipo = 'contrato_vencimiento'
    ) THEN
      INSERT INTO public.notifications (user_id, tipo, titulo, mensaje, referencia_id, referencia_tipo)
      VALUES (
        NEW.user_id,
        'contrato',
        'Contrato próximo a vencer',
        NEW.titulo || ' vence el ' || to_char(NEW.fecha_fin, 'DD/MM/YYYY'),
        NEW.id,
        'contrato_vencimiento'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_vencimiento_contrato
  AFTER INSERT OR UPDATE ON public.contratos_arrendamiento
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vencimiento_contrato();
