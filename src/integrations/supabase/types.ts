export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contrato_garantias_adicionales: {
        Row: {
          contrato_id: string
          created_at: string
          documento_path: string | null
          documento_url: string | null
          estado: string
          fecha_devolucion: string | null
          fecha_entrega: string | null
          id: string
          importe: number
          inquilino_id: string | null
          mensualidades_equivalentes: number | null
          notas: string | null
          property_id: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          documento_path?: string | null
          documento_url?: string | null
          estado?: string
          fecha_devolucion?: string | null
          fecha_entrega?: string | null
          id?: string
          importe?: number
          inquilino_id?: string | null
          mensualidades_equivalentes?: number | null
          notas?: string | null
          property_id: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          documento_path?: string | null
          documento_url?: string | null
          estado?: string
          fecha_devolucion?: string | null
          fecha_entrega?: string | null
          id?: string
          importe?: number
          inquilino_id?: string | null
          mensualidades_equivalentes?: number | null
          notas?: string | null
          property_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contrato_historial: {
        Row: {
          contrato_id: string
          created_at: string
          detalle: string | null
          documento_path: string | null
          documento_url: string | null
          fecha_evento: string | null
          id: string
          importe_anterior: number | null
          importe_nuevo: number | null
          metadata: Json | null
          notas: string | null
          property_id: string
          tipo: string
          titulo: string
          user_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          detalle?: string | null
          documento_path?: string | null
          documento_url?: string | null
          fecha_evento?: string | null
          id?: string
          importe_anterior?: number | null
          importe_nuevo?: number | null
          metadata?: Json | null
          notas?: string | null
          property_id: string
          tipo?: string
          titulo: string
          user_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          detalle?: string | null
          documento_path?: string | null
          documento_url?: string | null
          fecha_evento?: string | null
          id?: string
          importe_anterior?: number | null
          importe_nuevo?: number | null
          metadata?: Json | null
          notas?: string | null
          property_id?: string
          tipo?: string
          titulo?: string
          user_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_historial_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_arrendamiento"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_modificaciones: {
        Row: {
          campo_afectado: string | null
          canal_comunicacion: string | null
          comunicado: boolean
          confirmado_por_inquilino: boolean | null
          contrato_id: string
          created_at: string
          fecha_comunicacion: string | null
          fecha_confirmacion: string | null
          fecha_efectiva: string | null
          fecha_registro: string
          id: string
          motivo: string | null
          naturaleza: string
          notas: string | null
          property_id: string
          soporte: string | null
          soporte_archivo_path: string | null
          soporte_archivo_url: string | null
          tipo_cambio: string
          user_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_afectado?: string | null
          canal_comunicacion?: string | null
          comunicado?: boolean
          confirmado_por_inquilino?: boolean | null
          contrato_id: string
          created_at?: string
          fecha_comunicacion?: string | null
          fecha_confirmacion?: string | null
          fecha_efectiva?: string | null
          fecha_registro?: string
          id?: string
          motivo?: string | null
          naturaleza?: string
          notas?: string | null
          property_id: string
          soporte?: string | null
          soporte_archivo_path?: string | null
          soporte_archivo_url?: string | null
          tipo_cambio?: string
          user_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_afectado?: string | null
          canal_comunicacion?: string | null
          comunicado?: boolean
          confirmado_por_inquilino?: boolean | null
          contrato_id?: string
          created_at?: string
          fecha_comunicacion?: string | null
          fecha_confirmacion?: string | null
          fecha_efectiva?: string | null
          fecha_registro?: string
          id?: string
          motivo?: string | null
          naturaleza?: string
          notas?: string | null
          property_id?: string
          soporte?: string | null
          soporte_archivo_path?: string | null
          soporte_archivo_url?: string | null
          tipo_cambio?: string
          user_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_modificaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_arrendamiento"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_personas: {
        Row: {
          afecta_fiscalidad: boolean
          contrato_id: string
          created_at: string
          dni: string | null
          email: string | null
          es_yo: boolean
          id: string
          inquilino_id: string | null
          nombre: string
          notas: string | null
          orden: number | null
          parte: string
          porcentaje_fiscal: number | null
          porcentaje_participacion: number | null
          property_id: string
          rol: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          afecta_fiscalidad?: boolean
          contrato_id: string
          created_at?: string
          dni?: string | null
          email?: string | null
          es_yo?: boolean
          id?: string
          inquilino_id?: string | null
          nombre: string
          notas?: string | null
          orden?: number | null
          parte?: string
          porcentaje_fiscal?: number | null
          porcentaje_participacion?: number | null
          property_id: string
          rol?: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          afecta_fiscalidad?: boolean
          contrato_id?: string
          created_at?: string
          dni?: string | null
          email?: string | null
          es_yo?: boolean
          id?: string
          inquilino_id?: string | null
          nombre?: string
          notas?: string | null
          orden?: number | null
          parte?: string
          porcentaje_fiscal?: number | null
          porcentaje_participacion?: number | null
          property_id?: string
          rol?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_personas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_arrendamiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_personas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_plantillas: {
        Row: {
          archivo_nombre: string
          created_at: string
          id: string
          nombre: string
          storage_path: string
          tipo_contrato: string | null
          user_id: string
        }
        Insert: {
          archivo_nombre: string
          created_at?: string
          id?: string
          nombre: string
          storage_path: string
          tipo_contrato?: string | null
          user_id: string
        }
        Update: {
          archivo_nombre?: string
          created_at?: string
          id?: string
          nombre?: string
          storage_path?: string
          tipo_contrato?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contratos_arrendamiento: {
        Row: {
          agua_paga_inquilino: boolean
          archivado: boolean
          archivo_nombre: string | null
          archivo_url: string | null
          basuras_paga_inquilino: boolean
          comunidad_paga_inquilino: boolean
          created_at: string
          cuota_comunidad: number | null
          deposito_garantia: number | null
          documento_original_nombre: string | null
          documento_original_path: string | null
          documento_original_url: string | null
          duracion_anos: number | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          fecha_inicio_control: string | null
          fianza_importe: number | null
          gas_paga_inquilino: boolean
          ibi_paga_inquilino: boolean
          id: string
          inquilino_id: string | null
          internet_paga_inquilino: boolean
          luz_paga_inquilino: boolean
          modalidad_alquiler: string
          notas: string | null
          preaviso_meses: number | null
          property_id: string
          prorroga_anos: number | null
          renovacion_automatica: boolean
          renovacion_confirmada_at: string | null
          renovacion_sugerida_at: string | null
          renovacion_sugerida_hasta: string | null
          renta_mensual: number | null
          revisado_por_usuario: boolean
          storage_path: string | null
          tiene_inventario: boolean
          tipo_contrato: string
          tipo_contrato_detalle: Json
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agua_paga_inquilino?: boolean
          archivado?: boolean
          archivo_nombre?: string | null
          archivo_url?: string | null
          basuras_paga_inquilino?: boolean
          comunidad_paga_inquilino?: boolean
          created_at?: string
          cuota_comunidad?: number | null
          deposito_garantia?: number | null
          documento_original_nombre?: string | null
          documento_original_path?: string | null
          documento_original_url?: string | null
          duracion_anos?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_inicio_control?: string | null
          fianza_importe?: number | null
          gas_paga_inquilino?: boolean
          ibi_paga_inquilino?: boolean
          id?: string
          inquilino_id?: string | null
          internet_paga_inquilino?: boolean
          luz_paga_inquilino?: boolean
          modalidad_alquiler?: string
          notas?: string | null
          preaviso_meses?: number | null
          property_id: string
          prorroga_anos?: number | null
          renovacion_automatica?: boolean
          renovacion_confirmada_at?: string | null
          renovacion_sugerida_at?: string | null
          renovacion_sugerida_hasta?: string | null
          renta_mensual?: number | null
          revisado_por_usuario?: boolean
          storage_path?: string | null
          tiene_inventario?: boolean
          tipo_contrato?: string
          tipo_contrato_detalle?: Json
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agua_paga_inquilino?: boolean
          archivado?: boolean
          archivo_nombre?: string | null
          archivo_url?: string | null
          basuras_paga_inquilino?: boolean
          comunidad_paga_inquilino?: boolean
          created_at?: string
          cuota_comunidad?: number | null
          deposito_garantia?: number | null
          documento_original_nombre?: string | null
          documento_original_path?: string | null
          documento_original_url?: string | null
          duracion_anos?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_inicio_control?: string | null
          fianza_importe?: number | null
          gas_paga_inquilino?: boolean
          ibi_paga_inquilino?: boolean
          id?: string
          inquilino_id?: string | null
          internet_paga_inquilino?: boolean
          luz_paga_inquilino?: boolean
          modalidad_alquiler?: string
          notas?: string | null
          preaviso_meses?: number | null
          property_id?: string
          prorroga_anos?: number | null
          renovacion_automatica?: boolean
          renovacion_confirmada_at?: string | null
          renovacion_sugerida_at?: string | null
          renovacion_sugerida_hasta?: string | null
          renta_mensual?: number | null
          revisado_por_usuario?: boolean
          storage_path?: string | null
          tiene_inventario?: boolean
          tipo_contrato?: string
          tipo_contrato_detalle?: Json
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_arrendamiento_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_arrendamiento_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_vinculos: {
        Row: {
          created_at: string
          documento_id: string
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["documento_entidad"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["documento_entidad"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          entidad_id?: string
          entidad_tipo?: Database["public"]["Enums"]["documento_entidad"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_vinculos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          bucket: string
          categoria: string
          created_at: string
          estado_revision: Database["public"]["Enums"]["documento_estado_revision"]
          fecha_documento: string | null
          fecha_vencimiento: string | null
          id: string
          mime_type: string | null
          nombre: string
          notas: string | null
          ocr_engine: string | null
          ocr_error: string | null
          ocr_processed_at: string | null
          ocr_status: Database["public"]["Enums"]["documento_ocr_status"]
          ocr_text: string | null
          ocr_version: string | null
          origen_id: string | null
          origen_tipo: string | null
          recordatorio_dias_antes: number | null
          requiere_revision: boolean
          search_tsv: unknown
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket?: string
          categoria?: string
          created_at?: string
          estado_revision?: Database["public"]["Enums"]["documento_estado_revision"]
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          notas?: string | null
          ocr_engine?: string | null
          ocr_error?: string | null
          ocr_processed_at?: string | null
          ocr_status?: Database["public"]["Enums"]["documento_ocr_status"]
          ocr_text?: string | null
          ocr_version?: string | null
          origen_id?: string | null
          origen_tipo?: string | null
          recordatorio_dias_antes?: number | null
          requiere_revision?: boolean
          search_tsv?: unknown
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket?: string
          categoria?: string
          created_at?: string
          estado_revision?: Database["public"]["Enums"]["documento_estado_revision"]
          fecha_documento?: string | null
          fecha_vencimiento?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          notas?: string | null
          ocr_engine?: string | null
          ocr_error?: string | null
          ocr_processed_at?: string | null
          ocr_status?: Database["public"]["Enums"]["documento_ocr_status"]
          ocr_text?: string | null
          ocr_version?: string | null
          origen_id?: string | null
          origen_tipo?: string | null
          recordatorio_dias_antes?: number | null
          requiere_revision?: boolean
          search_tsv?: unknown
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      edificios: {
        Row: {
          ano_compra: number | null
          ano_construccion: number | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          cuota_comunidad: number | null
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          num_garajes: number | null
          num_locales: number | null
          num_plantas: number | null
          num_viviendas: number | null
          numero_portal: string | null
          provincia: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_usufructo: boolean
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          ano_construccion?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          num_garajes?: number | null
          num_locales?: number | null
          num_plantas?: number | null
          num_viviendas?: number | null
          numero_portal?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          ano_construccion?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          num_garajes?: number | null
          num_locales?: number | null
          num_plantas?: number | null
          num_viviendas?: number | null
          numero_portal?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          event_name: string
          id: string
          message: string
          severity: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          event_name: string
          id?: string
          message: string
          severity?: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          event_name?: string
          id?: string
          message?: string
          severity?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      facturas: {
        Row: {
          ano_fiscal: number | null
          archivo_nombre: string
          archivo_url: string
          base_imponible: number | null
          categoria: string | null
          created_at: string
          cuota_iva: number | null
          deducible_irpf: boolean | null
          deleted_at: string | null
          emisor_nif: string | null
          emisor_nombre: string | null
          fecha: string | null
          fecha_devengo: string | null
          fecha_pago: string | null
          forma_pago: string | null
          id: string
          iva_porcentaje: number | null
          notas: string | null
          numero_factura: string | null
          property_id: string | null
          proveedor_id: string | null
          receptor_nif: string | null
          receptor_nombre: string | null
          storage_path: string
          total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_fiscal?: number | null
          archivo_nombre: string
          archivo_url: string
          base_imponible?: number | null
          categoria?: string | null
          created_at?: string
          cuota_iva?: number | null
          deducible_irpf?: boolean | null
          deleted_at?: string | null
          emisor_nif?: string | null
          emisor_nombre?: string | null
          fecha?: string | null
          fecha_devengo?: string | null
          fecha_pago?: string | null
          forma_pago?: string | null
          id?: string
          iva_porcentaje?: number | null
          notas?: string | null
          numero_factura?: string | null
          property_id?: string | null
          proveedor_id?: string | null
          receptor_nif?: string | null
          receptor_nombre?: string | null
          storage_path: string
          total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_fiscal?: number | null
          archivo_nombre?: string
          archivo_url?: string
          base_imponible?: number | null
          categoria?: string | null
          created_at?: string
          cuota_iva?: number | null
          deducible_irpf?: boolean | null
          deleted_at?: string | null
          emisor_nif?: string | null
          emisor_nombre?: string | null
          fecha?: string | null
          fecha_devengo?: string | null
          fecha_pago?: string | null
          forma_pago?: string | null
          id?: string
          iva_porcentaje?: number | null
          notas?: string | null
          numero_factura?: string | null
          property_id?: string | null
          proveedor_id?: string | null
          receptor_nif?: string | null
          receptor_nombre?: string | null
          storage_path?: string
          total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      fianzas: {
        Row: {
          comunidad_autonoma: string | null
          created_at: string
          estado: string
          fecha_deposito: string | null
          fecha_devolucion: string | null
          fecha_efecto_actual: string | null
          id: string
          importe: number
          importe_inicial: number | null
          inquilino_id: string | null
          justificante_path: string | null
          justificante_url: string | null
          medio_pago: string | null
          meses_fianza: number | null
          notas: string | null
          numero_expediente: string | null
          organismo: string | null
          property_id: string
          tipo_fianza: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comunidad_autonoma?: string | null
          created_at?: string
          estado?: string
          fecha_deposito?: string | null
          fecha_devolucion?: string | null
          fecha_efecto_actual?: string | null
          id?: string
          importe?: number
          importe_inicial?: number | null
          inquilino_id?: string | null
          justificante_path?: string | null
          justificante_url?: string | null
          medio_pago?: string | null
          meses_fianza?: number | null
          notas?: string | null
          numero_expediente?: string | null
          organismo?: string | null
          property_id: string
          tipo_fianza?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comunidad_autonoma?: string | null
          created_at?: string
          estado?: string
          fecha_deposito?: string | null
          fecha_devolucion?: string | null
          fecha_efecto_actual?: string | null
          id?: string
          importe?: number
          importe_inicial?: number | null
          inquilino_id?: string | null
          justificante_path?: string | null
          justificante_url?: string | null
          medio_pago?: string | null
          meses_fianza?: number | null
          notas?: string | null
          numero_expediente?: string | null
          organismo?: string | null
          property_id?: string
          tipo_fianza?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fianzas_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fianzas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      garajes: {
        Row: {
          ano_compra: number | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          num_plazas: number | null
          numero_portal: string | null
          planta: string | null
          provincia: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_puerta_automatica: boolean | null
          tiene_usufructo: boolean
          tipo_plaza: string | null
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          num_plazas?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_puerta_automatica?: boolean | null
          tiene_usufructo?: boolean
          tipo_plaza?: string | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          num_plazas?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_puerta_automatica?: boolean | null
          tiene_usufructo?: boolean
          tipo_plaza?: string | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      habitaciones: {
        Row: {
          amueblada: boolean | null
          ano_compra: number | null
          bano_privado: boolean | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          num_camas: number | null
          numero_portal: string | null
          planta: string | null
          provincia: string | null
          puerta: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_armario: boolean | null
          tiene_usufructo: boolean
          tiene_ventana: boolean | null
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          amueblada?: boolean | null
          ano_compra?: number | null
          bano_privado?: boolean | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          num_camas?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          puerta?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_armario?: boolean | null
          tiene_usufructo?: boolean
          tiene_ventana?: boolean | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          amueblada?: boolean | null
          ano_compra?: number | null
          bano_privado?: boolean | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          num_camas?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          puerta?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_armario?: boolean | null
          tiene_usufructo?: boolean
          tiene_ventana?: boolean | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      incidencia_citaciones: {
        Row: {
          created_at: string
          estado: string | null
          fecha_hora: string
          id: string
          incidencia_id: string
          notas: string | null
          receptor_email: string | null
          receptor_nombre: string
          receptor_rol: string | null
          receptor_telefono: string | null
          updated_at: string
          user_id: string
          visitante_email: string | null
          visitante_empresa: string | null
          visitante_nombre: string
          visitante_rol: string | null
          visitante_telefono: string | null
        }
        Insert: {
          created_at?: string
          estado?: string | null
          fecha_hora: string
          id?: string
          incidencia_id: string
          notas?: string | null
          receptor_email?: string | null
          receptor_nombre: string
          receptor_rol?: string | null
          receptor_telefono?: string | null
          updated_at?: string
          user_id: string
          visitante_email?: string | null
          visitante_empresa?: string | null
          visitante_nombre: string
          visitante_rol?: string | null
          visitante_telefono?: string | null
        }
        Update: {
          created_at?: string
          estado?: string | null
          fecha_hora?: string
          id?: string
          incidencia_id?: string
          notas?: string | null
          receptor_email?: string | null
          receptor_nombre?: string
          receptor_rol?: string | null
          receptor_telefono?: string | null
          updated_at?: string
          user_id?: string
          visitante_email?: string | null
          visitante_empresa?: string | null
          visitante_nombre?: string
          visitante_rol?: string | null
          visitante_telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_citaciones_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia_documentos: {
        Row: {
          categoria: string
          created_at: string
          id: string
          incidencia_id: string
          nombre_archivo: string
          storage_path: string
          url: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          id?: string
          incidencia_id: string
          nombre_archivo: string
          storage_path: string
          url: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          incidencia_id?: string
          nombre_archivo?: string
          storage_path?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_documentos_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia_evidencias: {
        Row: {
          created_at: string
          id: string
          incidencia_id: string
          nombre_archivo: string
          storage_path: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incidencia_id: string
          nombre_archivo: string
          storage_path: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incidencia_id?: string
          nombre_archivo?: string
          storage_path?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_evidencias_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia_mensajes: {
        Row: {
          autor: string
          created_at: string
          id: string
          incidencia_id: string
          mensaje: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autor: string
          created_at?: string
          id?: string
          incidencia_id: string
          mensaje: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autor?: string
          created_at?: string
          id?: string
          incidencia_id?: string
          mensaje?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_mensajes_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          afectado_domicilio: string | null
          afectado_lugar: string | null
          afectado_nombre: string | null
          afectado_responsable: string | null
          afectado_seguro_email: string | null
          afectado_seguro_nombre: string | null
          afectado_seguro_observaciones: string | null
          afectado_seguro_poliza: string | null
          afectado_seguro_ref_siniestro: string | null
          afectado_seguro_telefono: string | null
          afectado_telefono: string | null
          causante: string | null
          concepto: string | null
          created_at: string
          deleted_at: string | null
          direccion: string | null
          disponibilidad_comentarios: string | null
          disponibilidad_dias: string[] | null
          disponibilidad_parte_dia: string | null
          estado: string | null
          factura_base_imponible: number | null
          factura_cuota_iva: number | null
          factura_emisor_nif: string | null
          factura_emisor_nombre: string | null
          factura_fecha: string | null
          factura_iva_porcentaje: number | null
          factura_numero: string | null
          factura_receptor_nif: string | null
          factura_receptor_nombre: string | null
          factura_total: number | null
          fecha_hora_incidencia: string | null
          gestion_nombre: string | null
          gestion_telefono: string | null
          id: string
          inquilino_contacto_email: boolean | null
          inquilino_contacto_llamada: boolean | null
          inquilino_contacto_whatsapp: boolean | null
          inquilino_email: string | null
          inquilino_id: string | null
          inquilino_nombre: string | null
          inquilino_observaciones: string | null
          inquilino_telefono: string | null
          numero_incidencia: number
          origen_domicilio: string | null
          origen_lugar: string | null
          origen_nombre_responsable: string | null
          origen_responsable: string | null
          origen_seguro_email: string | null
          origen_seguro_nombre: string | null
          origen_seguro_observaciones: string | null
          origen_seguro_poliza: string | null
          origen_seguro_ref_siniestro: string | null
          origen_seguro_telefono: string | null
          origen_telefono_responsable: string | null
          origen_tipo: string | null
          presupuesto_archivo_path: string | null
          presupuesto_archivo_url: string | null
          presupuesto_descripcion: string | null
          presupuesto_fecha: string | null
          presupuesto_importe: number | null
          presupuesto_iva_cuota: number | null
          presupuesto_iva_porcentaje: number | null
          presupuesto_observaciones: string | null
          presupuesto_total: number | null
          presupuesto_validez: string | null
          prioridad: number | null
          property_id: string | null
          proveedor_cif: string | null
          proveedor_direccion: string | null
          proveedor_email: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          proveedor_telefono: string | null
          referencia_interna: string | null
          responsable_gestion: string | null
          responsable_nombre: string | null
          responsable_pago: string | null
          responsable_telefono: string | null
          tipo_incidencia: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          afectado_domicilio?: string | null
          afectado_lugar?: string | null
          afectado_nombre?: string | null
          afectado_responsable?: string | null
          afectado_seguro_email?: string | null
          afectado_seguro_nombre?: string | null
          afectado_seguro_observaciones?: string | null
          afectado_seguro_poliza?: string | null
          afectado_seguro_ref_siniestro?: string | null
          afectado_seguro_telefono?: string | null
          afectado_telefono?: string | null
          causante?: string | null
          concepto?: string | null
          created_at?: string
          deleted_at?: string | null
          direccion?: string | null
          disponibilidad_comentarios?: string | null
          disponibilidad_dias?: string[] | null
          disponibilidad_parte_dia?: string | null
          estado?: string | null
          factura_base_imponible?: number | null
          factura_cuota_iva?: number | null
          factura_emisor_nif?: string | null
          factura_emisor_nombre?: string | null
          factura_fecha?: string | null
          factura_iva_porcentaje?: number | null
          factura_numero?: string | null
          factura_receptor_nif?: string | null
          factura_receptor_nombre?: string | null
          factura_total?: number | null
          fecha_hora_incidencia?: string | null
          gestion_nombre?: string | null
          gestion_telefono?: string | null
          id?: string
          inquilino_contacto_email?: boolean | null
          inquilino_contacto_llamada?: boolean | null
          inquilino_contacto_whatsapp?: boolean | null
          inquilino_email?: string | null
          inquilino_id?: string | null
          inquilino_nombre?: string | null
          inquilino_observaciones?: string | null
          inquilino_telefono?: string | null
          numero_incidencia?: number
          origen_domicilio?: string | null
          origen_lugar?: string | null
          origen_nombre_responsable?: string | null
          origen_responsable?: string | null
          origen_seguro_email?: string | null
          origen_seguro_nombre?: string | null
          origen_seguro_observaciones?: string | null
          origen_seguro_poliza?: string | null
          origen_seguro_ref_siniestro?: string | null
          origen_seguro_telefono?: string | null
          origen_telefono_responsable?: string | null
          origen_tipo?: string | null
          presupuesto_archivo_path?: string | null
          presupuesto_archivo_url?: string | null
          presupuesto_descripcion?: string | null
          presupuesto_fecha?: string | null
          presupuesto_importe?: number | null
          presupuesto_iva_cuota?: number | null
          presupuesto_iva_porcentaje?: number | null
          presupuesto_observaciones?: string | null
          presupuesto_total?: number | null
          presupuesto_validez?: string | null
          prioridad?: number | null
          property_id?: string | null
          proveedor_cif?: string | null
          proveedor_direccion?: string | null
          proveedor_email?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          proveedor_telefono?: string | null
          referencia_interna?: string | null
          responsable_gestion?: string | null
          responsable_nombre?: string | null
          responsable_pago?: string | null
          responsable_telefono?: string | null
          tipo_incidencia?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          afectado_domicilio?: string | null
          afectado_lugar?: string | null
          afectado_nombre?: string | null
          afectado_responsable?: string | null
          afectado_seguro_email?: string | null
          afectado_seguro_nombre?: string | null
          afectado_seguro_observaciones?: string | null
          afectado_seguro_poliza?: string | null
          afectado_seguro_ref_siniestro?: string | null
          afectado_seguro_telefono?: string | null
          afectado_telefono?: string | null
          causante?: string | null
          concepto?: string | null
          created_at?: string
          deleted_at?: string | null
          direccion?: string | null
          disponibilidad_comentarios?: string | null
          disponibilidad_dias?: string[] | null
          disponibilidad_parte_dia?: string | null
          estado?: string | null
          factura_base_imponible?: number | null
          factura_cuota_iva?: number | null
          factura_emisor_nif?: string | null
          factura_emisor_nombre?: string | null
          factura_fecha?: string | null
          factura_iva_porcentaje?: number | null
          factura_numero?: string | null
          factura_receptor_nif?: string | null
          factura_receptor_nombre?: string | null
          factura_total?: number | null
          fecha_hora_incidencia?: string | null
          gestion_nombre?: string | null
          gestion_telefono?: string | null
          id?: string
          inquilino_contacto_email?: boolean | null
          inquilino_contacto_llamada?: boolean | null
          inquilino_contacto_whatsapp?: boolean | null
          inquilino_email?: string | null
          inquilino_id?: string | null
          inquilino_nombre?: string | null
          inquilino_observaciones?: string | null
          inquilino_telefono?: string | null
          numero_incidencia?: number
          origen_domicilio?: string | null
          origen_lugar?: string | null
          origen_nombre_responsable?: string | null
          origen_responsable?: string | null
          origen_seguro_email?: string | null
          origen_seguro_nombre?: string | null
          origen_seguro_observaciones?: string | null
          origen_seguro_poliza?: string | null
          origen_seguro_ref_siniestro?: string | null
          origen_seguro_telefono?: string | null
          origen_telefono_responsable?: string | null
          origen_tipo?: string | null
          presupuesto_archivo_path?: string | null
          presupuesto_archivo_url?: string | null
          presupuesto_descripcion?: string | null
          presupuesto_fecha?: string | null
          presupuesto_importe?: number | null
          presupuesto_iva_cuota?: number | null
          presupuesto_iva_porcentaje?: number | null
          presupuesto_observaciones?: string | null
          presupuesto_total?: number | null
          presupuesto_validez?: string | null
          prioridad?: number | null
          property_id?: string | null
          proveedor_cif?: string | null
          proveedor_direccion?: string | null
          proveedor_email?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          proveedor_telefono?: string | null
          referencia_interna?: string | null
          responsable_gestion?: string | null
          responsable_nombre?: string | null
          responsable_pago?: string | null
          responsable_telefono?: string | null
          tipo_incidencia?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilino_documentos: {
        Row: {
          categoria: string
          created_at: string
          id: string
          inquilino_id: string
          nombre_archivo: string
          storage_path: string
          subido_por: string
          url: string
          user_id: string
          visible_para_inquilino: boolean
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          inquilino_id: string
          nombre_archivo: string
          storage_path: string
          subido_por?: string
          url: string
          user_id: string
          visible_para_inquilino?: boolean
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          inquilino_id?: string
          nombre_archivo?: string
          storage_path?: string
          subido_por?: string
          url?: string
          user_id?: string
          visible_para_inquilino?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inquilino_documentos_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilino_eventos: {
        Row: {
          auth_user_id: string
          created_at: string
          descripcion: string | null
          fecha: string
          hora: string | null
          id: string
          inquilino_id: string
          notificar_inquilino: boolean
          tipo: string
          titulo: string
          updated_at: string
          visible_para_inquilino: boolean
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          descripcion?: string | null
          fecha: string
          hora?: string | null
          id?: string
          inquilino_id: string
          notificar_inquilino?: boolean
          tipo?: string
          titulo: string
          updated_at?: string
          visible_para_inquilino?: boolean
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          descripcion?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          inquilino_id?: string
          notificar_inquilino?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          visible_para_inquilino?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inquilino_eventos_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilino_perfil_economico: {
        Row: {
          antiguedad_laboral_meses: number | null
          created_at: string
          deudas_conocidas: boolean
          empresa_actual: string | null
          id: string
          ingresos_mensuales: number | null
          ingresos_tipo: string | null
          inquilino_id: string
          ratio_esfuerzo: number | null
          renta_maxima_estimada: number | null
          scoring_estado: string
          scoring_notas: string | null
          situacion_laboral: string | null
          tiene_aval_bancario: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          antiguedad_laboral_meses?: number | null
          created_at?: string
          deudas_conocidas?: boolean
          empresa_actual?: string | null
          id?: string
          ingresos_mensuales?: number | null
          ingresos_tipo?: string | null
          inquilino_id: string
          ratio_esfuerzo?: number | null
          renta_maxima_estimada?: number | null
          scoring_estado?: string
          scoring_notas?: string | null
          situacion_laboral?: string | null
          tiene_aval_bancario?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          antiguedad_laboral_meses?: number | null
          created_at?: string
          deudas_conocidas?: boolean
          empresa_actual?: string | null
          id?: string
          ingresos_mensuales?: number | null
          ingresos_tipo?: string | null
          inquilino_id?: string
          ratio_esfuerzo?: number | null
          renta_maxima_estimada?: number | null
          scoring_estado?: string
          scoring_notas?: string | null
          situacion_laboral?: string | null
          tiene_aval_bancario?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquilino_perfil_economico_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: true
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
        ]
      }
      inquilinos: {
        Row: {
          apellidos: string | null
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          deposito_garantia: number | null
          dni: string | null
          email: string | null
          estado: string | null
          fecha_entrada: string | null
          fecha_salida: string | null
          fianza: number | null
          id: string
          nombre: string
          notas: string | null
          orden: number | null
          property_id: string | null
          renta_mensual: number | null
          rol_inquilino: string | null
          telefono: string | null
          tipo_inquilino: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apellidos?: string | null
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deposito_garantia?: number | null
          dni?: string | null
          email?: string | null
          estado?: string | null
          fecha_entrada?: string | null
          fecha_salida?: string | null
          fianza?: number | null
          id?: string
          nombre: string
          notas?: string | null
          orden?: number | null
          property_id?: string | null
          renta_mensual?: number | null
          rol_inquilino?: string | null
          telefono?: string | null
          tipo_inquilino?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apellidos?: string | null
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deposito_garantia?: number | null
          dni?: string | null
          email?: string | null
          estado?: string | null
          fecha_entrada?: string | null
          fecha_salida?: string | null
          fianza?: number | null
          id?: string
          nombre?: string
          notas?: string | null
          orden?: number | null
          property_id?: string | null
          renta_mensual?: number | null
          rol_inquilino?: string | null
          telefono?: string | null
          tipo_inquilino?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquilinos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      locales_naves: {
        Row: {
          altura_libre: number | null
          ano_compra: number | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          cuota_comunidad: number | null
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          numero_portal: string | null
          planta: string | null
          provincia: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_carga_descarga: boolean | null
          tiene_escaparate: boolean | null
          tiene_usufructo: boolean
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          uso_permitido: string | null
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          altura_libre?: number | null
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_carga_descarga?: boolean | null
          tiene_escaparate?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          uso_permitido?: string | null
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          altura_libre?: number | null
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_carga_descarga?: boolean | null
          tiene_escaparate?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          uso_permitido?: string | null
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          enlace: string | null
          id: string
          leida: boolean
          mensaje: string
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enlace?: string | null
          id?: string
          leida?: boolean
          mensaje: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          enlace?: string | null
          id?: string
          leida?: boolean
          mensaje?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      oficinas: {
        Row: {
          ano_compra: number | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          cuota_comunidad: number | null
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          num_banos: number | null
          num_despachos: number | null
          numero_portal: string | null
          planta: string | null
          provincia: string | null
          puerta: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_aire_acondicionado: boolean | null
          tiene_ascensor: boolean | null
          tiene_calefaccion: boolean | null
          tiene_usufructo: boolean
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          num_banos?: number | null
          num_despachos?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          puerta?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_aire_acondicionado?: boolean | null
          tiene_ascensor?: boolean | null
          tiene_calefaccion?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          num_banos?: number | null
          num_despachos?: number | null
          numero_portal?: string | null
          planta?: string | null
          provincia?: string | null
          puerta?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_aire_acondicionado?: boolean | null
          tiene_ascensor?: boolean | null
          tiene_calefaccion?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      pago_compensaciones: {
        Row: {
          anio: number
          contrato_id: string | null
          crear_gasto: boolean
          created_at: string
          deducible: boolean
          descripcion: string | null
          documento_path: string | null
          documento_url: string | null
          factura_id: string | null
          id: string
          importe: number
          inquilino_id: string | null
          mes: number
          motivo: string
          pago_renta_id: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anio: number
          contrato_id?: string | null
          crear_gasto?: boolean
          created_at?: string
          deducible?: boolean
          descripcion?: string | null
          documento_path?: string | null
          documento_url?: string | null
          factura_id?: string | null
          id?: string
          importe?: number
          inquilino_id?: string | null
          mes: number
          motivo?: string
          pago_renta_id: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anio?: number
          contrato_id?: string | null
          crear_gasto?: boolean
          created_at?: string
          deducible?: boolean
          descripcion?: string | null
          documento_path?: string | null
          documento_url?: string | null
          factura_id?: string | null
          id?: string
          importe?: number
          inquilino_id?: string | null
          mes?: number
          motivo?: string
          pago_renta_id?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pagos_renta: {
        Row: {
          afecta_finanzas_actuales: boolean
          afecta_fiscalidad: boolean
          anio: number
          contrato_id: string | null
          created_at: string
          fecha_devengo: string
          fecha_pago_real: string | null
          id: string
          importe_pagado: number | null
          inquilino_id: string
          inquilino_notificado: boolean
          inquilino_notificado_at: string | null
          mes: number
          notas_acuerdo: string | null
          origen: string
          property_id: string
          propietario_confirmado: boolean
          propietario_confirmado_at: string | null
          tipo_pago: string | null
          tipo_registro: string
          updated_at: string
          user_id: string
        }
        Insert: {
          afecta_finanzas_actuales?: boolean
          afecta_fiscalidad?: boolean
          anio: number
          contrato_id?: string | null
          created_at?: string
          fecha_devengo: string
          fecha_pago_real?: string | null
          id?: string
          importe_pagado?: number | null
          inquilino_id: string
          inquilino_notificado?: boolean
          inquilino_notificado_at?: string | null
          mes: number
          notas_acuerdo?: string | null
          origen?: string
          property_id: string
          propietario_confirmado?: boolean
          propietario_confirmado_at?: string | null
          tipo_pago?: string | null
          tipo_registro?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          afecta_finanzas_actuales?: boolean
          afecta_fiscalidad?: boolean
          anio?: number
          contrato_id?: string | null
          created_at?: string
          fecha_devengo?: string
          fecha_pago_real?: string | null
          id?: string
          importe_pagado?: number | null
          inquilino_id?: string
          inquilino_notificado?: boolean
          inquilino_notificado_at?: string | null
          mes?: number
          notas_acuerdo?: string | null
          origen?: string
          property_id?: string
          propietario_confirmado?: boolean
          propietario_confirmado_at?: string | null
          tipo_pago?: string | null
          tipo_registro?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_renta_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_renta_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_renta_reconciliacion: {
        Row: {
          categoria: string
          contrato_id: string | null
          created_at: string
          decidido_at: string
          decidido_por: string | null
          decision: string
          id: string
          motivo: string | null
          pago_id: string
          pago_relacionado_id: string | null
          payload_original: Json | null
          property_id: string | null
          user_id: string
        }
        Insert: {
          categoria: string
          contrato_id?: string | null
          created_at?: string
          decidido_at?: string
          decidido_por?: string | null
          decision: string
          id?: string
          motivo?: string | null
          pago_id: string
          pago_relacionado_id?: string | null
          payload_original?: Json | null
          property_id?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          contrato_id?: string | null
          created_at?: string
          decidido_at?: string
          decidido_por?: string | null
          decision?: string
          id?: string
          motivo?: string | null
          pago_id?: string
          pago_relacionado_id?: string | null
          payload_original?: Json | null
          property_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      perf_metrics: {
        Row: {
          context: Json | null
          created_at: string
          duration_ms: number
          error_type: string | null
          event_name: string
          id: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          duration_ms: number
          error_type?: string | null
          event_name: string
          id?: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          duration_ms?: number
          error_type?: string | null
          event_name?: string
          id?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellidos: string | null
          completed: boolean | null
          created_at: string
          direccion: string | null
          email: string | null
          iban: string | null
          id: string
          nif: string | null
          nombre: string | null
          preferencia_contacto: string | null
          telefono: string | null
          telefono_bizum: string | null
          updated_at: string
          user_id: string
          whatsapp_app: string
        }
        Insert: {
          apellidos?: string | null
          completed?: boolean | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          nif?: string | null
          nombre?: string | null
          preferencia_contacto?: string | null
          telefono?: string | null
          telefono_bizum?: string | null
          updated_at?: string
          user_id: string
          whatsapp_app?: string
        }
        Update: {
          apellidos?: string | null
          completed?: boolean | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          nif?: string | null
          nombre?: string | null
          preferencia_contacto?: string | null
          telefono?: string | null
          telefono_bizum?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_app?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          admin_fincas_email: string | null
          admin_fincas_empresa: string | null
          admin_fincas_nif: string | null
          admin_fincas_nombre: string | null
          admin_fincas_notas: string | null
          admin_fincas_telefono: string | null
          agua_incluida_comunidad: boolean
          agua_paga_inquilino: boolean
          altura_libre: number | null
          amueblada: boolean | null
          ano_actualizacion_canerias: number | null
          ano_compra: number | null
          ano_construccion: number | null
          bano_privado: boolean | null
          basuras_fecha_pago: string | null
          basuras_importe: number | null
          basuras_paga_inquilino: boolean
          bloque: string | null
          calefaccion_incluida_comunidad: boolean
          calefaccion_paga_inquilino: boolean
          calificacion_energetica: string | null
          calificacion_urbanistica: string | null
          caracteristicas_detalle: Json
          cee_fecha_emision: string | null
          cee_numero_registro: string | null
          ciudad: string | null
          cocina_equipamiento: string[] | null
          codigo_postal: string | null
          compartir_habilitado: boolean | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          cuota_comunidad: number | null
          cuota_comunidad_frecuencia: string | null
          datos_empresa_administracion: string | null
          deleted_at: string | null
          derrama_concepto: string | null
          derrama_fecha_inicio: string | null
          derrama_importe_cuota: number | null
          derrama_incluida_comunidad: boolean | null
          derrama_num_cuotas: number | null
          direccion_completa: string | null
          email_presidente: string | null
          escalera: string | null
          estado: string | null
          estado_banos: string | null
          estado_canerias: string | null
          estado_cocina: string | null
          estado_electricidad: string | null
          estado_general: string | null
          estado_paredes: string | null
          fecha_fin_derrama: string | null
          forma_pago_derrama: string | null
          fuente_estimacion: string | null
          gas_paga_inquilino: boolean
          gastos_compra: number | null
          gestor_email: string | null
          gestor_empresa: string | null
          gestor_nif: string | null
          gestor_nombre: string | null
          gestor_notas: string | null
          gestor_telefono: string | null
          ibi_fecha_pago: string | null
          ibi_importe: number | null
          ibi_paga_inquilino: boolean
          id: string
          importe_derrama: number | null
          inquilino_nombre: string | null
          internet_paga_inquilino: boolean
          latitud: number | null
          longitud: number | null
          luz_paga_inquilino: boolean
          municipio: string | null
          nombre_administracion: string | null
          nombre_interno: string
          nombre_presidente: string | null
          nombre_via: string | null
          num_banos: number | null
          num_camas: number | null
          num_despachos: number | null
          num_finca_registral: string | null
          num_garajes: number | null
          num_habitaciones: number | null
          num_locales: number | null
          num_plantas: number | null
          num_plazas: number | null
          num_viviendas: number | null
          numero: string | null
          numero_portal: string | null
          otros_datos: string | null
          pais: string | null
          parcela: string | null
          planta: string | null
          planta_sotano: string | null
          portal: string | null
          presidente_vivienda: string | null
          provincia: string | null
          puente_termico: boolean | null
          puerta: string | null
          referencia_catastral: string | null
          salud_ingresos: string | null
          seguro_impago_paga_inquilino: boolean
          seguros: Json | null
          superficie_m2: number | null
          telefono_presidente: string | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_acceso_rodado: boolean | null
          tiene_agua: boolean | null
          tiene_aire_acondicionado: boolean | null
          tiene_armario: boolean | null
          tiene_ascensor: boolean | null
          tiene_balcon: boolean | null
          tiene_calefaccion: boolean | null
          tiene_carga_descarga: boolean | null
          tiene_cerradura: boolean | null
          tiene_certificado_energetico: boolean | null
          tiene_derrama: boolean | null
          tiene_escaparate: boolean | null
          tiene_luz: boolean | null
          tiene_patio: boolean | null
          tiene_puerta_automatica: boolean | null
          tiene_terraza: boolean | null
          tiene_usufructo: boolean
          tiene_vallado: boolean | null
          tiene_ventana: boolean | null
          tipo_aire_acondicionado: string | null
          tipo_alquiler: string | null
          tipo_calefaccion: string | null
          tipo_inmueble: string
          tipo_plaza: string | null
          tipo_suelos: string | null
          tipo_ventanas: string | null
          tipo_via: string | null
          tipo_vivienda: string | null
          titularidad: string
          titularidad_detalle: Json
          ubicacion_aire: string | null
          updated_at: string
          urbanizacion: string | null
          user_id: string
          uso_permitido: string | null
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_catastral: number | null
          valor_compra: number | null
          valor_estimado: number | null
          valor_mercado_manual: number | null
        }
        Insert: {
          admin_fincas_email?: string | null
          admin_fincas_empresa?: string | null
          admin_fincas_nif?: string | null
          admin_fincas_nombre?: string | null
          admin_fincas_notas?: string | null
          admin_fincas_telefono?: string | null
          agua_incluida_comunidad?: boolean
          agua_paga_inquilino?: boolean
          altura_libre?: number | null
          amueblada?: boolean | null
          ano_actualizacion_canerias?: number | null
          ano_compra?: number | null
          ano_construccion?: number | null
          bano_privado?: boolean | null
          basuras_fecha_pago?: string | null
          basuras_importe?: number | null
          basuras_paga_inquilino?: boolean
          bloque?: string | null
          calefaccion_incluida_comunidad?: boolean
          calefaccion_paga_inquilino?: boolean
          calificacion_energetica?: string | null
          calificacion_urbanistica?: string | null
          caracteristicas_detalle?: Json
          cee_fecha_emision?: string | null
          cee_numero_registro?: string | null
          ciudad?: string | null
          cocina_equipamiento?: string[] | null
          codigo_postal?: string | null
          compartir_habilitado?: boolean | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          cuota_comunidad_frecuencia?: string | null
          datos_empresa_administracion?: string | null
          deleted_at?: string | null
          derrama_concepto?: string | null
          derrama_fecha_inicio?: string | null
          derrama_importe_cuota?: number | null
          derrama_incluida_comunidad?: boolean | null
          derrama_num_cuotas?: number | null
          direccion_completa?: string | null
          email_presidente?: string | null
          escalera?: string | null
          estado?: string | null
          estado_banos?: string | null
          estado_canerias?: string | null
          estado_cocina?: string | null
          estado_electricidad?: string | null
          estado_general?: string | null
          estado_paredes?: string | null
          fecha_fin_derrama?: string | null
          forma_pago_derrama?: string | null
          fuente_estimacion?: string | null
          gas_paga_inquilino?: boolean
          gastos_compra?: number | null
          gestor_email?: string | null
          gestor_empresa?: string | null
          gestor_nif?: string | null
          gestor_nombre?: string | null
          gestor_notas?: string | null
          gestor_telefono?: string | null
          ibi_fecha_pago?: string | null
          ibi_importe?: number | null
          ibi_paga_inquilino?: boolean
          id?: string
          importe_derrama?: number | null
          inquilino_nombre?: string | null
          internet_paga_inquilino?: boolean
          latitud?: number | null
          longitud?: number | null
          luz_paga_inquilino?: boolean
          municipio?: string | null
          nombre_administracion?: string | null
          nombre_interno: string
          nombre_presidente?: string | null
          nombre_via?: string | null
          num_banos?: number | null
          num_camas?: number | null
          num_despachos?: number | null
          num_finca_registral?: string | null
          num_garajes?: number | null
          num_habitaciones?: number | null
          num_locales?: number | null
          num_plantas?: number | null
          num_plazas?: number | null
          num_viviendas?: number | null
          numero?: string | null
          numero_portal?: string | null
          otros_datos?: string | null
          pais?: string | null
          parcela?: string | null
          planta?: string | null
          planta_sotano?: string | null
          portal?: string | null
          presidente_vivienda?: string | null
          provincia?: string | null
          puente_termico?: boolean | null
          puerta?: string | null
          referencia_catastral?: string | null
          salud_ingresos?: string | null
          seguro_impago_paga_inquilino?: boolean
          seguros?: Json | null
          superficie_m2?: number | null
          telefono_presidente?: string | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_acceso_rodado?: boolean | null
          tiene_agua?: boolean | null
          tiene_aire_acondicionado?: boolean | null
          tiene_armario?: boolean | null
          tiene_ascensor?: boolean | null
          tiene_balcon?: boolean | null
          tiene_calefaccion?: boolean | null
          tiene_carga_descarga?: boolean | null
          tiene_cerradura?: boolean | null
          tiene_certificado_energetico?: boolean | null
          tiene_derrama?: boolean | null
          tiene_escaparate?: boolean | null
          tiene_luz?: boolean | null
          tiene_patio?: boolean | null
          tiene_puerta_automatica?: boolean | null
          tiene_terraza?: boolean | null
          tiene_usufructo?: boolean
          tiene_vallado?: boolean | null
          tiene_ventana?: boolean | null
          tipo_aire_acondicionado?: string | null
          tipo_alquiler?: string | null
          tipo_calefaccion?: string | null
          tipo_inmueble?: string
          tipo_plaza?: string | null
          tipo_suelos?: string | null
          tipo_ventanas?: string | null
          tipo_via?: string | null
          tipo_vivienda?: string | null
          titularidad?: string
          titularidad_detalle?: Json
          ubicacion_aire?: string | null
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          uso_permitido?: string | null
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_catastral?: number | null
          valor_compra?: number | null
          valor_estimado?: number | null
          valor_mercado_manual?: number | null
        }
        Update: {
          admin_fincas_email?: string | null
          admin_fincas_empresa?: string | null
          admin_fincas_nif?: string | null
          admin_fincas_nombre?: string | null
          admin_fincas_notas?: string | null
          admin_fincas_telefono?: string | null
          agua_incluida_comunidad?: boolean
          agua_paga_inquilino?: boolean
          altura_libre?: number | null
          amueblada?: boolean | null
          ano_actualizacion_canerias?: number | null
          ano_compra?: number | null
          ano_construccion?: number | null
          bano_privado?: boolean | null
          basuras_fecha_pago?: string | null
          basuras_importe?: number | null
          basuras_paga_inquilino?: boolean
          bloque?: string | null
          calefaccion_incluida_comunidad?: boolean
          calefaccion_paga_inquilino?: boolean
          calificacion_energetica?: string | null
          calificacion_urbanistica?: string | null
          caracteristicas_detalle?: Json
          cee_fecha_emision?: string | null
          cee_numero_registro?: string | null
          ciudad?: string | null
          cocina_equipamiento?: string[] | null
          codigo_postal?: string | null
          compartir_habilitado?: boolean | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          cuota_comunidad?: number | null
          cuota_comunidad_frecuencia?: string | null
          datos_empresa_administracion?: string | null
          deleted_at?: string | null
          derrama_concepto?: string | null
          derrama_fecha_inicio?: string | null
          derrama_importe_cuota?: number | null
          derrama_incluida_comunidad?: boolean | null
          derrama_num_cuotas?: number | null
          direccion_completa?: string | null
          email_presidente?: string | null
          escalera?: string | null
          estado?: string | null
          estado_banos?: string | null
          estado_canerias?: string | null
          estado_cocina?: string | null
          estado_electricidad?: string | null
          estado_general?: string | null
          estado_paredes?: string | null
          fecha_fin_derrama?: string | null
          forma_pago_derrama?: string | null
          fuente_estimacion?: string | null
          gas_paga_inquilino?: boolean
          gastos_compra?: number | null
          gestor_email?: string | null
          gestor_empresa?: string | null
          gestor_nif?: string | null
          gestor_nombre?: string | null
          gestor_notas?: string | null
          gestor_telefono?: string | null
          ibi_fecha_pago?: string | null
          ibi_importe?: number | null
          ibi_paga_inquilino?: boolean
          id?: string
          importe_derrama?: number | null
          inquilino_nombre?: string | null
          internet_paga_inquilino?: boolean
          latitud?: number | null
          longitud?: number | null
          luz_paga_inquilino?: boolean
          municipio?: string | null
          nombre_administracion?: string | null
          nombre_interno?: string
          nombre_presidente?: string | null
          nombre_via?: string | null
          num_banos?: number | null
          num_camas?: number | null
          num_despachos?: number | null
          num_finca_registral?: string | null
          num_garajes?: number | null
          num_habitaciones?: number | null
          num_locales?: number | null
          num_plantas?: number | null
          num_plazas?: number | null
          num_viviendas?: number | null
          numero?: string | null
          numero_portal?: string | null
          otros_datos?: string | null
          pais?: string | null
          parcela?: string | null
          planta?: string | null
          planta_sotano?: string | null
          portal?: string | null
          presidente_vivienda?: string | null
          provincia?: string | null
          puente_termico?: boolean | null
          puerta?: string | null
          referencia_catastral?: string | null
          salud_ingresos?: string | null
          seguro_impago_paga_inquilino?: boolean
          seguros?: Json | null
          superficie_m2?: number | null
          telefono_presidente?: string | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_acceso_rodado?: boolean | null
          tiene_agua?: boolean | null
          tiene_aire_acondicionado?: boolean | null
          tiene_armario?: boolean | null
          tiene_ascensor?: boolean | null
          tiene_balcon?: boolean | null
          tiene_calefaccion?: boolean | null
          tiene_carga_descarga?: boolean | null
          tiene_cerradura?: boolean | null
          tiene_certificado_energetico?: boolean | null
          tiene_derrama?: boolean | null
          tiene_escaparate?: boolean | null
          tiene_luz?: boolean | null
          tiene_patio?: boolean | null
          tiene_puerta_automatica?: boolean | null
          tiene_terraza?: boolean | null
          tiene_usufructo?: boolean
          tiene_vallado?: boolean | null
          tiene_ventana?: boolean | null
          tipo_aire_acondicionado?: string | null
          tipo_alquiler?: string | null
          tipo_calefaccion?: string | null
          tipo_inmueble?: string
          tipo_plaza?: string | null
          tipo_suelos?: string | null
          tipo_ventanas?: string | null
          tipo_via?: string | null
          tipo_vivienda?: string | null
          titularidad?: string
          titularidad_detalle?: Json
          ubicacion_aire?: string | null
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          uso_permitido?: string | null
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_catastral?: number | null
          valor_compra?: number | null
          valor_estimado?: number | null
          valor_mercado_manual?: number | null
        }
        Relationships: []
      }
      property_documentos: {
        Row: {
          categoria: string
          created_at: string
          gasto_id: string | null
          id: string
          nombre_archivo: string | null
          property_id: string
          storage_path: string
          url: string | null
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          gasto_id?: string | null
          id?: string
          nombre_archivo?: string | null
          property_id: string
          storage_path: string
          url?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          gasto_id?: string | null
          id?: string
          nombre_archivo?: string | null
          property_id?: string
          storage_path?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documentos_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "property_gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documentos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_eventos: {
        Row: {
          created_at: string
          descripcion: string | null
          fecha: string
          hora: string | null
          id: string
          importe: number | null
          property_id: string | null
          recurrencia_meses: number | null
          recurrente: boolean
          subtipo: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          visible_para_inquilino: boolean
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          fecha: string
          hora?: string | null
          id?: string
          importe?: number | null
          property_id?: string | null
          recurrencia_meses?: number | null
          recurrente?: boolean
          subtipo?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
          visible_para_inquilino?: boolean
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          importe?: number | null
          property_id?: string | null
          recurrencia_meses?: number | null
          recurrente?: boolean
          subtipo?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          visible_para_inquilino?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "property_eventos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_gastos: {
        Row: {
          archivo_url: string | null
          categoria: string
          concepto: string | null
          created_at: string
          factura_id: string | null
          fecha: string
          fecha_devengo: string | null
          fecha_fin: string | null
          gasto_compartido: boolean
          id: string
          importe: number
          nif_proveedor: string | null
          notas: string | null
          ocr_procesado: boolean
          porcentaje_usuario: number | null
          property_id: string | null
          proveedor_id: string | null
          recurrencia: string | null
          recurrente: boolean
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archivo_url?: string | null
          categoria?: string
          concepto?: string | null
          created_at?: string
          factura_id?: string | null
          fecha: string
          fecha_devengo?: string | null
          fecha_fin?: string | null
          gasto_compartido?: boolean
          id?: string
          importe?: number
          nif_proveedor?: string | null
          notas?: string | null
          ocr_procesado?: boolean
          porcentaje_usuario?: number | null
          property_id?: string | null
          proveedor_id?: string | null
          recurrencia?: string | null
          recurrente?: boolean
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archivo_url?: string | null
          categoria?: string
          concepto?: string | null
          created_at?: string
          factura_id?: string | null
          fecha?: string
          fecha_devengo?: string | null
          fecha_fin?: string | null
          gasto_compartido?: boolean
          id?: string
          importe?: number
          nif_proveedor?: string | null
          notas?: string | null
          ocr_procesado?: boolean
          porcentaje_usuario?: number | null
          property_id?: string | null
          proveedor_id?: string | null
          recurrencia?: string | null
          recurrente?: boolean
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_gastos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_gastos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      property_impuestos: {
        Row: {
          created_at: string
          forma_pago: string | null
          id: string
          importe_anual: number | null
          observaciones: string | null
          periodo_pago: string | null
          property_id: string
          responsable: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forma_pago?: string | null
          id?: string
          importe_anual?: number | null
          observaciones?: string | null
          periodo_pago?: string | null
          property_id: string
          responsable?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forma_pago?: string | null
          id?: string
          importe_anual?: number | null
          observaciones?: string | null
          periodo_pago?: string | null
          property_id?: string
          responsable?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_impuestos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_mensajes: {
        Row: {
          autor: string
          created_at: string
          id: string
          incidencia_id: string | null
          mensaje: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autor: string
          created_at?: string
          id?: string
          incidencia_id?: string | null
          mensaje: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autor?: string
          created_at?: string
          id?: string
          incidencia_id?: string | null
          mensaje?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_mensajes_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_mensajes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          created_at: string
          es_principal: boolean | null
          id: string
          orden: number | null
          property_id: string
          storage_path: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          es_principal?: boolean | null
          id?: string
          orden?: number | null
          property_id: string
          storage_path: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          es_principal?: boolean | null
          id?: string
          orden?: number | null
          property_id?: string
          storage_path?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_seguros: {
        Row: {
          compania: string | null
          created_at: string
          email: string | null
          estado: string | null
          fecha_inicio: string | null
          fecha_renovacion: string | null
          id: string
          num_poliza: string | null
          observaciones: string | null
          periodicidad: string | null
          prima: number | null
          property_id: string
          telefono: string | null
          tipo: string
          tomador: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compania?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          fecha_inicio?: string | null
          fecha_renovacion?: string | null
          id?: string
          num_poliza?: string | null
          observaciones?: string | null
          periodicidad?: string | null
          prima?: number | null
          property_id: string
          telefono?: string | null
          tipo?: string
          tomador?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compania?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          fecha_inicio?: string | null
          fecha_renovacion?: string | null
          id?: string
          num_poliza?: string | null
          observaciones?: string | null
          periodicidad?: string | null
          prima?: number | null
          property_id?: string
          telefono?: string | null
          tipo?: string
          tomador?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_seguros_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          cif: string | null
          codigo_postal: string | null
          created_at: string
          direccion: string | null
          email: string | null
          es_habitual: boolean
          especialidad: string | null
          id: string
          municipio: string | null
          nombre: string
          nombre_comercial: string | null
          notas: string | null
          persona_contacto: string | null
          provincia: string | null
          telefono: string | null
          updated_at: string
          user_id: string
          valoracion: number | null
          web: string | null
        }
        Insert: {
          activo?: boolean
          cif?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          es_habitual?: boolean
          especialidad?: string | null
          id?: string
          municipio?: string | null
          nombre: string
          nombre_comercial?: string | null
          notas?: string | null
          persona_contacto?: string | null
          provincia?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
          valoracion?: number | null
          web?: string | null
        }
        Update: {
          activo?: boolean
          cif?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          es_habitual?: boolean
          especialidad?: string | null
          id?: string
          municipio?: string | null
          nombre?: string
          nombre_comercial?: string | null
          notas?: string | null
          persona_contacto?: string | null
          provincia?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
          valoracion?: number | null
          web?: string | null
        }
        Relationships: []
      }
      recordatorios: {
        Row: {
          completado_at: string | null
          created_at: string
          descartado_at: string | null
          descripcion: string | null
          estado: Database["public"]["Enums"]["recordatorio_estado"]
          fecha_objetivo: string | null
          id: string
          origen_id: string
          origen_tipo: string
          prioridad: number
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completado_at?: string | null
          created_at?: string
          descartado_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["recordatorio_estado"]
          fecha_objetivo?: string | null
          id?: string
          origen_id: string
          origen_tipo: string
          prioridad?: number
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completado_at?: string | null
          created_at?: string
          descartado_at?: string | null
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["recordatorio_estado"]
          fecha_objetivo?: string | null
          id?: string
          origen_id?: string
          origen_tipo?: string
          prioridad?: number
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      renta_actualizaciones: {
        Row: {
          contrato_id: string | null
          created_at: string
          fecha_efectiva: string
          id: string
          importe_anterior: number | null
          importe_nuevo: number
          ipc_porcentaje: number | null
          motivo: string | null
          notas: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          fecha_efectiva: string
          id?: string
          importe_anterior?: number | null
          importe_nuevo: number
          ipc_porcentaje?: number | null
          motivo?: string | null
          notas?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          fecha_efectiva?: string
          id?: string
          importe_anterior?: number | null
          importe_nuevo?: number
          ipc_porcentaje?: number | null
          motivo?: string | null
          notas?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renta_actualizaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_arrendamiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renta_actualizaciones_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      seguro_impago_inquilinos: {
        Row: {
          id: string
          inquilino_id: string
          seguro_impago_id: string
        }
        Insert: {
          id?: string
          inquilino_id: string
          seguro_impago_id: string
        }
        Update: {
          id?: string
          inquilino_id?: string
          seguro_impago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguro_impago_inquilinos_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "inquilinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguro_impago_inquilinos_seguro_impago_id_fkey"
            columns: ["seguro_impago_id"]
            isOneToOne: false
            referencedRelation: "seguros_impago"
            referencedColumns: ["id"]
          },
        ]
      }
      seguros_impago: {
        Row: {
          compania: string | null
          contrato_id: string | null
          created_at: string
          email: string | null
          estado: string | null
          fecha_inicio: string | null
          fecha_renovacion: string | null
          id: string
          num_poliza: string | null
          observaciones: string | null
          periodicidad: string | null
          prima: number | null
          property_id: string | null
          telefono: string | null
          tomador: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compania?: string | null
          contrato_id?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          fecha_inicio?: string | null
          fecha_renovacion?: string | null
          id?: string
          num_poliza?: string | null
          observaciones?: string | null
          periodicidad?: string | null
          prima?: number | null
          property_id?: string | null
          telefono?: string | null
          tomador?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compania?: string | null
          contrato_id?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          fecha_inicio?: string | null
          fecha_renovacion?: string | null
          id?: string
          num_poliza?: string | null
          observaciones?: string | null
          periodicidad?: string | null
          prima?: number | null
          property_id?: string | null
          telefono?: string | null
          tomador?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguros_impago_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_arrendamiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguros_impago_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      terrenos: {
        Row: {
          ano_compra: number | null
          calificacion_urbanistica: string | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          provincia: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_acceso_rodado: boolean | null
          tiene_agua: boolean | null
          tiene_luz: boolean | null
          tiene_usufructo: boolean
          tiene_vallado: boolean | null
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          calificacion_urbanistica?: string | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_acceso_rodado?: boolean | null
          tiene_agua?: boolean | null
          tiene_luz?: boolean | null
          tiene_usufructo?: boolean
          tiene_vallado?: boolean | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          calificacion_urbanistica?: string | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_acceso_rodado?: boolean | null
          tiene_agua?: boolean | null
          tiene_luz?: boolean | null
          tiene_usufructo?: boolean
          tiene_vallado?: boolean | null
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      trasteros: {
        Row: {
          ano_compra: number | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          copropietarios: Json | null
          created_at: string
          direccion_completa: string | null
          estado: string | null
          gastos_compra: number | null
          id: string
          municipio: string | null
          nombre_interno: string
          notas: string | null
          numero_portal: string | null
          planta: string | null
          planta_sotano: string | null
          provincia: string | null
          referencia_catastral: string | null
          superficie_m2: number | null
          tercero_dni: string | null
          tercero_email: string | null
          tercero_nombre: string | null
          tercero_telefono: string | null
          tiene_cerradura: boolean | null
          tiene_usufructo: boolean
          tipo_via: string | null
          titularidad: string
          updated_at: string
          urbanizacion: string | null
          user_id: string
          usufructuario_dni: string | null
          usufructuario_email: string | null
          usufructuario_nombre: string | null
          usufructuario_telefono: string | null
          valor_compra: number | null
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno: string
          notas?: string | null
          numero_portal?: string | null
          planta?: string | null
          planta_sotano?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_cerradura?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          copropietarios?: Json | null
          created_at?: string
          direccion_completa?: string | null
          estado?: string | null
          gastos_compra?: number | null
          id?: string
          municipio?: string | null
          nombre_interno?: string
          notas?: string | null
          numero_portal?: string | null
          planta?: string | null
          planta_sotano?: string | null
          provincia?: string | null
          referencia_catastral?: string | null
          superficie_m2?: number | null
          tercero_dni?: string | null
          tercero_email?: string | null
          tercero_nombre?: string | null
          tercero_telefono?: string | null
          tiene_cerradura?: boolean | null
          tiene_usufructo?: boolean
          tipo_via?: string | null
          titularidad?: string
          updated_at?: string
          urbanizacion?: string | null
          user_id?: string
          usufructuario_dni?: string | null
          usufructuario_email?: string | null
          usufructuario_nombre?: string | null
          usufructuario_telefono?: string | null
          valor_compra?: number | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_tenant_auth: { Args: { p_email: string }; Returns: Json }
    }
    Enums: {
      app_role: "propietario" | "inquilino"
      documento_entidad:
        | "activo"
        | "contrato"
        | "incidencia"
        | "inquilino"
        | "factura"
        | "gasto"
      documento_estado_revision: "pendiente" | "revisado" | "caducado"
      documento_ocr_status:
        | "pending"
        | "processing"
        | "ok"
        | "error"
        | "skipped"
      recordatorio_estado: "pendiente" | "completado" | "descartado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["propietario", "inquilino"],
      documento_entidad: [
        "activo",
        "contrato",
        "incidencia",
        "inquilino",
        "factura",
        "gasto",
      ],
      documento_estado_revision: ["pendiente", "revisado", "caducado"],
      documento_ocr_status: ["pending", "processing", "ok", "error", "skipped"],
      recordatorio_estado: ["pendiente", "completado", "descartado"],
    },
  },
} as const
