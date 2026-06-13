-- Re-backfill + consolidación: quitar índice único temporalmente para permitir merge.
DROP INDEX IF EXISTS public.pagos_renta_contrato_periodo_unique;

WITH legacy AS (
  SELECT pr.id, pr.property_id, pr.inquilino_id, pr.mes, pr.anio,
         make_date(pr.anio, pr.mes, 1) AS devengo
  FROM public.pagos_renta pr WHERE pr.contrato_id IS NULL
),
candidatos AS (
  SELECT l.id AS pago_id, c.id AS contrato_id
  FROM legacy l
  JOIN public.contrato_personas cp ON cp.inquilino_id = l.inquilino_id
  JOIN public.contratos_arrendamiento c ON c.id = cp.contrato_id
   AND c.property_id = l.property_id
   AND (c.fecha_inicio IS NULL OR c.fecha_inicio <= (l.devengo + interval '1 month - 1 day')::date)
   AND (c.fecha_fin IS NULL OR c.fecha_fin >= l.devengo)
),
unicos AS (
  SELECT pago_id, MAX(contrato_id::text)::uuid AS contrato_id
  FROM candidatos GROUP BY pago_id HAVING COUNT(DISTINCT contrato_id) = 1
)
UPDATE public.pagos_renta pr
SET contrato_id = u.contrato_id
FROM unicos u
WHERE pr.id = u.pago_id AND pr.contrato_id IS NULL;

INSERT INTO public.error_logs (user_id, event_name, severity, message, context)
SELECT pr.user_id, 'pagos_renta.legacy_sin_contrato', 'warning',
       'Pago sin contrato_id tras backfill; requiere asignación manual',
       jsonb_build_object('pago_id', pr.id, 'mes', pr.mes, 'anio', pr.anio,
                          'property_id', pr.property_id, 'inquilino_id', pr.inquilino_id)
FROM public.pagos_renta pr WHERE pr.contrato_id IS NULL;

WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
),
duplicados AS (
  SELECT pr.id, pr.user_id, pr.contrato_id, pr.mes, pr.anio, pr.inquilino_id,
         pr.importe_pagado, pr.tipo_registro, s.keep_id
  FROM public.pagos_renta pr JOIN survivors s USING (contrato_id, mes, anio)
  WHERE pr.contrato_id IS NOT NULL AND pr.id <> s.keep_id
)
INSERT INTO public.error_logs (user_id, event_name, severity, message, context)
SELECT user_id, 'pagos_renta.consolidacion_solidarios', 'info',
       'Duplicado solidario consolidado',
       jsonb_build_object('contrato_id', contrato_id, 'mes', mes, 'anio', anio,
                          'pago_id_borrado', id, 'pago_id_superviviente', keep_id,
                          'inquilino_id', inquilino_id, 'importe_pagado', importe_pagado,
                          'tipo_registro', tipo_registro)
FROM duplicados;

WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
)
UPDATE public.pagos_renta_reconciliacion rec
SET pago_id = s.keep_id
FROM public.pagos_renta pr JOIN survivors s USING (contrato_id, mes, anio)
WHERE rec.pago_id = pr.id AND pr.id <> s.keep_id;

WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
)
UPDATE public.pagos_renta_reconciliacion rec
SET pago_relacionado_id = s.keep_id
FROM public.pagos_renta pr JOIN survivors s USING (contrato_id, mes, anio)
WHERE rec.pago_relacionado_id = pr.id AND pr.id <> s.keep_id;

WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
)
DELETE FROM public.pagos_renta pr USING survivors s
WHERE pr.contrato_id = s.contrato_id AND pr.mes = s.mes AND pr.anio = s.anio
  AND pr.id <> s.keep_id;

CREATE OR REPLACE FUNCTION public.require_contrato_id_on_pagos_renta()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.contrato_id IS NULL THEN
    RAISE EXCEPTION 'pagos_renta.contrato_id es obligatorio (mes=%, anio=%, property=%, inquilino=%).',
      NEW.mes, NEW.anio, NEW.property_id, NEW.inquilino_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_contrato_id_on_pagos_renta ON public.pagos_renta;
CREATE TRIGGER trg_require_contrato_id_on_pagos_renta
BEFORE INSERT OR UPDATE OF contrato_id, property_id, inquilino_id, mes, anio
ON public.pagos_renta
FOR EACH ROW EXECUTE FUNCTION public.require_contrato_id_on_pagos_renta();

CREATE UNIQUE INDEX pagos_renta_contrato_periodo_unique
  ON public.pagos_renta (contrato_id, mes, anio)
  WHERE contrato_id IS NOT NULL;

COMMENT ON CONSTRAINT pagos_renta_property_id_inquilino_id_mes_anio_key ON public.pagos_renta IS
  '@deprecated Sprint 3+: usar pagos_renta_contrato_periodo_unique.';