import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useContratos, type Contrato } from "@/hooks/useContratos";
import { usePagosRenta } from "@/hooks/usePagosRenta";
import { useGarantiasAdicionales, TIPOS_GARANTIA, type GarantiaTipo } from "@/hooks/useGarantiasAdicionales";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { History, Shield } from "lucide-react";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props {
  contrato: Contrato;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}

export default function RegularizarHistoricoDialog({ contrato, open, onOpenChange, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addHistorial, updateContrato } = useContratos();
  const { notificarPago } = usePagosRenta({ asOwner: true, userId: user?.id });
  const { createGarantia } = useGarantiasAdicionales(contrato.id);

  const [saving, setSaving] = useState(false);
  const [pendientes, setPendientes] = useState<Record<string, number>>({});
  const [rentaAnterior, setRentaAnterior] = useState("");
  const [rentaNueva, setRentaNueva] = useState("");
  const [motivoRenta, setMotivoRenta] = useState("ipc");
  const [renovacionFechaFin, setRenovacionFechaFin] = useState("");
  const [notas, setNotas] = useState("");
  // Fianza / Garantía
  const [garTipo, setGarTipo] = useState<GarantiaTipo>("metalico");
  const [garImporte, setGarImporte] = useState("");
  const [garFecha, setGarFecha] = useState("");
  const [garEsActualizacionFianza, setGarEsActualizacionFianza] = useState(false);
  const [garFianzaAnterior, setGarFianzaAnterior] = useState("");
  const [garFianzaNueva, setGarFianzaNueva] = useState("");

  const meses = useMemo(() => {
    if (!contrato.fecha_inicio) return [];
    const start = new Date(contrato.fecha_inicio);
    const end = new Date();
    const list: { key: string; label: string; mes: number; anio: number }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= stop && list.length < 120) {
      list.push({
        key: `${cur.getFullYear()}-${cur.getMonth() + 1}`,
        label: `${MESES[cur.getMonth()]} ${cur.getFullYear()}`,
        mes: cur.getMonth() + 1,
        anio: cur.getFullYear(),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [contrato.fecha_inicio]);

  const handlePagos = async () => {
    if (!user || !contrato.inquilino_id) return;
    setSaving(true);
    try {
      const entries = Object.entries(pendientes).filter(([_, v]) => v > 0);
      for (const [key, importe] of entries) {
        const [a, m] = key.split("-");
        await notificarPago(contrato.inquilino_id, contrato.property_id, Number(m), Number(a), user.id, {
          importe_pagado: 0, tipo_pago: "pendiente",
          notas_acuerdo: `Pendiente histórico (regularización): ${importe} €`,
        });
      }
      await addHistorial(contrato.id, contrato.property_id, "regularizacion",
        "Regularización de pagos pendientes",
        `${entries.length} mes(es) marcados como pendientes`);
      await updateContrato(contrato.id, { estado: "con_pagos_pendientes" } as any);
      toast({ title: "Pagos regularizados" });
      onUpdated?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleRenta = async () => {
    if (!rentaNueva) return;
    setSaving(true);
    try {
      await addHistorial(contrato.id, contrato.property_id, motivoRenta,
        motivoRenta === "ipc" ? "Actualización IPC" : "Subida de renta",
        notas || undefined,
        rentaAnterior ? `${rentaAnterior} €` : undefined,
        `${rentaNueva} €`);
      await updateContrato(contrato.id, { renta_mensual: Number(rentaNueva), estado: "historico_regularizado" } as any);
      toast({ title: "Renta actualizada en histórico" });
      onUpdated?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleRenovacion = async () => {
    if (!renovacionFechaFin) return;
    setSaving(true);
    try {
      await addHistorial(contrato.id, contrato.property_id, "renovacion",
        "Renovación registrada", notas || undefined, contrato.fecha_fin || undefined, renovacionFechaFin);
      await updateContrato(contrato.id, { fecha_fin: renovacionFechaFin, estado: "historico_regularizado" } as any);
      toast({ title: "Renovación registrada" });
      onUpdated?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleNotas = async () => {
    if (!notas) return;
    setSaving(true);
    try {
      await addHistorial(contrato.id, contrato.property_id, "otro", "Nota histórica", notas);
      toast({ title: "Nota añadida al histórico" });
      onUpdated?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleFianzaGarantia = async () => {
    setSaving(true);
    try {
      if (garEsActualizacionFianza && garFianzaNueva) {
        // Actualiza la fianza legal del contrato (no toca renta ni garantías)
        await addHistorial(
          contrato.id,
          contrato.property_id,
          "fianza_actualizada",
          "Fianza actualizada",
          notas || "Cambio de fianza registrado sin afectar a la renta",
          garFianzaAnterior ? `${garFianzaAnterior} €` : undefined,
          `${garFianzaNueva} €`,
        );
        await updateContrato(contrato.id, { fianza_importe: Number(garFianzaNueva) } as any);
      }
      if (garImporte) {
        await createGarantia({
          contrato_id: contrato.id,
          property_id: contrato.property_id,
          inquilino_id: contrato.inquilino_id ?? null,
          tipo: garTipo,
          estado: "vigente",
          importe: Number(garImporte),
          fecha_entrega: garFecha || null,
          notas: notas || null,
        });
        await addHistorial(
          contrato.id,
          contrato.property_id,
          "garantia_registrada",
          "Garantía adicional registrada",
          `${garTipo} · ${garImporte} €`,
          undefined,
          `${garImporte} €`,
        );
      }
      toast({ title: "Fianza/garantía registrada en histórico" });
      onUpdated?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History size={16} /> Regularizar histórico</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Añade información del pasado sin generar errores económicos. Cada acción queda registrada en el historial del contrato.</p>
        <Tabs defaultValue="pagos" className="mt-2">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="pagos" className="text-xs">Pagos</TabsTrigger>
            <TabsTrigger value="renta" className="text-xs">Renta/IPC</TabsTrigger>
            <TabsTrigger value="renov" className="text-xs">Renovación</TabsTrigger>
            <TabsTrigger value="fianza" className="text-xs">Fianza</TabsTrigger>
            <TabsTrigger value="notas" className="text-xs">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="pagos" className="space-y-3">
            {meses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Define una fecha de inicio en el contrato para listar meses.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded p-2 space-y-1.5">
                {meses.map(m => {
                  const checked = pendientes[m.key] != null;
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <Checkbox checked={checked} onCheckedChange={(v) => setPendientes(prev => {
                        const c = { ...prev };
                        if (v) c[m.key] = contrato.renta_mensual || 0;
                        else delete c[m.key];
                        return c;
                      })} />
                      <span className="text-sm flex-1">{m.label}</span>
                      {checked && <Input type="number" value={pendientes[m.key]} onChange={e => setPendientes(prev => ({ ...prev, [m.key]: Number(e.target.value) }))} className="h-8 w-24 text-xs" />}
                    </div>
                  );
                })}
              </div>
            )}
            <DialogFooter>
              <Button onClick={handlePagos} disabled={saving || Object.keys(pendientes).length === 0}>Registrar pendientes</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="renta" className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Renta anterior (€)</Label><Input type="number" value={rentaAnterior} onChange={e => setRentaAnterior(e.target.value)} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Renta nueva (€)</Label><Input type="number" value={rentaNueva} onChange={e => setRentaNueva(e.target.value)} className="h-9 text-sm" /></div>
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <select value={motivoRenta} onChange={e => setMotivoRenta(e.target.value)} className="w-full h-9 text-sm border rounded px-2 bg-background">
                <option value="ipc">Actualización IPC</option>
                <option value="subida_renta">Subida de renta</option>
                <option value="acuerdo_temporal">Acuerdo temporal</option>
              </select>
            </div>
            <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="text-sm" /></div>
            <DialogFooter><Button onClick={handleRenta} disabled={saving || !rentaNueva}>Registrar cambio de renta</Button></DialogFooter>
          </TabsContent>

          <TabsContent value="renov" className="space-y-3">
            <div><Label className="text-xs">Nueva fecha de fin</Label><Input type="date" value={renovacionFechaFin} onChange={e => setRenovacionFechaFin(e.target.value)} className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="text-sm" /></div>
            <DialogFooter><Button onClick={handleRenovacion} disabled={saving || !renovacionFechaFin}>Registrar renovación</Button></DialogFooter>
          </TabsContent>

          <TabsContent value="notas" className="space-y-3">
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} className="text-sm" placeholder="Acuerdo temporal, cambio de condiciones, otra observación…" />
            <DialogFooter><Button onClick={handleNotas} disabled={saving || !notas}>Añadir al historial</Button></DialogFooter>
          </TabsContent>

          <TabsContent value="fianza" className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2 text-[11px] text-amber-800 dark:text-amber-300 flex gap-2">
              <Shield size={14} className="shrink-0 mt-0.5" />
              <span>Cambiar la renta no modifica la fianza ni las garantías. Edítalas aquí solo si han cambiado realmente.</span>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={garEsActualizacionFianza} onCheckedChange={(v) => setGarEsActualizacionFianza(!!v)} />
                <span className="text-xs font-medium">Actualizar fianza legal (importe)</span>
              </div>
              {garEsActualizacionFianza && (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Fianza anterior (€)</Label><Input type="number" value={garFianzaAnterior} onChange={e => setGarFianzaAnterior(e.target.value)} className="h-9 text-sm" /></div>
                  <div><Label className="text-xs">Fianza nueva (€)</Label><Input type="number" value={garFianzaNueva} onChange={e => setGarFianzaNueva(e.target.value)} className="h-9 text-sm" /></div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">Añadir garantía adicional (opcional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select value={garTipo} onChange={e => setGarTipo(e.target.value as GarantiaTipo)} className="w-full h-9 text-sm border rounded px-2 bg-background">
                    {TIPOS_GARANTIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Importe (€)</Label><Input type="number" value={garImporte} onChange={e => setGarImporte(e.target.value)} className="h-9 text-sm" /></div>
              </div>
              <div><Label className="text-xs">Fecha de entrega</Label><Input type="date" value={garFecha} onChange={e => setGarFecha(e.target.value)} className="h-9 text-sm" /></div>
            </div>

            <div><Label className="text-xs">Notas</Label><Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="text-sm" /></div>

            <DialogFooter>
              <Button
                onClick={handleFianzaGarantia}
                disabled={saving || (!garImporte && !(garEsActualizacionFianza && garFianzaNueva))}
              >
                Guardar en histórico
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}