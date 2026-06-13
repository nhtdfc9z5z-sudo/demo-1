import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProperties } from "./useProperties";
import { useInquilinos } from "./useInquilinos";
import { useContratos } from "./useContratos";
import { useFacturas } from "./useFacturas";
import { usePropertyGastos } from "./usePropertyGastos";
import { usePagosRenta } from "./usePagosRenta";
import { useIncidencias } from "./useIncidencias";

/**
 * `useFiscalSources(anio)`
 *
 * Capa única de OBTENCIÓN de datos fuente para la fiscalidad.
 * No calcula reglas fiscales. Eso es responsabilidad de `buildOwnerPack`
 * y de los selectores derivados en `useFiscalData`.
 *
 * Query keys de la cadena fiscal (ver `queryInvalidation.ts`):
 *  - ["fiscal-sources", anio, userId]
 *  - delegadas: ["properties"], ["inquilinos"], ["contratos"],
 *               ["facturas"], ["gastos"], ["pagos_renta"], ["incidencias"]
 */
export function useFiscalSources(anio: number) {
  const { user } = useAuth();
  const { properties } = useProperties();
  const { inquilinos } = useInquilinos();
  const { contratos } = useContratos();
  const { facturas } = useFacturas();
  const { gastos } = usePropertyGastos();
  const { pagos } = usePagosRenta({ asOwner: true, userId: user?.id });
  const { incidencias } = useIncidencias();

  const { data: extras, isLoading: extrasLoading } = useQuery({
    queryKey: ["fiscal-sources", "extras", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [segRes, impRes, taxRes] = await Promise.all([
        supabase.from("property_seguros").select("*").eq("user_id", user!.id),
        supabase.from("seguros_impago").select("*").eq("user_id", user!.id),
        supabase.from("property_impuestos").select("*").eq("user_id", user!.id),
      ]);
      return {
        propertySeguros: (segRes.data as any[]) || [],
        segurosImpago: (impRes.data as any[]) || [],
        impuestos: (taxRes.data as any[]) || [],
      };
    },
  });

  return {
    anio,
    properties,
    inquilinos,
    contratos,
    facturas,
    gastos,
    pagos,
    incidencias,
    propertySeguros: extras?.propertySeguros ?? [],
    segurosImpago: extras?.segurosImpago ?? [],
    impuestos: extras?.impuestos ?? [],
    loading: extrasLoading,
  };
}

export type FiscalSources = ReturnType<typeof useFiscalSources>;
