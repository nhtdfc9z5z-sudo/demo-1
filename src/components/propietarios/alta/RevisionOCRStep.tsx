/**
 * RevisionOCRStep — Pantalla única de revisión tras OCR multi-archivo.
 *
 * Aparece entre `CapturaOCRStep` y el resto del wizard cuando
 * `intencion === "pdf"` y hay datos detectados. Permite ver, editar y
 * confirmar los datos extraídos antes de continuar.
 *
 * Reglas:
 *  - Nunca bloquea la continuación.
 *  - El progreso es gamificación, no validación.
 *  - Badge verde "OCR" en campos detectados; naranja "Falta" en vacíos.
 *  - Botón principal salta directo al resumen; secundario abre el
 *    wizard normal (paso "activo") con los datos ya aplicados.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  FileText,
  Home,
  Sparkles,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ContratoAnalysisFusionado } from "@/lib/ocr/types";
import type { DireccionEstructurada } from "@/lib/direccion/formatDireccion";

export interface RevisionInquilinoDraft {
  uid: string;
  nombre: string;
  apellidos: string;
  nif: string;
  email: string;
  telefono: string;
}

export interface RevisionOCRValue {
  // Inmueble
  direccion: DireccionEstructurada;
  superficie: string;
  habitaciones: string;
  ano_construccion: string;
  referencia_catastral: string;
  // Inquilinos
  inquilinos: RevisionInquilinoDraft[];
  // Contrato / condiciones
  fechaInicio: string;
  fechaFin: string;
  rentaInicial: string;
  fianzaInicial: string;
  clausulaIPC: string;
  suministros: {
    agua: boolean;
    luz: boolean;
    gas: boolean;
    internet: boolean;
    ibi: boolean;
    basuras: boolean;
    comunidad: boolean;
  };
}

interface Props {
  analysis: ContratoAnalysisFusionado;
  value: RevisionOCRValue;
  onChange: (patch: Partial<RevisionOCRValue>) => void;
  onConfirm: () => void;
  onEditStepByStep: () => void;
}

// ───────────────────────── helpers ─────────────────────────

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (typeof v === "number") return !Number.isFinite(v) || v === 0;
  return false;
};

type Origen = "ocr" | "manual" | "falta";

function origenCampo(detectado: unknown, actual: unknown): Origen {
  const ocr = !isEmpty(detectado);
  const filled = !isEmpty(actual);
  if (!filled) return "falta";
  if (ocr) return "ocr";
  return "manual";
}

/**
 * Origen específico de `referencia_catastral`. La referencia catastral es
 * opcional en el flujo de alta: si OCR la detecta se marca como OCR, si la
 * edita el usuario como Manual. Cuando está vacía no se marca FALTA.
 */
function origenReferenciaCatastral(
  detectado: unknown,
  actual: unknown,
): Origen {
  return origenCampo(detectado, actual);
}

function CampoBadge({ origen }: { origen: Origen }) {
  if (origen === "ocr") {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
      >
        <Sparkles className="h-2.5 w-2.5" /> OCR
      </Badge>
    );
  }
  if (origen === "manual") {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 border-teal-500/40 bg-teal-500/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300"
      >
        <CheckCircle2 className="h-2.5 w-2.5" /> Ok
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="h-5 gap-1 border-orange-500/40 bg-orange-500/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-orange-700 dark:text-orange-300"
    >
      <AlertCircle className="h-2.5 w-2.5" /> Falta
    </Badge>
  );
}

interface FieldProps {
  id: string;
  label: string;
  origen: Origen;
  /** Si true, no se muestra el badge "Falta" cuando está vacío. */
  opcional?: boolean;
  children: React.ReactNode;
}
function Field({ id, label, origen, opcional, children }: FieldProps) {
  const showBadge = !(opcional && origen === "falta");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {showBadge && <CampoBadge origen={origen} />}
      </div>
      {children}
    </div>
  );
}

// ───────────────────────── secciones ─────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  done,
  total,
}: {
  icon: typeof Home;
  title: string;
  done: number;
  total: number;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 px-1 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {done}/{total}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
      </div>
    </div>
  );
}

// ───────────────────────── componente ─────────────────────────

export default function RevisionOCRStep({
  analysis,
  value,
  onChange,
  onConfirm,
  onEditStepByStep,
}: Props) {
  // Campos relevantes y su origen.
  const campos = useMemo(() => {
    const inm = [
      origenCampo(analysis.direccion_calle, value.direccion.nombre_via),
      origenCampo(analysis.direccion_numero, value.direccion.numero),
      origenCampo(analysis.direccion_ciudad, value.direccion.municipio),
      origenCampo(analysis.direccion_codigo_postal, value.direccion.codigo_postal),
      origenCampo((analysis as { superficie_util_m2?: number }).superficie_util_m2, value.superficie),
      origenCampo(undefined, value.habitaciones),
      origenReferenciaCatastral(
        analysis.referencia_catastral,
        value.referencia_catastral,
      ),
    ];
    const inq = value.inquilinos.length === 0
      ? [{ origen: "falta" as Origen }]
      : value.inquilinos.flatMap((i) => {
          const detected = analysis.arrendatarios?.find(
            (a) =>
              (a.nif && a.nif === i.nif) ||
              (a.nombre && a.nombre === i.nombre),
          );
          return [
            origenCampo(detected?.nombre, i.nombre),
            origenCampo(detected?.nif, i.nif),
            origenCampo(detected?.email, i.email),
            origenCampo(detected?.telefono, i.telefono),
          ];
        });
    const con = [
      origenCampo(analysis.fecha_inicio, value.fechaInicio),
      origenCampo(analysis.fecha_fin, value.fechaFin),
      origenCampo(analysis.renta_mensual, value.rentaInicial),
      origenCampo(analysis.fianza_importe, value.fianzaInicial),
      origenCampo(analysis.clausula_actualizacion_renta, value.clausulaIPC),
    ];
    const count = (arr: Origen[]) => ({
      done: arr.filter((o) => o !== "falta").length,
      total: arr.length,
    });
    return { inm: count(inm), inq: count(inq as Origen[]), con: count(con) };
  }, [analysis, value]);

  const totalDone = campos.inm.done + campos.inq.done + campos.con.done;
  const totalAll = campos.inm.total + campos.inq.total + campos.con.total;
  const pct = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100);

  const msg = useMemo(() => {
    if (pct >= 90) return "Listo para continuar";
    if (pct >= 70) return "Casi. Revisa las condiciones económicas";
    if (pct >= 40) return "Bien. Confirma los datos del inquilino";
    return "Revisa los datos detectados";
  }, [pct]);

  // Microanimación al cruzar umbrales (0/40/70/90).
  const lastTierRef = useRef<number>(-1);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const tier = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
    if (lastTierRef.current !== -1 && tier > lastTierRef.current) {
      setPulse((p) => p + 1);
    }
    lastTierRef.current = tier;
  }, [pct]);

  // Helpers para actualizar valores anidados.
  const setDir = (patch: Partial<DireccionEstructurada>) =>
    onChange({ direccion: { ...value.direccion, ...patch } });
  const setInq = (uid: string, patch: Partial<RevisionInquilinoDraft>) =>
    onChange({
      inquilinos: value.inquilinos.map((i) =>
        i.uid === uid ? { ...i, ...patch } : i,
      ),
    });

  return (
    <div className="space-y-5">
      {/* Barra de progreso gamificada */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={msg}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium"
            >
              {msg}
            </motion.div>
          </AnimatePresence>
          <motion.span
            key={pulse}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.4 }}
            className="font-mono text-sm font-semibold tabular-nums"
          >
            {pct}%
          </motion.span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {totalDone} de {totalAll} datos completados. Puedes continuar en
          cualquier momento — esto solo te orienta.
        </p>
      </div>

      {/* INMUEBLE */}
      <Collapsible defaultOpen className="group rounded-lg border bg-card">
        <CollapsibleTrigger className="w-full">
          <SectionHeader
            icon={Home}
            title="Inmueble"
            done={campos.inm.done}
            total={campos.inm.total}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="rev-calle"
              label="Calle / vía"
              origen={origenCampo(analysis.direccion_calle, value.direccion.nombre_via)}
            >
              <Input
                id="rev-calle"
                value={value.direccion.nombre_via}
                onChange={(e) => setDir({ nombre_via: e.target.value })}
              />
            </Field>
            <Field
              id="rev-num"
              label="Número"
              origen={origenCampo(analysis.direccion_numero, value.direccion.numero)}
            >
              <Input
                id="rev-num"
                value={value.direccion.numero}
                onChange={(e) => setDir({ numero: e.target.value })}
              />
            </Field>
            <Field
              id="rev-planta"
              label="Planta"
              origen={origenCampo(analysis.direccion_planta, value.direccion.planta)}
            >
              <Input
                id="rev-planta"
                value={value.direccion.planta ?? ""}
                onChange={(e) => setDir({ planta: e.target.value })}
                placeholder="Ej: 3, Bajo, Ático"
              />
            </Field>
            <Field
              id="rev-puerta"
              label="Puerta"
              origen={origenCampo(analysis.direccion_puerta, value.direccion.puerta)}
            >
              <Input
                id="rev-puerta"
                value={value.direccion.puerta ?? ""}
                onChange={(e) => setDir({ puerta: e.target.value })}
                placeholder="Ej: A, Izquierda"
              />
            </Field>
            <Field
              id="rev-esc"
              label="Escalera"
              opcional
              origen={origenCampo(
                (analysis as { direccion_escalera?: string }).direccion_escalera,
                value.direccion.escalera,
              )}
            >
              <Input
                id="rev-esc"
                value={value.direccion.escalera ?? ""}
                onChange={(e) => setDir({ escalera: e.target.value })}
                placeholder="Ej: 1, A"
              />
            </Field>
            <Field
              id="rev-portal"
              label="Portal"
              opcional
              origen={origenCampo(
                (analysis as { direccion_portal?: string }).direccion_portal,
                value.direccion.portal,
              )}
            >
              <Input
                id="rev-portal"
                value={value.direccion.portal ?? ""}
                onChange={(e) => setDir({ portal: e.target.value })}
                placeholder="Ej: 2"
              />
            </Field>
            <Field
              id="rev-bloque"
              label="Bloque"
              opcional
              origen={origenCampo(
                (analysis as { direccion_bloque?: string }).direccion_bloque,
                value.direccion.bloque,
              )}
            >
              <Input
                id="rev-bloque"
                value={value.direccion.bloque ?? ""}
                onChange={(e) => setDir({ bloque: e.target.value })}
                placeholder="Ej: A"
              />
            </Field>
            <Field
              id="rev-urb"
              label="Urbanización"
              opcional
              origen={origenCampo(
                (analysis as { direccion_urbanizacion?: string }).direccion_urbanizacion,
                value.direccion.urbanizacion,
              )}
            >
              <Input
                id="rev-urb"
                value={value.direccion.urbanizacion ?? ""}
                onChange={(e) => setDir({ urbanizacion: e.target.value })}
                placeholder="Nombre de la urbanización"
              />
            </Field>
            <Field
              id="rev-mun"
              label="Municipio"
              origen={origenCampo(analysis.direccion_ciudad, value.direccion.municipio)}
            >
              <Input
                id="rev-mun"
                value={value.direccion.municipio}
                onChange={(e) => setDir({ municipio: e.target.value })}
              />
            </Field>
            <Field
              id="rev-cp"
              label="Código postal"
              origen={origenCampo(
                analysis.direccion_codigo_postal,
                value.direccion.codigo_postal,
              )}
            >
              <Input
                id="rev-cp"
                value={value.direccion.codigo_postal}
                onChange={(e) => setDir({ codigo_postal: e.target.value })}
              />
            </Field>
            <Field
              id="rev-sup"
              label="Superficie (m²)"
              origen={origenCampo(
                (analysis as { superficie_util_m2?: number }).superficie_util_m2,
                value.superficie,
              )}
            >
              <Input
                id="rev-sup"
                inputMode="numeric"
                value={value.superficie}
                onChange={(e) => onChange({ superficie: e.target.value })}
              />
            </Field>
            <Field
              id="rev-hab"
              label="Habitaciones"
              origen={origenCampo(undefined, value.habitaciones)}
            >
              <Input
                id="rev-hab"
                inputMode="numeric"
                value={value.habitaciones}
                onChange={(e) => onChange({ habitaciones: e.target.value })}
              />
            </Field>
            <Field
              id="rev-ano"
              label="Año de construcción del inmueble"
              opcional
              origen={origenCampo(
                (analysis as { ano_construccion?: number }).ano_construccion,
                value.ano_construccion,
              )}
            >
              <Input
                id="rev-ano"
                inputMode="numeric"
                value={value.ano_construccion}
                onChange={(e) => onChange({ ano_construccion: e.target.value })}
                placeholder="Ej: 1985"
              />
            </Field>
            <Field
              id="rev-cat"
              label="Referencia catastral"
              opcional
              origen={origenReferenciaCatastral(
                analysis.referencia_catastral,
                value.referencia_catastral,
              )}
            >
              <Input
                id="rev-cat"
                value={value.referencia_catastral}
                onChange={(e) =>
                  onChange({ referencia_catastral: e.target.value })
                }
                placeholder="Ej: 6547606VK2664N0011MI"
              />
            </Field>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* INQUILINOS */}
      <Collapsible defaultOpen className="group rounded-lg border bg-card">
        <CollapsibleTrigger className="w-full">
          <SectionHeader
            icon={UserIcon}
            title="Inquilino/s"
            done={campos.inq.done}
            total={campos.inq.total}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t p-4">
          {value.inquilinos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hemos detectado arrendatarios. Podrás añadirlos en el siguiente
              paso.
            </p>
          )}
          {value.inquilinos.map((i, idx) => {
            const detected = analysis.arrendatarios?.find(
              (a) =>
                (a.nif && a.nif === i.nif) ||
                (a.nombre && a.nombre === i.nombre),
            );
            return (
              <div
                key={i.uid}
                className="space-y-3 rounded-md border bg-background/50 p-3"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Inquilino {idx + 1}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id={`rev-inq-nom-${i.uid}`}
                    label="Nombre"
                    origen={origenCampo(detected?.nombre, i.nombre)}
                  >
                    <Input
                      id={`rev-inq-nom-${i.uid}`}
                      value={i.nombre}
                      onChange={(e) => setInq(i.uid, { nombre: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`rev-inq-nif-${i.uid}`}
                    label="NIF / NIE"
                    origen={origenCampo(detected?.nif, i.nif)}
                  >
                    <Input
                      id={`rev-inq-nif-${i.uid}`}
                      value={i.nif}
                      onChange={(e) => setInq(i.uid, { nif: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`rev-inq-mail-${i.uid}`}
                    label="Email"
                    origen={origenCampo(detected?.email, i.email)}
                  >
                    <Input
                      id={`rev-inq-mail-${i.uid}`}
                      type="email"
                      value={i.email}
                      onChange={(e) => setInq(i.uid, { email: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`rev-inq-tel-${i.uid}`}
                    label="Teléfono"
                    origen={origenCampo(detected?.telefono, i.telefono)}
                  >
                    <Input
                      id={`rev-inq-tel-${i.uid}`}
                      value={i.telefono}
                      onChange={(e) =>
                        setInq(i.uid, { telefono: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>

      {/* CONTRATO */}
      <Collapsible defaultOpen className="group rounded-lg border bg-card">
        <CollapsibleTrigger className="w-full">
          <SectionHeader
            icon={FileText}
            title="Contrato"
            done={campos.con.done}
            total={campos.con.total}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="rev-fi"
              label="Fecha de inicio"
              origen={origenCampo(analysis.fecha_inicio, value.fechaInicio)}
            >
              <Input
                id="rev-fi"
                type="date"
                value={value.fechaInicio}
                onChange={(e) => onChange({ fechaInicio: e.target.value })}
              />
            </Field>
            <Field
              id="rev-ff"
              label="Fecha de fin"
              origen={origenCampo(analysis.fecha_fin, value.fechaFin)}
            >
              <Input
                id="rev-ff"
                type="date"
                value={value.fechaFin}
                onChange={(e) => onChange({ fechaFin: e.target.value })}
              />
            </Field>
            <Field
              id="rev-rent"
              label="Renta mensual (€)"
              origen={origenCampo(analysis.renta_mensual, value.rentaInicial)}
            >
              <Input
                id="rev-rent"
                inputMode="decimal"
                value={value.rentaInicial}
                onChange={(e) => onChange({ rentaInicial: e.target.value })}
              />
            </Field>
            <Field
              id="rev-fianza"
              label="Fianza (€)"
              origen={origenCampo(analysis.fianza_importe, value.fianzaInicial)}
            >
              <Input
                id="rev-fianza"
                inputMode="decimal"
                value={value.fianzaInicial}
                onChange={(e) => onChange({ fianzaInicial: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="rev-ipc"
                label="Cláusula de actualización (IPC)"
                origen={origenCampo(
                  analysis.clausula_actualizacion_renta,
                  value.clausulaIPC,
                )}
              >
                <Input
                  id="rev-ipc"
                  value={value.clausulaIPC}
                  onChange={(e) => onChange({ clausulaIPC: e.target.value })}
                  placeholder="Ej: IPC anual a fecha de revisión"
                />
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Suministros</div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["agua", "Agua"],
                  ["luz", "Luz"],
                  ["gas", "Gas"],
                  ["internet", "Internet"],
                  ["ibi", "IBI"],
                  ["basuras", "Basuras"],
                  ["comunidad", "Comunidad"],
                ] as const
              ).map(([k, label]) => {
                const on = value.suministros[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      onChange({
                        suministros: { ...value.suministros, [k]: !on },
                      })
                    }
                    className={cn(
                      "min-h-[44px] rounded-full border px-3 text-sm transition-colors",
                      on
                        ? "border-teal-500/50 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                        : "border-border bg-background text-muted-foreground hover:bg-accent",
                    )}
                    aria-pressed={on}
                  >
                    {label}{" "}
                    <span className="ml-1 text-xs opacity-70">
                      {on ? "paga inquilino" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* CTAs */}
      <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 pt-3 backdrop-blur sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onEditStepByStep}
          className="min-h-[44px]"
        >
          Editar paso a paso
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirmar y continuar
        </Button>
      </div>
    </div>
  );
}