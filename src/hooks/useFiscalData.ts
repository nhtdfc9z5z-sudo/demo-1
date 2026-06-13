import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useFiscalSources } from "./useFiscalSources";
import { CATEGORIAS_GASTO } from "./usePropertyGastos";
import type { Property, InsuranceEntry } from "./useProperties";
import { getGastosFijosFromProperty as engineGetGastosFijos, pagoCuentaEnFiscalidad, getGastosFijosFiscalesAnuales } from "@/lib/finanzasEngine";
import { buildOwnerPack } from "@/lib/fiscalPack";
import { measureSync, captureAppError } from "@/lib/observability";
export interface FiscalPropertySummary {
  property: Property;
  ingresos: number;
  gastosManuales: number;
  gastosFijos: { categoria: string; concepto: string; importeAnual: number }[];
  facturas: { id: string; emisor: string | null; total: number | null; fecha: string | null; categoria: string | null; tieneArchivo: boolean; deducible: boolean }[];
  contratos: { id: string; titulo: string; fechaInicio: string | null; fechaFin: string | null; renta: number | null }[];
  inquilinos: { id: string; nombre: string; dni: string | null; renta: number | null }[];
  seguros: { tipo: string; compania: string | null; prima: number | null }[];
  incidenciasConCoste: { id: string; concepto: string | null; coste: number }[];
}

export interface FiscalNavigationTarget {
  tab: "propiedades" | "inquilinos" | "incidencias" | "finanzas" | "documentacion" | "fiscalidad";
  propertyId?: string;
  section?: "perfil" | "gestor" | "contrato" | "factura" | "seguro";
}

export interface FiscalValidation {
  tipo: "info" | "warning" | "error";
  mensaje: string;
  categoria: string;
  propertyName?: string;
  propertyId?: string;
  navigateTo?: FiscalNavigationTarget;
}

export interface FiscalTotals {
  ingresos: number;
  gastos: number;
  balance: number;
  gastosDeducibles: number;
  numInmuebles: number;
  numContratos: number;
  numFacturas: number;
  numDocumentos: number;
}

export type ExpedienteEstado = "incompleto" | "revisar" | "listo" | "enviado";

export function useFiscalData(anio: number) {
  const { profile } = useProfile();
  const sources = useFiscalSources(anio);
  const {
    properties, inquilinos, contratos, facturas, gastos, pagos, incidencias,
    propertySeguros, segurosImpago, impuestos, loading,
  } = sources;

  // Property summaries
  const propertySummaries = useMemo<FiscalPropertySummary[]>(() => {
    return properties.map(prop => {
      // Ingresos — fiscalidad usa fecha_devengo cuando existe y descarta históricos no fiscales.
      const propPagos = pagos.filter(p => p.property_id === prop.id && pagoCuentaEnFiscalidad(p, anio));
      const ingresos = propPagos.reduce((s, p) => s + Number(p.importe_pagado || 0), 0);

      // Gastos manuales
      const propGastos = gastos.filter(g => g.property_id === prop.id && g.fecha?.startsWith(`${anio}`));
      const gastosManuales = propGastos.reduce((s, g) => s + g.importe, 0);

      // Gastos fijos from centralized engine
      const engineFijos = engineGetGastosFijos(prop);
      const gastosFijos: { categoria: string; concepto: string; importeAnual: number }[] = engineFijos.map(g => ({
        categoria: g.categoria === "ibi" || g.categoria === "basuras" ? "impuestos" : g.categoria === "derrama" ? "derramas" : g.categoria === "seguro_vivienda" || g.categoria === "seguro_impago" ? "seguros" : g.categoria,
        concepto: g.concepto,
        importeAnual: g.recurrencia === "mensual" ? g.importe * 12 : g.recurrencia === "trimestral" ? g.importe * 4 : g.recurrencia === "semestral" ? g.importe * 2 : g.importe,
      }));
      // Seguros from property_seguros table
      const propSeguros = propertySeguros.filter(s => s.property_id === prop.id);
      const seguros = propSeguros.map(s => ({ tipo: s.tipo, compania: s.compania, prima: s.prima ? Number(s.prima) : null }));
      // Add seguros impago
      const propSegurosImpago = segurosImpago.filter(s => s.property_id === prop.id);
      propSegurosImpago.forEach(s => seguros.push({ tipo: "impago", compania: s.compania, prima: s.prima ? Number(s.prima) : null }));
      // Legacy seguros from JSON field
      const legacySeguros = (prop.seguros as unknown as InsuranceEntry[]) || [];
      legacySeguros.forEach(s => {
        if (s.importe && !propSeguros.some(ps => ps.num_poliza === s.num_poliza)) {
          seguros.push({ tipo: s.tipo || "hogar", compania: s.compania || null, prima: Number(s.importe) });
        }
      });
      seguros.forEach(s => {
        if (s.prima) gastosFijos.push({ categoria: "seguros", concepto: s.compania ? `Seguro ${s.tipo} · ${s.compania}` : `Seguro ${s.tipo}`, importeAnual: s.prima });
      });

      // Facturas
      const propFacturas = facturas.filter(f => f.property_id === prop.id && f.fecha?.startsWith(`${anio}`));

      // Contratos
      const propContratos = contratos.filter(c => c.property_id === prop.id && !c.archivado);

      // Inquilinos
      const propInquilinos = inquilinos.filter(i => i.property_id === prop.id && i.rol_inquilino !== "avalista");

      // Incidencias con coste
      const propIncidencias = incidencias.filter(i => i.property_id === prop.id && (Number(i.factura_total) > 0 || Number(i.presupuesto_total) > 0));

      return {
        property: prop,
        ingresos,
        gastosManuales,
        gastosFijos,
        facturas: propFacturas.map(f => ({ id: f.id, emisor: f.emisor_nombre, total: f.total, fecha: f.fecha, categoria: f.categoria, tieneArchivo: !!f.storage_path && f.storage_path !== "", deducible: f.deducible_irpf !== false })),
        contratos: propContratos.map(c => ({ id: c.id, titulo: c.titulo, fechaInicio: c.fecha_inicio, fechaFin: c.fecha_fin, renta: c.renta_mensual ? Number(c.renta_mensual) : null })),
        inquilinos: propInquilinos.map(i => {
          // Prefer contrato renta over inquilino legacy
          const activeContrato = propContratos.find(c => c.inquilino_id === i.id);
          const renta = activeContrato?.renta_mensual != null ? Number(activeContrato.renta_mensual) : (i.renta_mensual ? Number(i.renta_mensual) : null);
          return { id: i.id, nombre: `${i.nombre} ${i.apellidos || ""}`.trim(), dni: i.dni || null, renta };
        }),
        seguros,
        incidenciasConCoste: propIncidencias.map(i => ({ id: i.id, concepto: i.concepto, coste: Number(i.factura_total || i.presupuesto_total || 0) })),
      };
    });
  }, [properties, pagos, gastos, facturas, contratos, inquilinos, incidencias, propertySeguros, segurosImpago, anio]);

  // Totals
  // Totals — fuente única de verdad fiscal: `buildOwnerPack` (igual que el
  // PDF/Excel y el dialog "Enviar al gestor"). Esto evita que la cifra de
  // pantalla difiera de la del pack exportado.
  const totals = useMemo<FiscalTotals>(() => {
    let pack;
    try {
      pack = measureSync(
        "build_owner_pack_dashboard",
        {
          ejercicio: anio,
          num_inmuebles: properties.length,
          num_contratos: contratos.length,
          num_pagos: pagos.length,
          num_gastos: gastos.length,
          num_facturas: facturas.length,
        },
        () => {
          const gastosFijos = getGastosFijosFiscalesAnuales(properties);
          return buildOwnerPack(
            {
              properties: properties as any,
              pagos: pagos as any,
              gastos: gastos.map(g => ({
                id: g.id,
                property_id: g.property_id,
                categoria: g.categoria,
                concepto: g.concepto,
                importe: Number(g.importe || 0),
                fecha: g.fecha,
              })),
              facturas: facturas.map(f => ({
                id: f.id,
                property_id: f.property_id,
                emisor_nombre: f.emisor_nombre,
                total: f.total != null ? Number(f.total) : null,
                fecha: f.fecha,
                categoria: f.categoria,
                deducible_irpf: f.deducible_irpf,
              })),
              gastosFijos,
            },
            anio,
          );
        },
      );
    } catch (err) {
      void captureAppError({
        event: "fiscal_data.dashboard_build",
        message: "Fallo al construir totales fiscales del dashboard",
        severity: "critical",
        audit: true,
        error: err,
        context: {
          ejercicio: anio,
          num_inmuebles: properties.length,
          num_contratos: contratos.length,
          num_pagos: pagos.length,
          num_gastos: gastos.length,
          num_facturas: facturas.length,
        },
      });
      return {
        ingresos: 0, gastos: 0, gastosDeducibles: 0, balance: 0,
        numInmuebles: properties.length, numContratos: 0, numFacturas: 0, numDocumentos: 0,
      };
    }
    return {
      ingresos: pack.totalIngresosDeclarables,
      gastos: pack.totalGastosDeducibles,
      gastosDeducibles: pack.totalGastosDeducibles,
      balance: pack.totalNeto,
      numInmuebles: properties.length,
      numContratos: propertySummaries.reduce((s, p) => s + p.contratos.length, 0),
      numFacturas: propertySummaries.reduce((s, p) => s + p.facturas.length, 0),
      numDocumentos: propertySummaries.reduce((s, p) => s + p.facturas.filter(f => f.tieneArchivo).length, 0),
    };
  }, [properties, pagos, gastos, facturas, contratos, propertySummaries, anio]);

  // Grouped expenses
  const gastosAgrupados = useMemo(() => {
    const groups: Record<string, { label: string; total: number; items: { concepto: string; importe: number; propertyName: string; recurrente: boolean }[] }> = {
      comunidad: { label: "Comunidad", total: 0, items: [] },
      derramas: { label: "Derramas", total: 0, items: [] },
      seguros: { label: "Seguros", total: 0, items: [] },
      reparaciones: { label: "Reparaciones", total: 0, items: [] },
      impuestos: { label: "Impuestos y tasas", total: 0, items: [] },
      honorarios: { label: "Honorarios", total: 0, items: [] },
      otros: { label: "Otros gastos", total: 0, items: [] },
    };

    for (const ps of propertySummaries) {
      const pName = ps.property.nombre_interno;
      for (const gf of ps.gastosFijos) {
        const key = gf.categoria in groups ? gf.categoria : "otros";
        groups[key].total += gf.importeAnual;
        groups[key].items.push({ concepto: gf.concepto, importe: gf.importeAnual, propertyName: pName, recurrente: true });
      }
      // Manual gastos
      const propGastos = gastos.filter(g => g.property_id === ps.property.id && g.fecha?.startsWith(`${anio}`));
      for (const g of propGastos) {
        const catMap: Record<string, string> = {
          comunidad: "comunidad", derrama: "derramas", seguro_vivienda: "seguros", seguro_impago: "seguros",
          ibi: "impuestos", basuras: "impuestos", reformas: "reparaciones", mantenimiento: "reparaciones", arreglos: "reparaciones",
        };
        const key = catMap[g.categoria] || "otros";
        groups[key].total += g.importe;
        groups[key].items.push({ concepto: g.concepto || CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label || g.categoria, importe: g.importe, propertyName: pName, recurrente: g.recurrente });
      }
    }

    return Object.entries(groups).filter(([, v]) => v.total > 0).map(([key, v]) => ({ key, ...v }));
  }, [propertySummaries, gastos, anio]);

  // Validations
  const validations = useMemo<FiscalValidation[]>(() => {
    const vs: FiscalValidation[] = [];
    // Profile
    if (!profile.nombre || !profile.nif) vs.push({ tipo: "error", mensaje: "Faltan datos personales (nombre o NIF)", categoria: "perfil", navigateTo: { tab: "propiedades", section: "perfil" } });

    // Gestor
    const hasGestorData = properties.some(p => p.gestor_nombre || p.gestor_email);
    if (!hasGestorData && properties.length > 0) vs.push({ tipo: "info", mensaje: "No tienes datos de gestor registrados", categoria: "gestor", navigateTo: { tab: "propiedades", propertyId: properties[0]?.id, section: "gestor" } });

    for (const ps of propertySummaries) {
      const pName = ps.property.nombre_interno;
      const pId = ps.property.id;
      // Property completeness
      if (!ps.property.referencia_catastral) vs.push({ tipo: "warning", mensaje: "Sin referencia catastral", categoria: "inmueble", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });
      if (!ps.property.direccion_completa) vs.push({ tipo: "warning", mensaje: "Sin dirección completa", categoria: "inmueble", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });
      if (!ps.property.valor_compra && !ps.property.valor_estimado) vs.push({ tipo: "info", mensaje: "Sin valor de adquisición", categoria: "inmueble", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });

      // Titularidad validations
      const tit = (ps.property as any).titularidad;
      if (tit === "copropietarios") {
        const coprop = (ps.property as any).copropietarios as any[] || [];
        const sinDniCo = coprop.filter((c: any) => !c.dni);
        if (sinDniCo.length > 0) vs.push({ tipo: "warning", mensaje: `${sinDniCo.length} copropietario(s) sin DNI/NIE`, categoria: "titularidad", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });
        const sinPorcentaje = coprop.filter((c: any) => !c.porcentaje);
        if (sinPorcentaje.length > 0) vs.push({ tipo: "warning", mensaje: `${sinPorcentaje.length} copropietario(s) sin % de propiedad`, categoria: "titularidad", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });
      }
      if ((ps.property as any).tiene_usufructo) {
        if (!(ps.property as any).usufructuario_nombre || !(ps.property as any).usufructuario_dni) {
          vs.push({ tipo: "warning", mensaje: "Usufructuario sin nombre o DNI/NIE", categoria: "titularidad", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId } });
        }
      }

      // Contratos
      if (ps.inquilinos.length > 0 && ps.contratos.length === 0) vs.push({ tipo: "warning", mensaje: "Inquilino sin contrato vinculado", categoria: "contrato", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId, section: "contrato" } });

      // Inquilinos sin DNI
      const sinDni = ps.inquilinos.filter(i => !i.dni);
      if (sinDni.length > 0) vs.push({ tipo: "warning", mensaje: `${sinDni.length} inquilino(s) sin DNI/NIE`, categoria: "inquilino", propertyName: pName, propertyId: pId, navigateTo: { tab: "inquilinos", propertyId: pId } });

      // Facturas sin adjunto
      const sinAdjunto = ps.facturas.filter(f => !f.tieneArchivo);
      if (sinAdjunto.length > 0) vs.push({ tipo: "info", mensaje: `${sinAdjunto.length} factura(s) sin documento adjunto`, categoria: "factura", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId, section: "factura" } });

      // Seguros sin prima
      const sinPrima = ps.seguros.filter(s => !s.prima);
      if (sinPrima.length > 0) vs.push({ tipo: "info", mensaje: `${sinPrima.length} seguro(s) sin importe de prima`, categoria: "seguro", propertyName: pName, propertyId: pId, navigateTo: { tab: "propiedades", propertyId: pId, section: "seguro" } });
    }

    return vs;
  }, [profile, properties, propertySummaries]);

  // Estado
  const estado = useMemo<ExpedienteEstado>(() => {
    const errors = validations.filter(v => v.tipo === "error");
    const warnings = validations.filter(v => v.tipo === "warning");
    if (errors.length > 0) return "incompleto";
    if (warnings.length > 0) return "revisar";
    return "listo";
  }, [validations]);

  // Detected info summary
  const detectedInfo = useMemo(() => ({
    viviendas: properties.length,
    contratos: propertySummaries.reduce((s, p) => s + p.contratos.length, 0),
    inquilinos: propertySummaries.reduce((s, p) => s + p.inquilinos.length, 0),
    comunidades: properties.filter(p => p.cuota_comunidad).length,
    derramas: properties.filter(p => p.tiene_derrama && p.importe_derrama).length,
    seguros: propertySummaries.reduce((s, p) => s + p.seguros.length, 0),
    reparaciones: propertySummaries.reduce((s, p) => s + p.incidenciasConCoste.length, 0),
    impuestos: impuestos.length + properties.filter(p => p.ibi_importe).length,
    facturas: propertySummaries.reduce((s, p) => s + p.facturas.length, 0),
  }), [properties, propertySummaries, impuestos]);

  return {
    loading: loading || properties.length === 0,
    profile,
    properties,
    propertySummaries,
    totals,
    gastosAgrupados,
    validations,
    estado,
    detectedInfo,
    anio,
  };
}
