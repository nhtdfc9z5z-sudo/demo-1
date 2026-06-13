import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Receipt, Image as ImageIcon, Camera, FileText, Ban, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePagoCompensaciones } from "@/hooks/usePagoCompensaciones";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@/hooks/useProperties";

interface Props {
  userId: string | null | undefined;
  anio: number;
  selectedPropertyIds: Set<string>;
  properties: Property[];
}

/**
 * Aviso previo a enviar el expediente fiscal: lista compensaciones del año
 * marcadas como gasto (`crear_gasto=true`) que aún no tienen factura adjunta
 * (ni `documento_url` ni `factura_id`). Por cada una, ofrece las mismas
 * opciones que en "He cobrado": subir foto, hacer foto, subir PDF, sin
 * factura, o más adelante.
 */
const CompensacionesFacturasPendientes = ({ userId, anio, selectedPropertyIds, properties }: Props) => {
  const { compensaciones, update } = usePagoCompensaciones({ userId: userId ?? null, asOwner: true });
  const { toast } = useToast();
  const [resolvedDismiss, setResolvedDismiss] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    properties.forEach(p => m.set(p.id, p));
    return m;
  }, [properties]);

  const pendientes = useMemo(() => {
    return compensaciones.filter(c =>
      c.anio === anio
      && c.crear_gasto
      && !c.documento_url
      && !c.factura_id
      && selectedPropertyIds.has(c.property_id)
      && !resolvedDismiss.has(c.id),
    );
  }, [compensaciones, anio, selectedPropertyIds, resolvedDismiss]);

  const imgRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  if (!userId || pendientes.length === 0) return null;

  const uploadAndAttach = async (file: File, compId: string) => {
    const comp = pendientes.find(c => c.id === compId);
    if (!comp) return;
    setBusy(compId);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("facturas").upload(path, file, {
        contentType: file.type || "application/octet-stream", upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = await supabase.storage
        .from("facturas")
        .createSignedUrl(path, 3600);

      const { data: facturaRow, error: facErr } = await supabase
        .from("facturas")
        .insert({
          user_id: userId,
          property_id: comp.property_id,
          archivo_url: pub?.signedUrl || "",
          storage_path: path,
          archivo_nombre: file.name,
          total: comp.importe,
          base_imponible: comp.importe,
          fecha: new Date().toISOString().slice(0, 10),
          fecha_devengo: `${comp.anio}-${String(comp.mes).padStart(2, "0")}-01`,
          ano_fiscal: comp.anio,
          categoria: comp.motivo === "suministros" ? "suministros" : (comp.motivo === "mantenimiento" ? "mantenimiento" : "reparacion"),
          deducible_irpf: comp.deducible,
          forma_pago: "compensacion_inquilino",
          notas: ["Gasto pagado por inquilino (compensación de renta)", comp.descripcion].filter(Boolean).join(" · "),
        } as any)
        .select("id")
        .maybeSingle();
      if (facErr) throw facErr;

      await update({
        id: comp.id,
        patch: {
          documento_url: pub?.signedUrl || "",
          documento_path: path,
          factura_id: (facturaRow as any)?.id ?? null,
        } as any,
      });
      toast({ title: "Factura adjuntada" });
      setActiveId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo adjuntar la factura", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleSinFactura = async (compId: string) => {
    setBusy(compId);
    try {
      await update({ id: compId, patch: { crear_gasto: false, deducible: false } as any });
      toast({ title: "Marcada como sin factura", description: "No se expondrá como gasto al gestor." });
      setActiveId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleMasAdelante = (compId: string) => {
    setResolvedDismiss(prev => new Set(prev).add(compId));
    setActiveId(null);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
        <AlertTriangle size={14} /> Facturas pendientes de registrar ({pendientes.length})
      </p>
      <p className="text-xs text-amber-700">
        Estos gastos están pendientes de aportar factura. Si no la añades ahora, no se incluirán como deducibles en el expediente.
      </p>
      <div className="space-y-2">
        {pendientes.map(c => {
          const prop = propertyById.get(c.property_id);
          const open = activeId === c.id;
          return (
            <div key={c.id} className="rounded-md bg-background border border-amber-200 p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {prop?.nombre_interno || "Inmueble"} · {c.motivo}
                  </p>
                  <p className="text-muted-foreground">
                    {c.mes.toString().padStart(2, "0")}/{c.anio} · {Number(c.importe).toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                    {c.descripcion ? ` · ${c.descripcion}` : ""}
                  </p>
                </div>
                {!open ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setActiveId(c.id)} disabled={busy === c.id}>
                    <Receipt size={12} /> Resolver
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setActiveId(null)}>Cerrar</Button>
                )}
              </div>
              {open && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-auto py-2 flex-col gap-0.5" disabled={busy === c.id}
                    onClick={() => imgRef.current?.click()}>
                    <ImageIcon size={14} className="text-primary" /><span className="text-[11px]">Subir foto</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-2 flex-col gap-0.5" disabled={busy === c.id}
                    onClick={() => camRef.current?.click()}>
                    <Camera size={14} className="text-primary" /><span className="text-[11px]">Hacer foto</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-2 flex-col gap-0.5" disabled={busy === c.id}
                    onClick={() => pdfRef.current?.click()}>
                    <FileText size={14} className="text-primary" /><span className="text-[11px]">Subir PDF</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-auto py-2 flex-col gap-0.5" disabled={busy === c.id}
                    onClick={() => handleSinFactura(c.id)}>
                    <Ban size={14} /><span className="text-[11px]">Sin factura</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-auto py-2 flex-col gap-0.5" disabled={busy === c.id}
                    onClick={() => handleMasAdelante(c.id)}>
                    <Clock size={14} /><span className="text-[11px]">Más adelante</span>
                  </Button>
                  <input ref={imgRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAndAttach(f, c.id); e.target.value = ""; }} />
                  <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAndAttach(f, c.id); e.target.value = ""; }} />
                  <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAndAttach(f, c.id); e.target.value = ""; }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-amber-700 flex items-center gap-1">
        <CheckCircle2 size={11} /> Las compensaciones se mantienen como pago (no entran en caja). "Sin factura" solo elimina el gasto del propietario.
      </p>
    </div>
  );
};

export default CompensacionesFacturasPendientes;