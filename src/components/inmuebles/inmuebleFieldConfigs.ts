import type { FieldConfig } from "./InmuebleDetailSheet";

export const habitacionFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "num_camas", label: "Nº de camas", type: "number", group: "Características" },
  { key: "amueblada", label: "Amueblada", type: "switch", group: "Características" },
  { key: "bano_privado", label: "Baño privado", type: "switch", group: "Características" },
  { key: "tiene_ventana", label: "Tiene ventana", type: "switch", group: "Características" },
  { key: "tiene_armario", label: "Tiene armario", type: "switch", group: "Características" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilada", label: "Alquilada" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const garajeFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "num_plazas", label: "Nº de plazas", type: "number", group: "Características" },
  { key: "tipo_plaza", label: "Tipo de plaza", type: "select", options: [{ value: "individual", label: "Individual" }, { value: "doble", label: "Doble" }, { value: "moto", label: "Moto" }], group: "Características" },
  { key: "tiene_puerta_automatica", label: "Puerta automática", type: "switch", group: "Características" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilado", label: "Alquilado" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const trasteroFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "planta_sotano", label: "Planta/Sótano", type: "text", placeholder: "-1, -2...", group: "Características" },
  { key: "tiene_cerradura", label: "Tiene cerradura", type: "switch", group: "Características" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilado", label: "Alquilado" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const oficinaFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "num_despachos", label: "Nº despachos", type: "number", group: "Características" },
  { key: "num_banos", label: "Nº baños", type: "number", group: "Características" },
  { key: "tiene_ascensor", label: "Ascensor", type: "switch", group: "Características" },
  { key: "tiene_aire_acondicionado", label: "Aire acondicionado", type: "switch", group: "Características" },
  { key: "tiene_calefaccion", label: "Calefacción", type: "switch", group: "Características" },
  { key: "cuota_comunidad", label: "Cuota comunidad", type: "number", suffix: "€/mes", group: "Gastos" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilada", label: "Alquilada" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const localNaveFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "altura_libre", label: "Altura libre", type: "number", suffix: "m", group: "Características" },
  { key: "uso_permitido", label: "Uso permitido", type: "text", group: "Características" },
  { key: "tiene_escaparate", label: "Escaparate", type: "switch", group: "Características" },
  { key: "tiene_carga_descarga", label: "Carga/descarga", type: "switch", group: "Características" },
  { key: "cuota_comunidad", label: "Cuota comunidad", type: "number", suffix: "€/mes", group: "Gastos" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilado", label: "Alquilado" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const terrenoFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "calificacion_urbanistica", label: "Calificación", type: "select", options: [{ value: "urbano", label: "Urbano" }, { value: "rustico", label: "Rústico" }, { value: "urbanizable", label: "Urbanizable" }], group: "Características" },
  { key: "tiene_acceso_rodado", label: "Acceso rodado", type: "switch", group: "Servicios" },
  { key: "tiene_agua", label: "Agua", type: "switch", group: "Servicios" },
  { key: "tiene_luz", label: "Luz", type: "switch", group: "Servicios" },
  { key: "tiene_vallado", label: "Vallado", type: "switch", group: "Servicios" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilado", label: "Alquilado" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];

export const edificioFields: FieldConfig[] = [
  { key: "superficie_m2", label: "Superficie", type: "number", suffix: "m²", group: "Características" },
  { key: "num_plantas", label: "Nº plantas", type: "number", group: "Características" },
  { key: "num_viviendas", label: "Nº viviendas", type: "number", group: "Características" },
  { key: "num_locales", label: "Nº locales", type: "number", group: "Características" },
  { key: "num_garajes", label: "Nº garajes", type: "number", group: "Características" },
  { key: "ano_construccion", label: "Año construcción", type: "number", group: "Características" },
  { key: "cuota_comunidad", label: "Cuota comunidad", type: "number", suffix: "€/mes", group: "Gastos" },
  { key: "referencia_catastral", label: "Ref. catastral", type: "text", group: "Legal" },
  { key: "valor_compra", label: "Precio compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "ano_compra", label: "Año compra", type: "number", group: "Valoración" },
  { key: "gastos_compra", label: "Gastos compra", type: "number", suffix: "€", group: "Valoración" },
  { key: "valor_estimado", label: "Valor estimado", type: "number", suffix: "€", group: "Valoración" },
  { key: "estado", label: "Estado", type: "select", options: [{ value: "libre", label: "Libre" }, { value: "alquilado", label: "Alquilado" }, { value: "uso propio", label: "Uso propio" }], group: "Estado" },
  { key: "notas", label: "Notas", type: "textarea", group: "Notas" },
];
