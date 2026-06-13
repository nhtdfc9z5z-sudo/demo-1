-- Consolidación de duplicados solidarios + imposición de UNIQUE(contrato_id,mes,anio)

WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
),
duplicados AS (
  SELECT pr.id, pr.user_id, pr.contrato_id, pr.mes, pr.anio,
         pr.inquilino_id, pr.importe_pagado, pr.tipo_registro,
         s.keep_id
  FROM public.pagos_renta pr
  JOIN survivors s USING (contrato_id, mes, anio)
  WHERE pr.contrato_id IS NOT NULL AND pr.id <> s.keep_id
)
INSERT INTO public.error_logs (user_id, event_name, severity, message, context)
SELECT user_id, 'pagos_renta.consolidacion_solidarios', 'info',
       'Duplicado solidario consolidado en el pago superviviente del contrato/mes',
       jsonb_build_object(
         'contrato_id', contrato_id, 'mes', mes, 'anio', anio,
         'pago_id_borrado', id, 'pago_id_superviviente', keep_id,
         'inquilino_id', inquilino_id,
         'importe_pagado', importe_pagado, 'tipo_registro', tipo_registro)
FROM duplicados;

-- Redirigir referencias FK en reconciliación al survivor.
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
FROM public.pagos_renta pr
JOIN survivors s USING (contrato_id, mes, anio)
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
FROM public.pagos_renta pr
JOIN survivors s USING (contrato_id, mes, anio)
WHERE rec.pago_relacionado_id = pr.id AND pr.id <> s.keep_id;

-- Borrar duplicados.
WITH survivors AS (
  SELECT DISTINCT ON (contrato_id, mes, anio) id AS keep_id, contrato_id, mes, anio
  FROM public.pagos_renta WHERE contrato_id IS NOT NULL
  ORDER BY contrato_id, mes, anio,
    CASE tipo_registro WHEN 'pago_real' THEN 1 WHEN 'regularizado' THEN 2
                       WHEN 'historico_reconstruido' THEN 3 WHEN 'pendiente' THEN 4 ELSE 5 END,
    COALESCE(importe_pagado, 0) DESC, updated_at DESC
)
DELETE FROM public.pagos_renta pr
USING survivors s
WHERE pr.contrato_id = s.contrato_id AND pr.mes = s.mes AND pr.anio = s.anio
  AND pr.id <> s.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_renta_contrato_periodo_unique
  ON public.pagos_renta (contrato_id, mes, anio)
  WHERE contrato_id IS NOT NULL;