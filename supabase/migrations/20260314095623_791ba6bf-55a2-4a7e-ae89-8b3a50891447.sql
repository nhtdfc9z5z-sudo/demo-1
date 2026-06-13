
CREATE OR REPLACE FUNCTION public.notify_vencimiento_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin - INTERVAL '90 days' <= now() AND NEW.fecha_fin > now() AND NEW.estado = 'vigente' THEN
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
        NEW.titulo || ' vence el ' || to_char(NEW.fecha_fin, 'DD/MM/YYYY') || '. Faltan menos de 3 meses.',
        NEW.id,
        'contrato_vencimiento'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
