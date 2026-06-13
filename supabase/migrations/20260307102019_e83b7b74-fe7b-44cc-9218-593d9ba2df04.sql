
-- Properties table with all detailed fields
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic info
  nombre_interno TEXT NOT NULL,
  direccion_completa TEXT,
  codigo_postal TEXT,
  ciudad TEXT,
  provincia TEXT,
  
  -- Property type & characteristics
  tipo_vivienda TEXT, -- casa, piso, estudio, ático, dúplex, chalet, adosado, local
  planta TEXT,
  tiene_ascensor BOOLEAN DEFAULT false,
  superficie_m2 NUMERIC,
  num_habitaciones INTEGER,
  num_banos INTEGER,
  
  -- Catastral
  referencia_catastral TEXT,
  
  -- State of the property
  estado_general TEXT, -- a reformar, buen estado, nuevo, reformado
  estado_banos TEXT, -- reformados, a reformar, semi-reformados
  estado_cocina TEXT, -- equipada, a reformar, semi-equipada
  cocina_equipamiento TEXT[], -- nevera, horno, vitrocerámica, lavavajillas, microondas
  tipo_suelos TEXT, -- parquet, cerámica, terrazo, tarima flotante, mármol
  estado_paredes TEXT, -- lisas, gotelé, papel pintado
  tipo_ventanas TEXT, -- climalit, madera, aluminio, PVC
  puente_termico BOOLEAN DEFAULT false,
  estado_electricidad TEXT, -- sin actualizar, actualizada normativa 2022, parcialmente actualizada
  estado_canerias TEXT, -- plomo, actualizadas (año)
  ano_actualizacion_canerias INTEGER,
  
  -- Climate
  tiene_calefaccion BOOLEAN DEFAULT false,
  tipo_calefaccion TEXT, -- gas natural, eléctrica, gasoil, aerotermia, suelo radiante
  tiene_aire_acondicionado BOOLEAN DEFAULT false,
  tipo_aire_acondicionado TEXT, -- split, centralizado, por conductos
  ubicacion_aire TEXT, -- todas las habitaciones, salón, salón y dormitorio principal
  
  -- Energy certificate
  tiene_certificado_energetico BOOLEAN DEFAULT false,
  calificacion_energetica TEXT, -- A, B, C, D, E, F, G
  
  -- Community
  nombre_administracion TEXT,
  datos_empresa_administracion TEXT,
  cuota_comunidad NUMERIC,
  tiene_derrama BOOLEAN DEFAULT false,
  importe_derrama NUMERIC,
  forma_pago_derrama TEXT,
  fecha_fin_derrama DATE,
  nombre_presidente TEXT,
  telefono_presidente TEXT,
  email_presidente TEXT,
  
  -- Taxes
  ibi_importe NUMERIC,
  ibi_fecha_pago TEXT,
  basuras_importe NUMERIC,
  basuras_fecha_pago TEXT,
  
  -- Insurance
  seguros JSONB DEFAULT '[]'::jsonb,
  -- Each element: { tipo, compania, num_poliza, contacto, importe, vencimiento }
  
  -- Value
  valor_compra NUMERIC,
  ano_compra INTEGER,
  valor_estimado NUMERIC,
  
  -- Status & income (from existing design)
  estado TEXT DEFAULT 'libre', -- reformas, libre, alquilada, okupada, sin uso, uso propio, inqui-okupada
  salud_ingresos TEXT DEFAULT 'green', -- green, yellow, red
  
  -- Tenant
  inquilino_nombre TEXT,
  
  -- Sharing
  compartir_habilitado BOOLEAN DEFAULT false,
  
  -- Other
  otros_datos TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own properties"
  ON public.properties FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own properties"
  ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties"
  ON public.properties FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties"
  ON public.properties FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Property photos table
CREATE TABLE public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  orden INTEGER DEFAULT 0,
  es_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own property photos"
  ON public.property_photos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own property photos"
  ON public.property_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own property photos"
  ON public.property_photos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own property photos"
  ON public.property_photos FOR UPDATE USING (auth.uid() = user_id);
