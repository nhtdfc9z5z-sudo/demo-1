import { useMemo, useState } from "react";
import { usePagosRenta, type PagoRenta } from "@/hooks/usePagosRenta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Wallet, ShieldCheck, MoreHorizontal, FileSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";
import { logContratoEvento } from "@/lib/contratoHistorialEvents";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props {
  contrato: Contrato;
}

/**
 * Bloque "Histórico económico" en la ficha del contrato.
 * Muestra pagos reales vs históricos reconstruidos vs pendientes,
 * y permite convertir un pendiente histórico en cobro real.
 */
export default function HistoricoEconomicoSection({ contrato }: Props) {
  const { toast } = useToast();
  const {
    pagos, marcarComoPagoReal,
    setAfectaFiscalidad, convertirEnPendiente, marcarRegularizado,
  } = usePagosRenta({
    propertyId: contrato.property_id,
    inquilinoId: contrato.inquilino_id,
  });

  // Estado del mini-diálogo "Registrar cobro real".
  const [cobroOpen, setCobroOpen] = useState(false);
  const [cobroPago, setCobroPago] = useState<PagoRenta | null>(null);
  const [cobroImporte, setCobroImporte] = useState<string>("");
  const [cobroTipo, setCobroTipo] = useState<string>("transferencia");
  const [cobroFecha, setCobroFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [cobroAfectaFiscalidad, setCobroAfectaFiscalidad] = useState<boolean>(true);
  const [cobroSaving, setCobroSaving] = useState(false);

  // Confirmación para acciones no destructivas pero relevantes
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => Promise<void> | void;
  }>(null);
  const [detalleOpen, setDetalleOpen] = useState<PagoRenta | null>(null);

  const groups = useMemo(() => {
    const real: PagoRenta[] = [];
    const historico: PagoRenta[] = [];
    const regularizado: PagoRenta[] = [];
    const pendiente: PagoRenta[] = [];
    for (const p of pagos) {
      const t = p.tipo_registro || "pago_real";
      if (t === "pago_real") real.push(p);
      else if (t === "historico_reconstruido") historico.push(p);
      else if (t === "regularizado") regularizado.push(p);
      else if (t === "pendiente") pendiente.push(p);
    }
    return { real, historico, regularizado, pendiente };
  }, [pagos]);

  const hasAny =
    groups.real.length + groups.historico.length + groups.regularizado.length + groups.pendiente.length > 0;

  if (!hasAny) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No hay histórico económico reconstruido para este contrato. Puedes reconstruirlo desde "Regularizar histórico".
      </p>
    );
  }

  const openCobroDialog = (p: PagoRenta) => {
    setCobroPago(p);
    // Importe prellenado: el del propio pago si > 0, si no, la renta del contrato.
    const sugerido = Number(p.importe_pagado || 0) > 0
      ? Number(p.importe_pagado)
      : Number(contrato.renta_mensual || 0);
    setCobroImporte(sugerido > 0 ? String(sugerido) : "");
    setCobroTipo("transferencia");
    setCobroFecha(new Date().toISOString().slice(0, 10));
    setCobroAfectaFiscalidad(true);
    setCobroOpen(true);
  };

  const handleConfirmarCobro = async () => {
    if (!cobroPago) return;
    // Acepta coma o punto como separador decimal.
    const importe = Number(String(cobroImporte).replace(",", "."));
    if (!importe || importe <= 0) {
      toast({ title: "Importe inválido", description: "Introduce un importe mayor que 0.", variant: "destructive" });
      return;
    }
    setCobroSaving(true);
    try {
      await marcarComoPagoReal(cobroPago.id, {
        importe_pagado: importe,
        tipo_pago: cobroTipo,
        fecha_pago_real: cobroFecha,
        afecta_fiscalidad: cobroAfectaFiscalidad,
      });
      await logContratoEvento({
        contratoId: contrato.id,
        propertyId: contrato.property_id,
        userId: contrato.user_id,
        tipo: "pago_real_registrado",
        titulo: `Cobro real registrado · ${MESES[cobroPago.mes - 1]} ${cobroPago.anio}`,
        fechaEvento: cobroFecha,
        importeTotal: importe,
        metadata: {
          origen: "registro_manual",
          meses_afectados: [{ mes: cobroPago.mes, anio: cobroPago.anio, importe }],
          afecta_finanzas_actuales: true,
          afecta_fiscalidad: cobroAfectaFiscalidad,
          pago_id: cobroPago.id,
        },
      });
      toast({
        title: "Cobro registrado",
        description: `${MESES[cobroPago.mes - 1]} ${cobroPago.anio} · ${importe.toLocaleString("es-ES")} €`,
      });
      setCobroOpen(false);
      setCobroPago(null);
    } catch (err: any) {
      toast({ title: "No se pudo registrar", description: err?.message || "Error desconocido", variant: "destructive" });
    } finally {
      setCobroSaving(false);
    }
  };

  const KIND_LABEL: Record<string, string> = {
    real: "Pago real",
    historico: "Histórico reconstruido",
    regularizado: "Regularizado",
    pendiente: "Pendiente",
  };

  const fmtFecha = (s?: string | null) => {
    if (!s) return null;
    try { return new Date(s).toLocaleDateString("es-ES"); } catch { return s; }
  };

  const handleToggleFiscalidad = (p: PagoRenta) => {
    const next = !(p.afecta_fiscalidad ?? false);
    setConfirm({
      title: next ? "Incluir en IRPF" : "Excluir de IRPF",
      description: next
        ? `Se incluirá ${MESES[p.mes - 1]} ${p.anio} en el cálculo fiscal del año correspondiente al devengo.`
        : `Se dejará de contar ${MESES[p.mes - 1]} ${p.anio} en el cálculo fiscal.`,
      actionLabel: next ? "Incluir en IRPF" : "Excluir de IRPF",
      onConfirm: async () => {
        try {
          await setAfectaFiscalidad(p.id, next);
          await logContratoEvento({
            contratoId: contrato.id, propertyId: contrato.property_id, userId: contrato.user_id,
            tipo: "renta_historica_regularizada",
            titulo: `${next ? "Incluido" : "Excluido"} de IRPF · ${MESES[p.mes - 1]} ${p.anio}`,
            metadata: {
              origen: "registro_manual",
              meses_afectados: [{ mes: p.mes, anio: p.anio, importe: Number(p.importe_pagado || 0) }],
              afecta_finanzas_actuales: false,
              afecta_fiscalidad: next,
              pago_id: p.id,
            },
          });
          toast({ title: next ? "Incluido en IRPF" : "Excluido de IRPF" });
        } catch (err: any) {
          toast({ title: "No se pudo actualizar", description: err?.message, variant: "destructive" });
        }
      },
    });
  };

  const handleConvertirEnPendiente = (p: PagoRenta) => {
    setConfirm({
      title: "Convertir en pendiente",
      description: `Este mes (${MESES[p.mes - 1]} ${p.anio}) se marcará como pendiente de cobro. No contará en tesorería ni en IRPF hasta que registres el cobro real.`,
      actionLabel: "Convertir en pendiente",
      onConfirm: async () => {
        try {
          await convertirEnPendiente(p.id);
          await logContratoEvento({
            contratoId: contrato.id, propertyId: contrato.property_id, userId: contrato.user_id,
            tipo: "pago_pendiente_historico",
            titulo: `Convertido a pendiente · ${MESES[p.mes - 1]} ${p.anio}`,
            metadata: {
              origen: "registro_manual",
              meses_afectados: [{ mes: p.mes, anio: p.anio }],
              afecta_finanzas_actuales: false,
              afecta_fiscalidad: false,
              pago_id: p.id,
            },
          });
          toast({ title: "Marcado como pendiente" });
        } catch (err: any) {
          toast({ title: "No se pudo convertir", description: err?.message, variant: "destructive" });
        }
      },
    });
  };

  const handleMarcarRegularizado = (p: PagoRenta, noReclamado = false) => {
    setConfirm({
      title: noReclamado ? "Marcar como no reclamado" : "Marcar como regularizado",
      description: noReclamado
        ? `${MESES[p.mes - 1]} ${p.anio} se cerrará como no reclamable. No contará en tesorería ni en IRPF.`
        : `${MESES[p.mes - 1]} ${p.anio} quedará archivado como mes ya regularizado.`,
      actionLabel: noReclamado ? "Marcar no reclamado" : "Regularizar",
      onConfirm: async () => {
        try {
          await marcarRegularizado(p.id, noReclamado ? "No reclamado" : undefined);
          await logContratoEvento({
            contratoId: contrato.id, propertyId: contrato.property_id, userId: contrato.user_id,
            tipo: "renta_historica_regularizada",
            titulo: noReclamado
              ? `No reclamado · ${MESES[p.mes - 1]} ${p.anio}`
              : `Regularizado · ${MESES[p.mes - 1]} ${p.anio}`,
            metadata: {
              origen: "registro_manual",
              meses_afectados: [{ mes: p.mes, anio: p.anio }],
              afecta_finanzas_actuales: false,
              afecta_fiscalidad: false,
              no_reclamado: noReclamado,
              pago_id: p.id,
            },
          });
          toast({ title: noReclamado ? "Marcado como no reclamado" : "Marcado como regularizado" });
        } catch (err: any) {
          toast({ title: "No se pudo actualizar", description: err?.message, variant: "destructive" });
        }
      },
    });
  };

  const Row = ({ p, kind }: { p: PagoRenta; kind: "real" | "historico" | "regularizado" | "pendiente" }) => {
    const importe = Number(p.importe_pagado || 0);
    const color =
      kind === "real" ? "bg-emerald-50 border-emerald-200" :
      kind === "historico" ? "bg-sky-50 border-sky-200" :
      kind === "regularizado" ? "bg-amber-50 border-amber-200" :
      "bg-rose-50 border-rose-200";
    const cuentaTesoreria = p.afecta_finanzas_actuales !== false && kind === "real";
    const cuentaFiscalidad = (p.afecta_fiscalidad ?? false) === true || (kind === "real" && p.afecta_fiscalidad !== false);
    return (
      <div className={`p-2 rounded-lg border text-xs ${color}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold">{MESES[p.mes - 1]} {p.anio}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{KIND_LABEL[kind]}</Badge>
              <span className="font-medium">{importe.toLocaleString("es-ES")} €</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {cuentaTesoreria
                ? <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-600">Cuenta en tesorería</Badge>
                : <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">No cuenta en tesorería</Badge>}
              {cuentaFiscalidad
                ? <Badge className="text-[9px] px-1 py-0 h-4 bg-indigo-600">Cuenta en fiscalidad</Badge>
                : <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">No cuenta en fiscalidad</Badge>}
              {kind === "real" && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-600 text-emerald-700">
                  <ShieldCheck size={9} className="mr-0.5" />Protegido: pago real
                </Badge>
              )}
              {kind === "pendiente" && (
                <Badge className="text-[9px] px-1 py-0 h-4 bg-rose-600">Pendiente de cobro</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
              {p.fecha_pago_real && <span>Cobrado: {fmtFecha(p.fecha_pago_real)}</span>}
              <span>Registrado: {fmtFecha(p.created_at)}</span>
              <span>Devengo: {MESES[p.mes - 1]} {p.anio}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {kind === "pendiente" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCobroDialog(p)}>
                <Wallet size={12} className="mr-1" /> Cobro real
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Más acciones">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => setDetalleOpen(p)}>
                  <FileSearch size={12} className="mr-2" />Ver detalle
                </DropdownMenuItem>
                {(kind === "historico" || kind === "regularizado") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleToggleFiscalidad(p)}>
                      {p.afecta_fiscalidad ? "Excluir de IRPF" : "Incluir en IRPF"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleConvertirEnPendiente(p)}>
                      Convertir en pendiente
                    </DropdownMenuItem>
                  </>
                )}
                {kind === "pendiente" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleMarcarRegularizado(p, false)}>
                      Marcar como regularizado
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMarcarRegularizado(p, true)}>
                      Marcar como no reclamado
                    </DropdownMenuItem>
                  </>
                )}
                {kind === "real" && (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    Pago real protegido
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground">Pagos reales</p>
          <p className="font-semibold">{groups.real.length}</p>
        </div>
        <div className="p-2 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground">Histórico</p>
          <p className="font-semibold">{groups.historico.length}</p>
        </div>
        <div className="p-2 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground">Regularizado</p>
          <p className="font-semibold">{groups.regularizado.length}</p>
        </div>
        <div className="p-2 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground">Pendiente</p>
          <p className="font-semibold">{groups.pendiente.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-0.5">
        <p><strong>Pago real:</strong> cobro efectivo registrado. Cuenta en tesorería y, si lo marcas, en IRPF.</p>
        <p><strong>Reconstruido:</strong> mes resuelto antes de usar CapitalRent. No cuenta en finanzas actuales.</p>
        <p><strong>Regularizado:</strong> mes considerado no reclamable o ya cerrado.</p>
        <p><strong>Pendiente:</strong> mes aún no cobrado. Sólo cuenta al registrar el cobro real.</p>
      </div>

      {groups.pendiente.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><AlertCircle size={12} className="text-rose-600" /> Pendientes históricos</h4>
          {groups.pendiente.map(p => <Row key={p.id} p={p} kind="pendiente" />)}
        </div>
      )}

      {groups.historico.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><Clock size={12} className="text-sky-600" /> Histórico reconstruido</h4>
          <div className="space-y-1.5">
            {groups.historico.map(p => <Row key={p.id} p={p} kind="historico" />)}
          </div>
        </div>
      )}

      {groups.regularizado.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><Badge className="px-1 py-0 text-[9px]">REG</Badge> Regularizados</h4>
          <div className="space-y-1.5">
            {groups.regularizado.map(p => <Row key={p.id} p={p} kind="regularizado" />)}
          </div>
        </div>
      )}

      {groups.real.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Pagos reales</h4>
          <div className="space-y-1.5">
            {groups.real.slice(0, 12).map(p => <Row key={p.id} p={p} kind="real" />)}
          </div>
          {groups.real.length > 12 && (
            <p className="text-[10px] text-muted-foreground">…y {groups.real.length - 12} más</p>
          )}
        </div>
      )}
    </div>

    <Dialog open={cobroOpen} onOpenChange={(o) => { if (!cobroSaving) setCobroOpen(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro real</DialogTitle>
          <DialogDescription>
            {cobroPago && (
              <>Convierte el pendiente de <strong>{MESES[cobroPago.mes - 1]} {cobroPago.anio}</strong> en un cobro real. Pasará a contar en dashboard y, si lo marcas, también en IRPF.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="cobro-importe" className="text-xs">Importe cobrado (€)</Label>
            <Input
              id="cobro-importe"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cobroImporte}
              onChange={(e) => setCobroImporte(e.target.value)}
              placeholder={contrato.renta_mensual ? String(contrato.renta_mensual) : "0,00"}
              className="mt-1"
            />
            {contrato.renta_mensual ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                Renta del contrato: {Number(contrato.renta_mensual).toLocaleString("es-ES")} €/mes
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="cobro-tipo" className="text-xs">Forma de pago</Label>
              <Select value={cobroTipo} onValueChange={setCobroTipo}>
                <SelectTrigger id="cobro-tipo" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="bizum">Bizum</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cobro-fecha" className="text-xs">Fecha del cobro</Label>
              <Input
                id="cobro-fecha"
                type="date"
                value={cobroFecha}
                onChange={(e) => setCobroFecha(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={cobroAfectaFiscalidad}
              onCheckedChange={(v) => setCobroAfectaFiscalidad(v === true)}
              className="mt-0.5"
            />
            <span>
              <strong>Incluir en IRPF</strong> del año fiscal correspondiente al devengo ({cobroPago?.anio}).
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCobroOpen(false)} disabled={cobroSaving}>Cancelar</Button>
          <Button onClick={handleConfirmarCobro} disabled={cobroSaving}>
            {cobroSaving ? "Registrando…" : "Registrar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            const c = confirm; setConfirm(null);
            if (c) await c.onConfirm();
          }}>{confirm?.actionLabel || "Confirmar"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={!!detalleOpen} onOpenChange={(o) => { if (!o) setDetalleOpen(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del registro</DialogTitle>
          <DialogDescription>
            {detalleOpen && <>{MESES[detalleOpen.mes - 1]} {detalleOpen.anio} · {KIND_LABEL[(detalleOpen.tipo_registro || "pago_real") === "pago_real" ? "real" : (detalleOpen.tipo_registro === "historico_reconstruido" ? "historico" : detalleOpen.tipo_registro!)]}</>}
          </DialogDescription>
        </DialogHeader>
        {detalleOpen && (
          <dl className="text-xs grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">Importe</dt>
            <dd className="font-mono">{Number(detalleOpen.importe_pagado || 0).toLocaleString("es-ES")} €</dd>
            <dt className="text-muted-foreground">Devengo</dt>
            <dd>{MESES[detalleOpen.mes - 1]} {detalleOpen.anio}</dd>
            <dt className="text-muted-foreground">Fecha cobro real</dt>
            <dd>{fmtFecha(detalleOpen.fecha_pago_real) || <span className="text-muted-foreground italic">—</span>}</dd>
            <dt className="text-muted-foreground">Fecha registro</dt>
            <dd>{fmtFecha(detalleOpen.created_at)}</dd>
            <dt className="text-muted-foreground">Origen</dt>
            <dd>{detalleOpen.origen || "—"}</dd>
            <dt className="text-muted-foreground">Cuenta tesorería</dt>
            <dd>{detalleOpen.afecta_finanzas_actuales === false ? "No" : (detalleOpen.tipo_registro === "pago_real" ? "Sí" : "No")}</dd>
            <dt className="text-muted-foreground">Cuenta IRPF</dt>
            <dd>{detalleOpen.afecta_fiscalidad ? "Sí" : "No"}</dd>
            {detalleOpen.notas_acuerdo && (<>
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="whitespace-pre-wrap">{detalleOpen.notas_acuerdo}</dd>
            </>)}
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDetalleOpen(null)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}