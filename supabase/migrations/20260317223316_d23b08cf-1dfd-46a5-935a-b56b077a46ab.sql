
-- Habitaciones (rooms in shared housing)
CREATE TABLE public.habitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  planta text,
  puerta text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  amueblada boolean DEFAULT false,
  bano_privado boolean DEFAULT false,
  tiene_ventana boolean DEFAULT true,
  tiene_armario boolean DEFAULT false,
  num_camas integer DEFAULT 1,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.habitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habitaciones" ON public.habitaciones FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Garajes
CREATE TABLE public.garajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  planta text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  num_plazas integer DEFAULT 1,
  tipo_plaza text DEFAULT 'cerrado',
  tiene_puerta_automatica boolean DEFAULT false,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.garajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own garajes" ON public.garajes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trasteros
CREATE TABLE public.trasteros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  planta text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  planta_sotano text,
  tiene_cerradura boolean DEFAULT true,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trasteros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own trasteros" ON public.trasteros FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Oficinas
CREATE TABLE public.oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  planta text,
  puerta text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  num_despachos integer,
  num_banos integer,
  tiene_ascensor boolean DEFAULT false,
  tiene_aire_acondicionado boolean DEFAULT false,
  tiene_calefaccion boolean DEFAULT false,
  cuota_comunidad numeric,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own oficinas" ON public.oficinas FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Locales y naves
CREATE TABLE public.locales_naves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  planta text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  uso_permitido text,
  tiene_escaparate boolean DEFAULT false,
  altura_libre numeric,
  tiene_carga_descarga boolean DEFAULT false,
  cuota_comunidad numeric,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.locales_naves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own locales_naves" ON public.locales_naves FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Terrenos
CREATE TABLE public.terrenos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  calificacion_urbanistica text DEFAULT 'urbano',
  tiene_acceso_rodado boolean DEFAULT false,
  tiene_agua boolean DEFAULT false,
  tiene_luz boolean DEFAULT false,
  tiene_vallado boolean DEFAULT false,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.terrenos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own terrenos" ON public.terrenos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Edificios
CREATE TABLE public.edificios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nombre_interno text NOT NULL,
  tipo_via text,
  direccion_completa text,
  numero_portal text,
  urbanizacion text,
  municipio text,
  provincia text,
  comunidad_autonoma text,
  codigo_postal text,
  referencia_catastral text,
  superficie_m2 numeric,
  num_plantas integer,
  num_viviendas integer,
  num_locales integer,
  num_garajes integer,
  ano_construccion integer,
  cuota_comunidad numeric,
  valor_compra numeric,
  ano_compra integer,
  gastos_compra numeric,
  valor_estimado numeric,
  estado text DEFAULT 'libre',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.edificios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own edificios" ON public.edificios FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
