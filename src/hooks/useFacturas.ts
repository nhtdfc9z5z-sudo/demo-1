import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";
import { captureAppError } from "@/lib/observability";

export interface Factura {
  id: string;
  user_id: string;
  property_id: string | null;
  emisor_nombre: string | null;
  emisor_nif: string | null;
  receptor_nombre: string | null;
  receptor_nif: string | null;
  numero_factura: string | null;
  fecha: string | null;
  /** Fecha de devengo fiscal (opcional). Si está, se usa para imputar al ejercicio en lugar de `fecha`. */
  fecha_devengo?: string | null;
  base_imponible: number | null;
  iva_porcentaje: number | null;
  cuota_iva: number | null;
  total: number | null;
  archivo_nombre: string;
  archivo_url: string;
  storage_path: string;
  categoria: string | null;
  notas: string | null;
  fecha_pago: string | null;
  forma_pago: string | null;
  ano_fiscal: number | null;
  deducible_irpf: boolean | null;
  proveedor_id: string | null;
  created_at: string;
  updated_at: string;
}

export { TIPOS_GASTO as CATEGORIAS_FACTURA } from "@/components/propietarios/FacturaFormFields";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function useFacturas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["facturas", user?.id] as const;

  const { data: facturas = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at" as any, null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Factura[]) || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["facturas"] });
    invalidateFiscalChain(qc);
  };

  /** Upload file + save with form overrides */
  const uploadAndAnalyze = async (
    file: File,
    propertyId?: string | null,
    overrides?: Partial<Omit<Factura, "id" | "user_id" | "created_at" | "updated_at" | "archivo_nombre" | "archivo_url" | "storage_path">>
  ): Promise<Factura | null> => {
    if (!user) return null;

    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("facturas")
      .upload(storagePath, file);
    if (uploadError) {
      toast.error("Error al subir el archivo");
      void captureAppError({
        event: "facturas.upload",
        message: "Fallo al subir archivo de factura",
        severity: "error", error: uploadError,
        context: { property_id: propertyId || null },
      });
      return null;
    }

    // Bucket privado: firmamos al vuelo. El valor persistido es informativo
    // y caducará en 1h; los lectores deben resolver vía storage_path con
    // `resolveStorageUrl`/`SecureFileLink`.
    const { data: urlData } = await supabase.storage
      .from("facturas")
      .createSignedUrl(storagePath, 3600);
    const archivoUrl = urlData?.signedUrl || "";

    const insertData = {
      user_id: user.id,
      property_id: propertyId || null,
      emisor_nombre: overrides?.emisor_nombre ?? null,
      emisor_nif: overrides?.emisor_nif ?? null,
      receptor_nombre: overrides?.receptor_nombre ?? null,
      receptor_nif: overrides?.receptor_nif ?? null,
      numero_factura: overrides?.numero_factura ?? null,
      fecha: overrides?.fecha ?? null,
      fecha_devengo: overrides?.fecha_devengo ?? null,
      base_imponible: overrides?.base_imponible ?? null,
      iva_porcentaje: overrides?.iva_porcentaje ?? null,
      cuota_iva: overrides?.cuota_iva ?? null,
      total: overrides?.total ?? null,
      archivo_nombre: file.name,
      archivo_url: archivoUrl,
      storage_path: storagePath,
      categoria: overrides?.categoria ?? "otro",
      fecha_pago: overrides?.fecha_pago ?? null,
      forma_pago: overrides?.forma_pago ?? null,
      ano_fiscal: overrides?.ano_fiscal ?? null,
      deducible_irpf: overrides?.deducible_irpf ?? true,
      proveedor_id: overrides?.proveedor_id ?? null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("facturas")
      .insert(insertData as any)
      .select()
      .single();

    if (insertError) {
      toast.error("Error al guardar la factura");
      void captureAppError({
        event: "facturas.create",
        message: "Fallo al guardar factura tras upload",
        severity: "error", audit: true, error: insertError,
        context: { property_id: propertyId || null, ano_fiscal: overrides?.ano_fiscal ?? null },
      });
      return null;
    }

    const factura = inserted as unknown as Factura;
    invalidate();
    return factura;
  };

  const createManual = async (data: {
    property_id?: string | null;
    emisor_nombre?: string | null;
    emisor_nif?: string | null;
    numero_factura?: string | null;
    fecha?: string | null;
    fecha_devengo?: string | null;
    base_imponible?: number | null;
    iva_porcentaje?: number | null;
    cuota_iva?: number | null;
    total: number;
    categoria?: string;
    receptor_nif?: string | null;
    receptor_nombre?: string | null;
    fecha_pago?: string | null;
    forma_pago?: string | null;
    ano_fiscal?: number | null;
    deducible_irpf?: boolean;
    proveedor_id?: string | null;
  }): Promise<Factura | null> => {
    if (!user) return null;

    const insertData = {
      user_id: user.id,
      property_id: data.property_id || null,
      emisor_nombre: data.emisor_nombre || null,
      emisor_nif: data.emisor_nif || null,
      receptor_nif: data.receptor_nif || null,
      receptor_nombre: data.receptor_nombre || null,
      numero_factura: data.numero_factura || null,
      fecha: data.fecha || null,
      fecha_devengo: data.fecha_devengo || null,
      base_imponible: data.base_imponible || null,
      iva_porcentaje: data.iva_porcentaje || null,
      cuota_iva: data.cuota_iva || null,
      total: data.total,
      archivo_nombre: "Factura manual",
      archivo_url: "",
      storage_path: "",
      categoria: data.categoria || "otro",
      fecha_pago: data.fecha_pago || null,
      forma_pago: data.forma_pago || null,
      ano_fiscal: data.ano_fiscal || null,
      deducible_irpf: data.deducible_irpf ?? true,
      proveedor_id: data.proveedor_id || null,
    };

    const { data: inserted, error } = await supabase
      .from("facturas")
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      toast.error("Error al guardar la factura");
      void captureAppError({
        event: "facturas.create_manual",
        message: "Fallo al crear factura manual",
        severity: "error", audit: true, error,
        context: { property_id: data.property_id || null, ano_fiscal: data.ano_fiscal ?? null },
      });
      return null;
    }

    const factura = inserted as unknown as Factura;
    invalidate();
    return factura;
  };

  const updateFactura = async (id: string, updates: Partial<Factura>) => {
    const { error } = await supabase
      .from("facturas")
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast.error("Error al actualizar");
      void captureAppError({
        event: "facturas.update",
        message: "Fallo al actualizar factura",
        severity: "error", audit: true, error,
        context: { factura_id: id },
      });
      return;
    }
    invalidate();
  };

  const deleteFactura = async (id: string) => {
    const { error } = await supabase
      .from("facturas")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      void captureAppError({
        event: "facturas.delete",
        message: "Fallo al eliminar (soft) factura",
        severity: "error", audit: true, error,
        context: { factura_id: id },
      });
      return;
    }
    invalidate();
    toast.success("Factura movida a la papelera", { description: "Puedes restaurarla durante 30 días." });
  };

  return { facturas, loading, uploadAndAnalyze, createManual, updateFactura, deleteFactura, refetch };
}
