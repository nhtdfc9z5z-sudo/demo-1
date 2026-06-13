import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Pencil, Loader2, ArrowLeft, Check, FileText, Receipt, Zap, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { crearGasto, CATEGORIAS_GASTO_VALIDAS, type CategoriaGasto } from "@/lib/gastos/crearGasto";
import type { Property } from "@/hooks/useProperties";
import { validateFile } from "@/lib/fileValidation";
import { useProveedores } from "@/hooks/useProveedores";
import { useFacturas } from "@/hooks/useFacturas";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFiscalChain } from "@/lib/queryInvalidation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  defaultPropertyId?: string | null;
  onCreated?: () => void;
}

const CATEGORIA_LABEL: Record<CategoriaGasto, string> = {
  ibi: "IBI",
  comunidad: "Comunidad de propietarios",
  suministros: "Suministros",
  seguro_vivienda: "Seguro",
  seguro_impago: "Seguro de impago",
  reformas: "Obra/reforma",
  mantenimiento: "Mantenimiento",
  arreglos: "Arreglos",
  amortizacion: "Amortización",
  compras: "Compras/mobiliario",
  honorarios: "Honorarios gestor",
  otro: "Otros",
};

type Step = 1 | 2 | 3;
type Modo = "gasto" | "factura";

interface FormState {
  property_id: string;
  fecha: string;             // Fecha del documento
  fecha_pago: string;        // Solo modo factura
  fecha_devengo: string;     // Solo modo factura
  importe: string;
  proveedor: string;
  nif_proveedor: string;
  concepto: string;
  categoria: CategoriaGasto | "";
  // Modo factura formal
  numero_factura: string;
  base_imponible: string;
  iva_porcentaje: string;
  cuota_iva: string;
  exento_iva: boolean;
  deducible_irpf: boolean;
  // Copropiedad
  gasto_compartido: boolean;
  porcentaje_usuario: string;
}

const emptyForm = (propertyId?: string | null): FormState => ({
  property_id: propertyId || "",
  fecha: new Date().toISOString().slice(0, 10),
  fecha_pago: "",
  fecha_devengo: "",
  importe: "",
  proveedor: "",
  nif_proveedor: "",
  concepto: "",
  categoria: "",
  numero_factura: "",
  base_imponible: "",
  iva_porcentaje: "",
  cuota_iva: "",
  exento_iva: false,
  deducible_irpf: true,
  gasto_compartido: false,
  porcentaje_usuario: "100",
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || "").split(",")[1] || "");
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

function guessCategoria(text: string): CategoriaGasto | "" {
  if (!text) return "";
  const t = text.toLowerCase();
  if (/(ibi|impuesto.*bienes)/.test(t)) return "ibi";
  if (/(comunidad|propietarios)/.test(t)) return "comunidad";
  if (/(luz|agua|gas|electric|endesa|iberdrola|naturgy|suministr)/.test(t)) return "suministros";
  if (/(reforma|obra)/.test(t)) return "reformas";
  if (/(mantenim)/.test(t)) return "mantenimiento";
  if (/(arregl|reparac|fontaner|electricis|cerrajer)/.test(t)) return "arreglos";
  if (/(seguro)/.test(t)) return "seguro_vivienda";
  if (/(gestor|asesor|honorari)/.test(t)) return "honorarios";
  if (/(amortiz)/.test(t)) return "amortizacion";
  if (/(mueble|mobiliar|compra)/.test(t)) return "compras";
  return "otro";
}

/** Concatena líneas de detalle del OCR para pre-rellenar Concepto. */
export function buildConceptoFromOCR(r: Record<string, unknown>): string {
  const lineas = Array.isArray(r.factura_detalle_lineas)
    ? (r.factura_detalle_lineas as unknown[]).map(x => String(x || "").trim()).filter(Boolean)
    : [];
  if (lineas.length > 0) return lineas.join(" · ");
  const general = typeof r.factura_concepto === "string" ? r.factura_concepto.trim() : "";
  return general;
}

export default function GastoRapidoSheet({ open, onOpenChange, properties, defaultPropertyId, onCreated }: Props) {
  const { toast } = useToast();
  const { findExisting, findOrCreate } = useProveedores();
  const { createManual: createFactura, uploadAndAnalyze: uploadFacturaFile } = useFacturas();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [modo, setModo] = useState<Modo>("gasto");
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultPropertyId));
  const [conceptoEditado, setConceptoEditado] = useState(false);
  const [mostrarFiscal, setMostrarFiscal] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocrProcesado, setOcrProcesado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const propsOrdenadas = useMemo(
    () => [...properties].sort((a, b) => (a.nombre_interno || "").localeCompare(b.nombre_interno || "")),
    [properties],
  );

  // Activo seleccionado (para detectar copropiedad).
  const activo = useMemo(
    () => properties.find(p => p.id === form.property_id) || null,
    [properties, form.property_id],
  );
  const admiteCopropiedad = useMemo(() => {
    const p = Number((activo as any)?.porcentaje_participacion ?? 100);
    return Number.isFinite(p) && p < 100;
  }, [activo]);

  const reset = () => {
    setStep(1);
    setModo("gasto");
    setForm(emptyForm(defaultPropertyId));
    setConceptoEditado(false);
    setMostrarFiscal(false);
    setArchivo(null);
    setOcrProcesado(false);
    setLoading(false);
    setSaving(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    const v = validateFile(file, "document");
    if (!v.valid) {
      toast({ title: "Archivo no válido", description: v.error, variant: "destructive" });
      return;
    }
    setArchivo(file);
    setStep(2);
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-factura", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error || !data || (data as any).error) {
        throw new Error((data as any)?.error || error?.message || "OCR no disponible");
      }
      const r = data as Record<string, unknown>;
      const next: FormState = { ...form };
      const total = typeof r.factura_total === "number" ? r.factura_total : Number(r.factura_total) || 0;
      if (total > 0) next.importe = String(total);
      const fecha = typeof r.factura_fecha === "string" ? r.factura_fecha : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) next.fecha = fecha;
      const proveedor = typeof r.factura_emisor_nombre === "string" ? r.factura_emisor_nombre.trim() : "";
      if (proveedor) next.proveedor = proveedor;
      const nif = typeof r.factura_emisor_nif === "string" ? r.factura_emisor_nif.trim() : "";
      if (nif) next.nif_proveedor = nif;
      const cat = guessCategoria(`${proveedor} ${r.factura_concepto || ""}`);
      if (cat) next.categoria = cat;
      // Mejora 2: pre-rellenar concepto desde OCR (líneas o concepto general).
      // Si el usuario ya editó el concepto manualmente, nunca lo sobrescribimos.
      const concepto = buildConceptoFromOCR(r);
      if (concepto && !conceptoEditado) next.concepto = concepto;
      // Datos factura formal
      const numero = typeof r.factura_numero === "string" ? r.factura_numero.trim() : "";
      if (numero) next.numero_factura = numero;
      const base = Number(r.factura_base_imponible ?? 0);
      if (base > 0) next.base_imponible = String(base);
      const ivaPct = Number(r.factura_iva_porcentaje ?? 0);
      const cuota = Number(r.factura_cuota_iva ?? 0);
      if (ivaPct === 0 && cuota === 0 && base > 0 && total > 0 && Math.abs(base - total) < 0.01) {
        // Documento exento de IVA
        next.exento_iva = true;
      } else {
        if (ivaPct > 0) next.iva_porcentaje = String(ivaPct);
        if (cuota > 0) next.cuota_iva = String(cuota);
      }
      // Sugerir modo automáticamente si el OCR detecta factura formal,
      // pero el usuario sigue siendo quien confirma con el radio.
      const looksFormal = ivaPct > 0 || !!numero || (base > 0 && cuota > 0);
      if (looksFormal) setModo("factura");
      setForm(next);
      setOcrProcesado(true);
      setStep(3);
    } catch {
      toast({
        title: "No se pudo analizar el documento",
        description: "Puedes introducir los datos manualmente.",
        variant: "destructive",
      });
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // Recalcular cuota IVA cuando cambian base e iva%.
  const recalcularIva = (base: string, pct: string) => {
    const b = Number(base);
    const p = Number(pct);
    if (b > 0 && p > 0) return (b * p / 100).toFixed(2);
    return "";
  };

  const validForSave = (): string | null => {
    if (!form.property_id) return "Selecciona el activo";
    if (!form.categoria) return "Selecciona una categoría";
    if (!form.fecha) return "Indica la fecha";
    const imp = Number(form.importe);
    if (!imp || imp <= 0) return "Importe debe ser mayor que 0";
    // Modo factura: si no se aportan datos fiscales, se infieren del importe total.
    if (form.gasto_compartido) {
      const p = Number(form.porcentaje_usuario);
      if (!(p > 0 && p <= 100)) return "Porcentaje del usuario inválido (1–100)";
    }
    return null;
  };

  const guardarComoGasto = async () => {
    // Resolver proveedor (CIF exacto → nombre normalizado exacto → crear).
    let proveedorId: string | null = null;
    if (form.proveedor.trim() || form.nif_proveedor.trim()) {
      const existing = findExisting(form.nif_proveedor || null, form.proveedor || null);
      if (existing) proveedorId = existing.id;
      else if (form.proveedor.trim()) {
        const created = await findOrCreate({
          nombre: form.proveedor.trim(),
          cif: form.nif_proveedor.trim() || null,
        });
        proveedorId = created?.id || null;
      }
    }
    // Opción A: separar fecha operativa (hoy) y fecha de documento (devengo).
    // El campo visible "Fecha" representa la fecha del documento.
    const hoy = new Date().toISOString().slice(0, 10);
    await crearGasto({
      property_id: form.property_id,
      fecha: hoy,
      fecha_devengo: form.fecha || hoy,
      importe: Number(form.importe),
      categoria: form.categoria as CategoriaGasto,
      proveedor: form.proveedor || null,
      nif_proveedor: form.nif_proveedor || null,
      proveedor_id: proveedorId,
      concepto: form.concepto || null,
      archivo,
      ocrProcesado,
      gasto_compartido: form.gasto_compartido,
      porcentaje_usuario: form.gasto_compartido ? Number(form.porcentaje_usuario) : null,
    });
  };

  const guardarComoFactura = async () => {
    // Resolver proveedor.
    let proveedorId: string | null = null;
    if (form.proveedor.trim() || form.nif_proveedor.trim()) {
      const existing = findExisting(form.nif_proveedor || null, form.proveedor || null);
      if (existing) proveedorId = existing.id;
      else if (form.proveedor.trim()) {
        const created = await findOrCreate({
          nombre: form.proveedor.trim(),
          cif: form.nif_proveedor.trim() || null,
        });
        proveedorId = created?.id || null;
      }
    }
    const total = Number(form.importe);
    const base = form.exento_iva ? total : Number(form.base_imponible) || total;
    const iva = form.exento_iva ? 0 : (Number(form.iva_porcentaje) || 0);
    const cuota = form.exento_iva ? 0 : (Number(form.cuota_iva) || 0);
    const overrides = {
      property_id: form.property_id || null,
      emisor_nombre: form.proveedor || null,
      emisor_nif: form.nif_proveedor || null,
      receptor_nombre: profile?.nombre || null,
      receptor_nif: profile?.nif || null,
      numero_factura: form.numero_factura || null,
      fecha: form.fecha || null,
      // Defaults internos: si el usuario no abre los detalles fiscales, devengo y pago = fecha.
      fecha_devengo: form.fecha_devengo || form.fecha || null,
      fecha_pago: form.fecha_pago || form.fecha || null,
      base_imponible: base,
      iva_porcentaje: iva,
      cuota_iva: cuota,
      total,
      categoria: form.categoria || "otro",
      deducible_irpf: form.deducible_irpf,
      proveedor_id: proveedorId,
    };
    const ok = archivo
      ? await uploadFacturaFile(archivo, form.property_id || null, overrides)
      : await createFactura({ ...overrides, total });
    if (!ok) throw new Error("No se pudo guardar la factura");
  };

  const handleGuardar = async () => {
    const err = validForSave();
    if (err) {
      toast({ title: "Faltan datos", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (modo === "factura") {
        await guardarComoFactura();
        qc.invalidateQueries({ queryKey: ["facturas"] });
      } else {
        await guardarComoGasto();
        qc.invalidateQueries({ queryKey: ["gastos"] });
        qc.invalidateQueries({ queryKey: ["property_documentos"] });
      }
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      invalidateFiscalChain(qc);
      // Opción B: si el documento es de otro año, avisar dónde encontrarlo.
      const anioDoc = /^\d{4}-/.test(form.fecha) ? Number(form.fecha.slice(0, 4)) : null;
      const anioActual = new Date().getFullYear();
      const baseTitle = modo === "factura" ? "Factura registrada" : "Gasto registrado correctamente";
      if (modo === "gasto" && anioDoc && anioDoc !== anioActual) {
        toast({
          title: baseTitle,
          description: `El documento es de ${anioDoc}. Puedes verlo en Finanzas filtrando por ese año.`,
        });
      } else {
        toast({ title: baseTitle });
      }
      onCreated?.();
      handleClose(false);
    } catch (e) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const stepLabel = (n: number, total: number) => (
    <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Paso {n} de {total}</div>
  );

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold tracking-tight">🧾 Nuevo gasto</SheetTitle>
        </SheetHeader>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 space-y-5"
        >
          {/* Paso 1: selector de activo + método */}
          {step === 1 && (
            <div className="space-y-4">
              {stepLabel(1, 3)}
              <div className="space-y-1.5">
                <Label htmlFor="paso1-activo" className="text-sm font-medium">Activo *</Label>
                <Select
                  value={form.property_id}
                  onValueChange={(v) => setForm({ ...form, property_id: v })}
                >
                  <SelectTrigger id="paso1-activo"><SelectValue placeholder="Selecciona activo…" /></SelectTrigger>
                  <SelectContent>
                    {propsOrdenadas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {(p as any).nombre_interno || (p as any).direccion || "Activo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">Necesario para vincular el gasto al activo correcto.</div>
              </div>

              <div className="text-base text-muted-foreground pt-2">¿Cómo quieres añadir el gasto?</div>
              <div className="grid gap-3">
                <button
                  type="button"
                  disabled={!form.property_id}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors text-left min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="text-primary shrink-0" size={22} />
                  <div>
                    <div className="font-semibold">📎 Subir PDF o foto</div>
                    <div className="text-xs text-muted-foreground">Lo analizaremos automáticamente</div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!form.property_id}
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors text-left min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="text-primary shrink-0" size={22} />
                  <div>
                    <div className="font-semibold">📷 Hacer foto</div>
                    <div className="text-xs text-muted-foreground">Con la cámara del dispositivo</div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!form.property_id}
                  onClick={() => { setOcrProcesado(false); setStep(3); }}
                  className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors text-left min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil className="text-primary shrink-0" size={22} />
                  <div>
                    <div className="font-semibold">✏️ Introducir manualmente</div>
                    <div className="text-xs text-muted-foreground">Sin documento</div>
                  </div>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {stepLabel(2, 3)}
              <div className="flex items-center gap-3 p-6 rounded-xl border bg-accent/30">
                <Loader2 className="animate-spin text-primary" size={24} />
                <div>
                  <div className="font-semibold">Analizando documento…</div>
                  <div className="text-xs text-muted-foreground">Extrayendo importe, fecha y proveedor</div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: tipo de documento + formulario */}
          {step === 3 && (
            <div className="space-y-5">
              {stepLabel(3, 3)}

              {/* Selector tipo de documento (Mejora 5) */}
              <div className="rounded-xl border p-3 space-y-2">
                <div className="text-sm font-semibold">¿Cómo quieres registrar este documento?</div>
                <RadioGroup
                  value={modo}
                  onValueChange={(v) => setModo(v as Modo)}
                  className="space-y-2 pt-1"
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="gasto" id="modo-gasto" className="mt-1" />
                    <div>
                      <div className="font-medium flex items-center gap-2"><Zap size={14} className="text-primary" /> Gasto rápido</div>
                      <div className="text-xs text-muted-foreground">Registra el importe en tus gastos operativos</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="factura" id="modo-factura" className="mt-1" />
                    <div>
                      <div className="font-medium flex items-center gap-2"><Receipt size={14} className="text-primary" /> Factura formal para IRPF</div>
                      <div className="text-xs text-muted-foreground">Incluye IVA y datos fiscales completos</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Activo: resumen visual (ya elegido en paso 1) */}
              <div className="flex items-center justify-between rounded-lg border bg-accent/30 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Activo</span>
                  <span className="font-medium truncate">
                    {(activo as any)?.nombre_interno || (activo as any)?.direccion || "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-primary underline underline-offset-2 shrink-0"
                >
                  Cambiar
                </button>
              </div>

              {/* Importe */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Importe (€) *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.importe}
                  onChange={(e) => setForm({ ...form, importe: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              {/* Fecha (única en modo simple) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Fecha *</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>

              {/* Categoría */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Categoría *</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v as CategoriaGasto })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_GASTO_VALIDAS.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Proveedor (emisor) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Proveedor</Label>
                <Input
                  value={form.proveedor}
                  onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>
              {(form.nif_proveedor || modo === "factura") && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">NIF / CIF proveedor</Label>
                  <Input
                    value={form.nif_proveedor}
                    onChange={(e) => setForm({ ...form, nif_proveedor: e.target.value })}
                  />
                </div>
              )}

              {/* Concepto */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Concepto / descripción</Label>
                <Textarea
                  value={form.concepto}
                  onChange={(e) => { setConceptoEditado(true); setForm({ ...form, concepto: e.target.value }); }}
                  rows={2}
                  placeholder="Detalles del gasto"
                />
                {!conceptoEditado && form.concepto && ocrProcesado && (
                  <div className="text-[11px] text-muted-foreground">Sugerido por OCR · editable</div>
                )}
              </div>

              {/* Detalles fiscales colapsables */}
              <div className="rounded-xl border">
                <button
                  type="button"
                  onClick={() => setMostrarFiscal(o => !o)}
                  aria-expanded={mostrarFiscal}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/40 rounded-xl"
                >
                  <div className="text-xs text-muted-foreground">
                    {form.exento_iva ? "Exento de IVA" : `IVA ${form.iva_porcentaje || "—"}%`}
                    {" · "}
                    {form.deducible_irpf ? "Deducible en IRPF" : "No deducible"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary">
                    {mostrarFiscal ? "Ocultar detalles fiscales" : "Ver detalles fiscales"}
                    <motion.span animate={{ rotate: mostrarFiscal ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} />
                    </motion.span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {mostrarFiscal && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t p-3 space-y-3 bg-teal-500/[0.03]">
                        {modo === "factura" && (
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Nº factura</Label>
                            <Input
                              value={form.numero_factura}
                              onChange={(e) => setForm({ ...form, numero_factura: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Fecha de pago</Label>
                            <Input
                              type="date"
                              value={form.fecha_pago}
                              onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })}
                              placeholder={form.fecha}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Fecha de devengo</Label>
                            <Input
                              type="date"
                              value={form.fecha_devengo}
                              onChange={(e) => setForm({ ...form, fecha_devengo: e.target.value })}
                              placeholder={form.fecha}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="exento-iva"
                            checked={form.exento_iva}
                            onCheckedChange={(c) => setForm({
                              ...form,
                              exento_iva: !!c,
                              iva_porcentaje: c ? "0" : form.iva_porcentaje,
                              cuota_iva: c ? "0" : form.cuota_iva,
                            })}
                          />
                          <Label htmlFor="exento-iva" className="text-sm">Exento de IVA</Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Base imponible</Label>
                            <Input
                              type="number"
                              step="0.01"
                              disabled={form.exento_iva}
                              value={form.exento_iva ? form.importe : form.base_imponible}
                              onChange={(e) => {
                                const base = e.target.value;
                                setForm({
                                  ...form,
                                  base_imponible: base,
                                  cuota_iva: recalcularIva(base, form.iva_porcentaje) || form.cuota_iva,
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">IVA %{form.exento_iva ? " (Exento)" : ""}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              disabled={form.exento_iva}
                              value={form.exento_iva ? "0" : form.iva_porcentaje}
                              onChange={(e) => {
                                const pct = e.target.value;
                                setForm({
                                  ...form,
                                  iva_porcentaje: pct,
                                  cuota_iva: recalcularIva(form.base_imponible, pct) || form.cuota_iva,
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Cuota IVA{form.exento_iva ? " (Exento)" : ""}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              disabled={form.exento_iva}
                              value={form.exento_iva ? "0" : form.cuota_iva}
                              onChange={(e) => setForm({ ...form, cuota_iva: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox
                            id="deducible-irpf"
                            checked={form.deducible_irpf}
                            onCheckedChange={(c) => setForm({ ...form, deducible_irpf: !!c })}
                          />
                          <Label htmlFor="deducible-irpf" className="text-sm">Deducible en IRPF</Label>
                        </div>
                        {modo === "factura" && (
                          <div className="text-[11px] text-muted-foreground">
                            Receptor: {profile?.nombre || "—"}{profile?.nif ? ` · ${profile.nif}` : ""}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Gasto compartido (Mejora 6) — solo si el activo tiene copropiedad. */}
              {admiteCopropiedad && (
                <div className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gasto-compartido"
                      checked={form.gasto_compartido}
                      onCheckedChange={(c) => setForm({ ...form, gasto_compartido: !!c })}
                    />
                    <Label htmlFor="gasto-compartido" className="text-sm font-medium">¿Este gasto es compartido?</Label>
                  </div>
                  {form.gasto_compartido && (
                    <div className="space-y-1.5 pl-6">
                      <Label className="text-sm">Porcentaje a tu cargo (%)</Label>
                      <div className="flex flex-wrap gap-2">
                        {[100, 50, 33, 25].map(p => (
                          <Button
                            key={p}
                            type="button"
                            size="sm"
                            variant={Number(form.porcentaje_usuario) === p ? "default" : "outline"}
                            onClick={() => setForm({ ...form, porcentaje_usuario: String(p) })}
                          >{p}%</Button>
                        ))}
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          step="0.01"
                          value={form.porcentaje_usuario}
                          onChange={(e) => setForm({ ...form, porcentaje_usuario: e.target.value })}
                          className="w-28"
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">Solo se guarda tu porcentaje. No se piden datos del resto de copropietarios.</div>
                    </div>
                  )}
                </div>
              )}

              {/* Documento adjunto */}
              {!archivo && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Adjuntar documento (opcional)
                </button>
              )}
              {archivo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText size={14} /> {archivo.name}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivo(f); }}
              />

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={saving}>
                  <ArrowLeft size={16} /> Volver
                </Button>
                <Button onClick={handleGuardar} className="flex-1" disabled={saving || !!validForSave()}>
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  {modo === "factura" ? "Guardar factura" : "Guardar gasto"}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}