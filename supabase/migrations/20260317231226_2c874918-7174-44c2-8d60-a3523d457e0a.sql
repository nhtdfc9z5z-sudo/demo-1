
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_inmueble text NOT NULL DEFAULT 'vivienda';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS amueblada boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bano_privado boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_ventana boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_armario boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_camas integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_cerradura boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS planta_sotano text DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_plazas integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_puerta_automatica boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_plaza text DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_acceso_rodado boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_agua boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_luz boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_vallado boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS calificacion_urbanistica text DEFAULT 'urbano';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_despachos integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS altura_libre numeric DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_carga_descarga boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_escaparate boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS uso_permitido text DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_plantas integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_viviendas integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_garajes integer DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS num_locales integer DEFAULT NULL;

INSERT INTO public.properties (id, user_id, nombre_interno, tipo_inmueble, tipo_via, direccion_completa, numero_portal, planta, puerta, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, estado, otros_datos, valor_compra, ano_compra, gastos_compra, valor_estimado, amueblada, bano_privado, tiene_ventana, tiene_armario, num_camas)
SELECT id, user_id, nombre_interno, 'habitacion', tipo_via, direccion_completa, numero_portal, planta, puerta, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, COALESCE(estado, 'libre'), notas, valor_compra, ano_compra, gastos_compra, valor_estimado, amueblada, bano_privado, tiene_ventana, tiene_armario, num_camas
FROM public.habitaciones;

INSERT INTO public.properties (id, user_id, nombre_interno, tipo_inmueble, tipo_via, direccion_completa, numero_portal, planta, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, estado, otros_datos, valor_compra, ano_compra, gastos_compra, valor_estimado, tiene_cerradura, planta_sotano)
SELECT id, user_id, nombre_interno, 'trastero', tipo_via, direccion_completa, numero_portal, planta, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, COALESCE(estado, 'libre'), notas, valor_compra, ano_compra, gastos_compra, valor_estimado, tiene_cerradura, planta_sotano
FROM public.trasteros;

INSERT INTO public.properties (id, user_id, nombre_interno, tipo_inmueble, tipo_via, direccion_completa, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, estado, otros_datos, valor_compra, ano_compra, gastos_compra, valor_estimado, tiene_acceso_rodado, tiene_agua, tiene_luz, tiene_vallado, calificacion_urbanistica)
SELECT id, user_id, nombre_interno, 'terreno', tipo_via, direccion_completa, urbanizacion, municipio, provincia, comunidad_autonoma, codigo_postal, referencia_catastral, superficie_m2, COALESCE(estado, 'libre'), notas, valor_compra, ano_compra, gastos_compra, valor_estimado, tiene_acceso_rodado, tiene_agua, tiene_luz, tiene_vallado, calificacion_urbanistica
FROM public.terrenos;
