
-- =========================================================
-- Sprint 1 #3: integridad referencial y constraints
-- Reporte previo: 0 conflictos excepto 295 pagos_real sin fecha_pago_real (legacy, no se fuerza)
-- =========================================================

-- ---------- contrato_personas ----------
ALTER TABLE public.contrato_personas
  ADD CONSTRAINT contrato_personas_contrato_id_fkey
    FOREIGN KEY (contrato_id) REFERENCES public.contratos_arrendamiento(id) ON DELETE CASCADE,
  ADD CONSTRAINT contrato_personas_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.contrato_personas
  ADD CONSTRAINT contrato_personas_pct_participacion_chk
    CHECK (porcentaje_participacion IS NULL OR (porcentaje_participacion >= 0 AND porcentaje_participacion <= 100)),
  ADD CONSTRAINT contrato_personas_pct_fiscal_chk
    CHECK (porcentaje_fiscal IS NULL OR (porcentaje_fiscal >= 0 AND porcentaje_fiscal <= 100)),
  ADD CONSTRAINT contrato_personas_parte_chk
    CHECK (parte IN ('arrendadora','arrendataria','gestion','garantia','otro'));

-- Unique parcial: solo cuando hay DNI (evita duplicados obvios de la misma persona+rol en el mismo contrato).
CREATE UNIQUE INDEX IF NOT EXISTS contrato_personas_contrato_dni_rol_uq
  ON public.contrato_personas (contrato_id, dni, rol)
  WHERE dni IS NOT NULL AND dni <> '';

CREATE INDEX IF NOT EXISTS contrato_personas_contrato_idx ON public.contrato_personas (contrato_id);
CREATE INDEX IF NOT EXISTS contrato_personas_property_idx ON public.contrato_personas (property_id);

-- ---------- pagos_renta ----------
-- FKs y UNIQUE (property_id, inquilino_id, mes, anio) ya existen. Solo añadimos CHECKs.
ALTER TABLE public.pagos_renta
  ADD CONSTRAINT pagos_renta_mes_chk CHECK (mes BETWEEN 1 AND 12),
  ADD CONSTRAINT pagos_renta_importe_chk CHECK (importe_pagado IS NULL OR importe_pagado >= 0),
  ADD CONSTRAINT pagos_renta_tipo_registro_chk
    CHECK (tipo_registro IS NULL OR tipo_registro IN ('pago_real','historico_reconstruido','regularizado','pendiente')),
  ADD CONSTRAINT pagos_renta_pendiente_importe_chk
    CHECK (tipo_registro <> 'pendiente' OR COALESCE(importe_pagado, 0) = 0);

-- fecha_devengo: 0 nulos actuales, forzamos NOT NULL para nuevos registros.
ALTER TABLE public.pagos_renta ALTER COLUMN fecha_devengo SET NOT NULL;

-- NOTA: no añadimos CHECK pago_real ⇒ fecha_pago_real NOT NULL porque 295 filas legacy lo violarían.
-- Se abordará con un script de saneamiento en sprint separado.
