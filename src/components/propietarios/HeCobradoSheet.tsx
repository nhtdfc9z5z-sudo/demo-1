import { useState, useEffect, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Euro, Home, AlertTriangle, TrendingUp, Pencil, Ban, Plus, Trash2, Scale, Paperclip, Receipt, Image as ImageIcon, Camera, FileText, Clock, Ban as BanIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import type { Property } from "@/hooks/useProperties";
import type { Inquilino } from "@/hooks/useInquilinos";
import type { Contrato } from "@/hooks/useContratos";
import type { PagoRenta } from "@/hooks/usePagosRenta";
import { resolveRentaEsperada, calcularImporteEsperado, resolveFechasContrato } from "@/lib/rentaUtils";
import { detectarConflictoPagoCompleto } from "@/lib/sprint3/duplicadoPagoCompleto";
import { supabase } from "@/integrations/supabase/client";
import { usePagoCompensaciones, MOTIVOS_GASTO_AUTO, type CompensacionMotivo } from "@/hooks/usePagoCompensaciones";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const MOTIVO_LABEL: Record<CompensacionMotivo, string> = {
  reparacion: "Reparación",
  mantenimiento: "Mantenimiento",
  suministros: "Suministros",
  acuerdo: "Acuerdo / condonación",
  descuento: "Descuento pactado",
  otro: "Otro",
};

interface CompensacionRow {
  tempId: string;
  importe: string;
  motivo: CompensacionMotivo;
  descripcion: string;
  crearGasto: boolean;
  crearGastoTouched: boolean;
  deducible: boolean;
  file: File | null;
}

const newCompensacionRow = (motivo: CompensacionMotivo = "reparacion"): CompensacionRow => ({
  tempId: crypto.randomUUID(),
  importe: "",
  motivo,
  descripcion: "",
  crearGasto: MOTIVOS_GASTO_AUTO.includes(motivo),
  crearGastoTouched: false,
  deducible: MOTIVOS_GASTO_AUTO.includes(motivo),
  file: null,
});

interface HeCobradoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  inquilinos: Inquilino[];
  contratos?: Contrato[];
  /**
   * Pagos ya registrados. Sólo se usa para detectar el caso "pago único
   * por contrato/mes" en modalidad `completo` (Sprint 3 Fase D).
   * Si no se pasa, la detección se desactiva (comportamiento legacy).
   */
  pagos?: PagoRenta[];
  /**
   * Personas por contrato (inquilinos solidarios) para considerar match
   * vía `contrato_personas` además del titular.
   */
  personasPorContrato?: Record<string, string[]>;
  /**
   * Callback opcional: el usuario quiere editar el pago real ya
   * existente en vez de crear uno nuevo. Si no se pasa, el botón no
   * se muestra y sólo queda la opción de cancelar o registrar
   * complementario.
   */
  onEditarPagoExistente?: (pagoId: string, propertyId: string, mes: number, anio: number) => void;
  /**
   * Callback opcional: abrir el historial de rentas/pagos del activo
   * seleccionado. Si se pasa, se muestra un botón "Ver historial de
   * rentas" en el footer que cierra este sheet y delega en el handler.
   */
  onVerHistorialRentas?: (propertyId: string) => void;
  onConfirmar: (propertyId: string, inquilinoId: string, datos: {
    importe_pagado: number;
    tipo_pago: string;
    notas_acuerdo?: string;
  }, mes: number, anio: number) => Promise<void>;
  /** Necesario para insertar compensaciones / facturas con user_id. */
  userId?: string | null;
  initialPropertyId?: string;
  initialMes?: number;
  initialAnio?: number;
}

const HeCobradoSheet = ({ open, onOpenChange, properties, inquilinos, contratos, pagos, personasPorContrato, onEditarPagoExistente, onVerHistorialRentas, onConfirmar, userId, initialPropertyId, initialMes, initialAnio }: HeCobradoSheetProps) => {
  const now = new Date();
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id ?? null;
  const [propertyId, setPropertyId] = useState("");
  const [motivo, setMotivo] = useState<"renta" | "otro">("renta");
  const [importe, setImporte] = useState("");
  const [tipoPago, setTipoPago] = useState("transferencia");
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [permitirComplementario, setPermitirComplementario] = useState(false);
  const [compensaciones, setCompensaciones] = useState<CompensacionRow[]>([]);
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const camInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { create: createCompensacion } = usePagoCompensaciones({ userId: effectiveUserId, asOwner: true });
  const { toast } = useToast();

  // Pre-fill when initial values change and sheet opens
  useEffect(() => {
    if (open) {
      if (initialPropertyId) setPropertyId(initialPropertyId);
      if (initialMes != null) setMes(String(initialMes));
      if (initialAnio != null) setAnio(String(initialAnio));
      setPermitirComplementario(false);
      setCompensaciones([]);
    }
  }, [open, initialPropertyId, initialMes, initialAnio]);

  const propInquilinos = inquilinos.filter(
    i => i.property_id === propertyId && i.rol_inquilino !== "avalista" && (i.estado === "activo" || i.estado === "Activo")
  );

  // Reset acknowledgement whenever the (property, inquilino, periodo) target changes.
  useEffect(() => {
    setPermitirComplementario(false);
  }, [propertyId, mes, anio]);

  // Sprint 3 Fase D — detección de pago único por contrato/mes en modalidad completo.
  const duplicado = useMemo(() => {
    if (!propertyId || !pagos || !contratos || motivo !== "renta") return null;
    const tenant = propInquilinos[0];
    if (!tenant) return null;
    return detectarConflictoPagoCompleto({
      propertyId,
      inquilinoId: tenant.id,
      mes: parseInt(mes),
      anio: parseInt(anio),
      contratos: contratos as any,
      pagos: pagos as any,
      personasPorContrato,
    });
  }, [propertyId, pagos, contratos, propInquilinos, mes, anio, motivo, personasPorContrato]);

  const esDuplicadoCompleto = duplicado?.status === "duplicado_completo";
  const bloqueoActivo = esDuplicadoCompleto && !permitirComplementario;

  // Resolve rent and dates for selected property/month
  const renta = propertyId ? resolveRentaEsperada(propertyId, inquilinos, contratos || []) : null;
  const fechas = propertyId ? resolveFechasContrato(propertyId, inquilinos, contratos || []) : null;

  const esperado = useMemo(() => {
    if (!renta || !propertyId) return null;
    return calcularImporteEsperado(
      renta,
      parseInt(mes),
      parseInt(anio),
      fechas?.fechaInicio,
      fechas?.fechaFin,
    );
  }, [renta, propertyId, mes, anio, fechas?.fechaInicio, fechas?.fechaFin]);

  // Auto-fill importe from prorated amount when property/month changes
  useEffect(() => {
    if (propertyId && motivo === "renta" && esperado && !importe) {
      setImporte(String(esperado.importe));
    }
  }, [propertyId, motivo, esperado?.importe]);

  const formImporte = parseFloat(importe) || 0;
  const totalCompensado = useMemo(
    () => compensaciones.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0),
    [compensaciones],
  );
  const totalCubierto = formImporte + totalCompensado;

  // Incongruence: only warn if total cubierto (cobro + compensaciones) ≠ esperado.
  const showIncongruenceWarning = motivo === "renta" && esperado && esperado.importe > 0
    && !isNaN(formImporte) && Math.abs(totalCubierto - esperado.importe) > 0.01;

  const compensacionesValidas = compensaciones.every(c => {
    const imp = parseFloat(c.importe);
    if (!imp || imp <= 0) return false;
    return true;
  });

  /** Primera compensación marcada como gasto sin factura adjunta. */
  const compensacionPendienteFactura = compensaciones.find(c => c.crearGasto && !c.file);

  const addCompensacion = () => {
    setCompensaciones(prev => [...prev, newCompensacionRow()]);
  };
  const removeCompensacion = (tempId: string) => {
    setCompensaciones(prev => prev.filter(c => c.tempId !== tempId));
  };
  const updateCompensacion = (tempId: string, patch: Partial<CompensacionRow>) => {
    setCompensaciones(prev => prev.map(c => {
      if (c.tempId !== tempId) return c;
      const next = { ...c, ...patch };
      // Si el usuario aún no ha tocado el checkbox de gasto, auto-ajustar
      // según el motivo (regla: reparación/mantenimiento/suministros ⇒ gasto).
      if (patch.motivo && !next.crearGastoTouched) {
        const auto = MOTIVOS_GASTO_AUTO.includes(patch.motivo);
        next.crearGasto = auto;
        next.deducible = auto;
      }
      return next;
    }));
  };

  /** Sube el archivo a `facturas` bucket y devuelve {url, path, nombre}. */
  const uploadFactura = async (file: File, uid: string): Promise<{ url: string; path: string; nombre: string }> => {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("facturas").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: pub } = await supabase.storage
      .from("facturas")
      .createSignedUrl(path, 3600);
    return { url: pub?.signedUrl || "", path, nombre: file.name };
  };

  const handleConfirmClick = () => {
    if (!propertyId || !importe) return;
    if (bloqueoActivo) return;
    if (!compensacionesValidas) {
      toast({
        title: "Compensaciones incompletas",
        description: "Cada compensación necesita un importe mayor que 0.",
        variant: "destructive",
      });
      return;
    }
    if (compensacionPendienteFactura) {
      setFacturaDialogOpen(true);
      return;
    }
    void handleSubmit();
  };

  const handleFacturaPicked = (file: File | null) => {
    if (file && compensacionPendienteFactura) {
      updateCompensacion(compensacionPendienteFactura.tempId, { file });
    }
    setFacturaDialogOpen(false);
    // Pequeño defer para que el state del file se aplique antes de submit.
    setTimeout(() => { void handleSubmit(); }, 0);
  };

  /** El usuario indica que esta compensación NO tiene factura → no se registrará como gasto del propietario. */
  const handleSinFactura = () => {
    if (compensacionPendienteFactura) {
      updateCompensacion(compensacionPendienteFactura.tempId, {
        crearGasto: false,
        crearGastoTouched: true,
        deducible: false,
        file: null,
      });
    }
    setFacturaDialogOpen(false);
    setTimeout(() => { void handleSubmit(); }, 0);
  };

  const handleSubmit = async () => {
    if (!propertyId || !importe) return;
    if (bloqueoActivo) return;
    setLoading(true);
    try {
      const tenant = propInquilinos[0];
      if (!tenant) return;
      const mesNum = parseInt(mes);
      const anioNum = parseInt(anio);

      // 1) Registrar el cobro real (sólo el dinero que entra en banco/caja).
      const notasFinales = (() => {
        const base = motivo === "otro" ? notas : (notas || undefined);
        const tags: string[] = [];
        if (esDuplicadoCompleto && permitirComplementario) tags.push("[Pago complementario]");
        if (compensaciones.length > 0 && totalCompensado > 0) {
          tags.push(`[Compensado ${totalCompensado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€]`);
        }
        const tagStr = tags.join(" ");
        return tagStr ? (base ? `${tagStr} ${base}` : tagStr) : base;
      })();

      await onConfirmar(
        propertyId,
        tenant.id,
        {
          importe_pagado: parseFloat(importe),
          tipo_pago: tipoPago,
          notas_acuerdo: notasFinales,
        },
        mesNum,
        anioNum,
      );

      // 2) Si hay compensaciones, buscamos el pago real recién upsert-eado
      // para enlazarlas correctamente.
      if (compensaciones.length > 0 && effectiveUserId) {
        const { data: pagoRow, error: readErr } = await supabase
          .from("pagos_renta")
          .select("id, contrato_id")
          .eq("property_id", propertyId)
          .eq("inquilino_id", tenant.id)
          .eq("mes", mesNum)
          .eq("anio", anioNum)
          .maybeSingle();
        if (readErr || !pagoRow?.id) {
          throw readErr || new Error("No se ha podido localizar el pago recién creado.");
        }

        for (const c of compensaciones) {
          const imp = parseFloat(c.importe);
          let factura_id: string | null = null;
          let documento_url: string | null = null;
          let documento_path: string | null = null;

          // 2.a) Subida del archivo (siempre que exista) → facturas bucket.
          if (c.file) {
            const uploaded = await uploadFactura(c.file, effectiveUserId);
            documento_url = uploaded.url;
            documento_path = uploaded.path;

            // 2.b) Si pidió crear gasto, registramos también en `facturas`.
            if (c.crearGasto) {
              const { data: facturaRow, error: facErr } = await supabase
                .from("facturas")
                .insert({
                  user_id: effectiveUserId,
                  property_id: propertyId,
                  archivo_url: uploaded.url,
                  storage_path: uploaded.path,
                  archivo_nombre: uploaded.nombre,
                  total: imp,
                  base_imponible: imp,
                  fecha: new Date().toISOString().slice(0, 10),
                  fecha_devengo: `${anioNum}-${String(mesNum).padStart(2, "0")}-01`,
                  ano_fiscal: anioNum,
                  categoria: c.motivo === "suministros" ? "suministros" : (c.motivo === "mantenimiento" ? "mantenimiento" : "reparacion"),
                  deducible_irpf: c.deducible,
                  forma_pago: "compensacion_inquilino",
                  notas: [
                    "Gasto pagado por inquilino (compensación de renta)",
                    c.descripcion?.trim(),
                  ].filter(Boolean).join(" · "),
                } as any)
                .select("id")
                .maybeSingle();
              if (facErr) throw facErr;
              factura_id = (facturaRow as any)?.id ?? null;
            }
          }

          await createCompensacion({
            user_id: effectiveUserId,
            pago_renta_id: pagoRow.id as string,
            property_id: propertyId,
            inquilino_id: tenant.id,
            contrato_id: (pagoRow as any).contrato_id ?? null,
            mes: mesNum,
            anio: anioNum,
            importe: imp,
            motivo: c.motivo,
            descripcion: c.descripcion?.trim() || null,
            crear_gasto: c.crearGasto,
            deducible: c.deducible,
            documento_url,
            documento_path,
            factura_id,
          });
        }

        toast({
          title: "Cobro y compensación registrados",
          description: `Caja: ${formImporte.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€ · Compensado: ${totalCompensado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€`,
        });
      }

      onOpenChange(false);
      setPropertyId("");
      setImporte("");
      setNotas("");
      setMotivo("renta");
      setPermitirComplementario(false);
      setCompensaciones([]);
    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err?.message || "No se pudo registrar la liquidación.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Euro size={20} className="text-primary" />
            He cobrado
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Property selector */}
          <div>
            <Label className="text-xs font-medium">Vivienda *</Label>
            <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setImporte(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona activo" />
              </SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <Home size={14} className="text-muted-foreground" />
                      {p.nombre_interno}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs: Renta / Otro */}
          <Tabs value={motivo} onValueChange={(v) => setMotivo(v as "renta" | "otro")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="renta">Renta mensual</TabsTrigger>
              <TabsTrigger value="otro">Otro motivo</TabsTrigger>
            </TabsList>
            <TabsContent value="otro" className="mt-3">
              <div>
                <Label className="text-xs">Motivo / Concepto</Label>
                <Textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Devolución de fianza, pago parcial..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Proration info */}
          {motivo === "renta" && esperado?.esProrrata && esperado.importe > 0 && (
            <div className="flex items-start gap-2 text-xs bg-primary/5 border border-primary/20 rounded-lg p-2.5">
              <TrendingUp size={14} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary">Prorrata aplicada</p>
                <p className="text-muted-foreground">
                  {esperado.diasOcupados} de {esperado.diasMes} días →
                  Esperado: {esperado.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                  <span className="ml-1 italic">(renta completa: {renta}€)</span>
                </p>
              </div>
            </div>
          )}

          {motivo === "renta" && esperado?.importe === 0 && esperado?.esProrrata && (
            <div className="flex items-start gap-2 text-xs bg-muted/50 border border-border rounded-lg p-2.5">
              <AlertTriangle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                El contrato no está vigente en {MESES[parseInt(mes) - 1]} {anio}. No se espera cobro.
              </p>
            </div>
          )}

          {/* Sprint 3 Fase D — Duplicado en modalidad completo */}
          {esDuplicadoCompleto && (
            <div className="flex flex-col gap-2 text-xs bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Ban size={14} className="text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">
                    Ya existe un cobro registrado para este contrato en {MESES[parseInt(mes) - 1]} {anio}.
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Este contrato es de modalidad <span className="font-medium">completo</span>:
                    se espera un único pago por mes. Importe ya registrado:{" "}
                    <span className="font-medium">
                      {Number(duplicado?.pagoExistente?.importe_pagado ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                    </span>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-6">
                {onEditarPagoExistente && duplicado?.pagoExistente && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pago = duplicado.pagoExistente!;
                      onEditarPagoExistente(pago.id, propertyId, parseInt(mes), parseInt(anio));
                      onOpenChange(false);
                    }}
                  >
                    <Pencil size={12} /> Editar el pago existente
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={permitirComplementario ? "default" : "ghost"}
                  onClick={() => setPermitirComplementario(v => !v)}
                >
                  {permitirComplementario ? "Cancelar complementario" : "Registrar pago complementario"}
                </Button>
              </div>
              {permitirComplementario && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  Se guardará como pago parcial complementario al ya existente, con la nota
                  "[Pago complementario]". Solo úsalo si el primer pago no cubrió la renta completa.
                </p>
              )}
            </div>
          )}

          {duplicado?.status === "ambiguo" && (
            <div className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
              <AlertTriangle size={14} className="text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-700">
                Hay más de un contrato cubriendo este mes. No bloqueamos el registro,
                pero revisa que estás cobrando del contrato correcto.
              </p>
            </div>
          )}

          {/* Amount & payment type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Importe (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={importe}
                onChange={e => setImporte(e.target.value)}
                placeholder={esperado ? `${esperado.importe}` : "0.00"}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Método de pago</Label>
              <Select value={tipoPago} onValueChange={setTipoPago}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="bizum">Bizum</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="domiciliacion">Domiciliación</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incongruence warning */}
          {showIncongruenceWarning && (
            <div className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
              <AlertTriangle size={14} className="text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-700">
                Total cubierto ({totalCubierto.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€)
                ≠ renta esperada ({esperado!.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€).
                Suma cobro real + compensaciones.
              </p>
            </div>
          )}

          {/* Compensaciones (liquidación mixta) */}
          {motivo === "renta" && propertyId && (
            compensaciones.length === 0 ? (
              <button
                type="button"
                onClick={addCompensacion}
                className="w-full text-left rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/15 hover:border-primary/60 transition-colors p-3 space-y-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale size={14} className="text-primary" />
                    <Label className="text-xs font-medium cursor-pointer">Compensaciones (no entran en caja)</Label>
                  </div>
                  <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-sm">
                    <Plus size={14} /> Añadir
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Úsalas si el inquilino ha pagado parte de la renta de otra forma (ej. una reparación que correspondía al propietario). Cubre renta pero no aumenta tu caja.
                </p>
              </button>
            ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale size={14} className="text-primary" />
                  <Label className="text-xs font-medium">Compensaciones (no entran en caja)</Label>
                </div>
                <Button type="button" size="sm" onClick={addCompensacion} className="h-7 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  <Plus size={14} className="mr-1" /> Añadir
                </Button>
              </div>

              {compensaciones.map((c) => (
                <div key={c.tempId} className="rounded-md border border-border bg-background p-2.5 space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <Label className="text-[11px]">Importe (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={c.importe}
                        onChange={e => updateCompensacion(c.tempId, { importe: e.target.value })}
                        className="mt-0.5 h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Motivo</Label>
                      <Select value={c.motivo} onValueChange={(v) => updateCompensacion(c.tempId, { motivo: v as CompensacionMotivo })}>
                        <SelectTrigger className="mt-0.5 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(MOTIVO_LABEL) as CompensacionMotivo[]).map(k => (
                            <SelectItem key={k} value={k}>{MOTIVO_LABEL[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCompensacion(c.tempId)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <Textarea
                    value={c.descripcion}
                    onChange={e => updateCompensacion(c.tempId, { descripcion: e.target.value })}
                    placeholder="Descripción (ej. reparación caldera, factura del fontanero...)"
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={c.crearGasto}
                        onCheckedChange={(v) => updateCompensacion(c.tempId, { crearGasto: !!v, crearGastoTouched: true, deducible: !!v ? c.deducible : false })}
                      />
                      <span>Registrar también como gasto del propietario</span>
                    </label>
                    {c.crearGasto && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={c.deducible}
                          onCheckedChange={(v) => updateCompensacion(c.tempId, { deducible: !!v })}
                        />
                        <span>Deducible IRPF</span>
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Paperclip size={12} className="text-muted-foreground" />
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={e => updateCompensacion(c.tempId, { file: e.target.files?.[0] || null })}
                      className="h-7 text-[11px] file:mr-2 file:py-0 file:px-2"
                    />
                  </div>
                  {c.crearGasto && !c.file && (
                    <p className="text-[11px] text-muted-foreground">Podrás adjuntar la factura ahora o más adelante.</p>
                  )}
                </div>
              ))}

              {/* Resumen de cobertura */}
              {esperado && esperado.importe > 0 && compensaciones.length > 0 && (
                <div className="rounded-md bg-background border border-border p-2.5 text-[11px] space-y-0.5 font-mono">
                  <div className="flex justify-between"><span>Renta esperada</span><span>{esperado.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</span></div>
                  <div className="flex justify-between"><span>Cobro real (caja)</span><span>{formImporte.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</span></div>
                  <div className="flex justify-between"><span>Compensado</span><span>{totalCompensado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-border mt-1">
                    <span>Total cubierto</span>
                    <span className={Math.abs(totalCubierto - esperado.importe) < 0.01 ? "text-emerald-600" : "text-yellow-600"}>
                      {totalCubierto.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                    </span>
                  </div>
                </div>
              )}
            </div>
            )
          )}

          {/* Month & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mes</Label>
              <Select value={mes} onValueChange={v => { setMes(v); setImporte(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Select value={anio} onValueChange={v => { setAnio(v); setImporte(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => now.getFullYear() + 1 - i).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {motivo === "renta" && (
            <div>
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
                className="mt-1"
              />
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          {onVerHistorialRentas && propertyId && (
            <Button
              variant="ghost"
              onClick={() => {
                const pid = propertyId;
                onOpenChange(false);
                onVerHistorialRentas(pid);
              }}
            >
              Ver historial de rentas
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmClick}
            disabled={!propertyId || !importe || loading || propInquilinos.length === 0 || bloqueoActivo}
          >
            {loading ? "Guardando..." : bloqueoActivo ? "Bloqueado: duplicado" : (permitirComplementario ? "Registrar complementario" : "Confirmar cobro")}
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Diálogo: ¿Adjuntar factura ahora? */}
      <AlertDialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Receipt size={18} className="text-primary" /> ¿Quieres añadir la factura?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Has marcado una compensación como gasto. Puedes adjuntar la factura ahora, hacerlo más adelante, o indicar que no tienes factura (no se registrará como gasto del propietario).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => imgInputRef.current?.click()}>
              <ImageIcon size={18} className="text-primary" />
              <span className="text-xs font-medium">Subir foto</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => camInputRef.current?.click()}>
              <Camera size={18} className="text-primary" />
              <span className="text-xs font-medium">Hacer foto</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => pdfInputRef.current?.click()}>
              <FileText size={18} className="text-primary" />
              <span className="text-xs font-medium">Subir PDF</span>
            </Button>
          </div>

          <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFacturaPicked(e.target.files?.[0] || null)} />
          <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => handleFacturaPicked(e.target.files?.[0] || null)} />
          <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={e => handleFacturaPicked(e.target.files?.[0] || null)} />

          <AlertDialogFooter className="mt-2">
            <Button variant="ghost" className="gap-1.5" onClick={handleSinFactura}>
              <BanIcon size={14} /> Sin factura
            </Button>
            <Button variant="ghost" className="gap-1.5" onClick={() => handleFacturaPicked(null)}>
              <Clock size={14} /> Más adelante
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default HeCobradoSheet;
