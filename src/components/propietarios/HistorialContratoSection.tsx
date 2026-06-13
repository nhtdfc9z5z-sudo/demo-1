import { useEffect, useState } from "react";
import { useContratos, type Contrato, type ContratoHistorial } from "@/hooks/useContratos";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TIPOS: { v: string; label: string }[] = [
  { v: "inicio", label: "Inicio de contrato" },
  { v: "subida_renta", label: "Subida de renta" },
  { v: "ipc", label: "Actualización IPC" },
  { v: "renovacion", label: "Renovación" },
  { v: "acuerdo_temporal", label: "Acuerdo temporal" },
  { v: "cambio_condiciones", label: "Cambio de condiciones" },
  { v: "pago_pendiente", label: "Pago pendiente detectado" },
  { v: "regularizacion", label: "Regularización histórica" },
  { v: "finalizacion", label: "Finalización de contrato" },
  { v: "historico_economico_reconstruido", label: "Histórico económico reconstruido" },
  { v: "renta_historica_regularizada", label: "Renta histórica regularizada" },
  { v: "pago_pendiente_historico", label: "Pago pendiente histórico" },
  { v: "pago_real_registrado", label: "Cobro real registrado" },
  { v: "otro", label: "Otro" },
];

const MESES_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const ECONOMIC_TIPOS = new Set([
  "historico_economico_reconstruido",
  "renta_historica_regularizada",
  "pago_pendiente_historico",
  "pago_real_registrado",
]);

function describeMesesShort(meses: Array<{ mes: number; anio: number }>): string {
  if (!meses?.length) return "";
  const sorted = [...meses].sort((a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes));
  const first = sorted[0]; const last = sorted[sorted.length - 1];
  if (sorted.length === 1) return `${MESES_ABBR[first.mes - 1]} ${first.anio}`;
  return `${MESES_ABBR[first.mes - 1]} ${first.anio} → ${MESES_ABBR[last.mes - 1]} ${last.anio} (${sorted.length} meses)`;
}

const ESTRATEGIA_LABEL: Record<string, string> = {
  omitir_pagos_reales: "Proteger pagos reales",
  solo_reemplazar_existentes: "Solo reemplazar existentes",
  solo_nuevos: "Solo crear nuevos",
};

function MetadataEconomica({ meta, importe }: { meta: any; importe?: number | null }) {
  if (!meta) return null;
  const meses = Array.isArray(meta.meses_afectados) ? meta.meses_afectados : [];
  const omitidosPR = Array.isArray(meta.omitidos_pago_real) ? meta.omitidos_pago_real : [];
  const mesesCreados = Array.isArray(meta.meses_creados) ? meta.meses_creados : [];
  const mesesActualizados = Array.isArray(meta.meses_actualizados) ? meta.meses_actualizados : [];
  const omitidosDecision = Array.isArray(meta.omitidos_por_decision_usuario) ? meta.omitidos_por_decision_usuario : [];
  const total = meta.importe_total ?? importe;
  return (
    <div className="mt-1.5 text-[11px] rounded-md border border-border bg-muted/40 p-2 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {meta.afecta_finanzas_actuales ? "Afecta tesorería" : "No afecta tesorería"}
        </Badge>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {meta.afecta_fiscalidad ? "Afecta IRPF" : "No afecta IRPF"}
        </Badge>
        {meta.estrategia_elegida && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {ESTRATEGIA_LABEL[meta.estrategia_elegida] || meta.estrategia_elegida}
          </Badge>
        )}
      </div>
      {mesesCreados.length > 0 && (
        <p><span className="text-muted-foreground">Creados:</span> {describeMesesShort(mesesCreados)}</p>
      )}
      {mesesActualizados.length > 0 && (
        <p><span className="text-muted-foreground">Actualizados:</span> {describeMesesShort(mesesActualizados)}</p>
      )}
      {meses.length > 0 && mesesCreados.length === 0 && mesesActualizados.length === 0 && (
        <p><span className="text-muted-foreground">Meses:</span> {describeMesesShort(meses)}</p>
      )}
      {omitidosPR.length > 0 && (
        <p className="text-amber-700">
          <span className="font-medium">Omitidos por pago real:</span> {describeMesesShort(omitidosPR)}
        </p>
      )}
      {omitidosDecision.length > 0 && (
        <p className="text-muted-foreground">
          Omitidos por estrategia: {describeMesesShort(omitidosDecision)}
        </p>
      )}
      {total != null && (
        <p><span className="text-muted-foreground">Importe total:</span> <span className="font-mono">{Number(total).toLocaleString("es-ES")} €</span></p>
      )}
    </div>
  );
}

interface Props {
  contrato: Contrato;
}

export default function HistorialContratoSection({ contrato }: Props) {
  const { fetchHistorial, addHistorial } = useContratos();
  const [items, setItems] = useState<ContratoHistorial[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState("otro");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [importeAnt, setImporteAnt] = useState("");
  const [importeNue, setImporteNue] = useState("");
  const [detalle, setDetalle] = useState("");

  const load = async () => {
    const data = await fetchHistorial(contrato.id);
    setItems(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  // Recarga automática cuando otro componente registra un evento económico
  // (cobro real, reconstrucción histórica, etc.) sobre este contrato.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { contratoId?: string } | undefined;
      if (!detail?.contratoId || detail.contratoId === contrato.id) load();
    };
    window.addEventListener("contrato-historial-changed", handler);
    return () => window.removeEventListener("contrato-historial-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  const labelFor = (t: string) => TIPOS.find(x => x.v === t)?.label || t;

  const handleAdd = async () => {
    if (!titulo) return;
    setSaving(true);
    try {
      await addHistorial(
        contrato.id, contrato.property_id, tipo, titulo, detalle || undefined,
        importeAnt ? `${importeAnt} €` : undefined,
        importeNue ? `${importeNue} €` : undefined,
      );
      setOpen(false);
      setTitulo(""); setDetalle(""); setImporteAnt(""); setImporteNue(""); setFecha(""); setTipo("otro");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Historial del contrato
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1" /> Añadir evento
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin eventos registrados todavía.</p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-3">
          {items.map(h => (
            <li key={h.id} className="pl-4 relative">
              <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{labelFor(h.tipo)}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString("es-ES")}</span>
              </div>
              <div className="text-sm font-medium">{h.titulo}</div>
              {h.detalle && <div className="text-xs text-muted-foreground mt-0.5">{h.detalle}</div>}
              {(h.valor_anterior || h.valor_nuevo) && (
                <div className="text-xs mt-1">
                  {h.valor_anterior && <span className="text-muted-foreground line-through mr-2">{h.valor_anterior}</span>}
                  {h.valor_nuevo && <span className="text-emerald-600 font-medium">{h.valor_nuevo}</span>}
                </div>
              )}
              {ECONOMIC_TIPOS.has(h.tipo) && (
                <MetadataEconomica meta={h.metadata} importe={h.importe_nuevo} />
              )}
            </li>
          ))}
        </ol>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir evento al historial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título*</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fecha (opcional)</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Importe anterior</Label>
                <Input type="number" value={importeAnt} onChange={e => setImporteAnt(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Importe nuevo</Label>
                <Input type="number" value={importeNue} onChange={e => setImporteNue(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={3} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving || !titulo}>{saving ? "Guardando…" : "Añadir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}