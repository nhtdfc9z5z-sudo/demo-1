/**
 * ResumenAltaFinal — Componente único de resumen + creación.
 *
 * Compartido por las 4 intenciones del alta (activo, alquiler, pdf, otro-activo).
 * Es presentacional + maneja 3 estados internos: preview / creando / éxito.
 *
 * Reglas (Fase 4):
 *   - NO crea nada hasta que el usuario pulse "Crear".
 *   - El botón "Crear" sólo invoca `onCrear()`, que internamente DEBE llamar
 *     a una función de `src/lib/altas/` (crearAltaCompleta / crearActivo).
 *   - Si la creación falla, mantiene los datos y muestra error reintentar.
 *   - Bloquea doble envío con `isCreating` + botón deshabilitado.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Home,
  User as UserIcon,
  FileText,
  ArrowRight,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MilestoneProgress, type Milestone } from "./MilestoneProgress";
import type { AltaIntencion } from "./AltaIntencionPicker";
import FichaCompletitudBar from "../ficha/FichaCompletitudBar";
import type { Property } from "@/hooks/useProperties";

export interface EntidadResumen {
  tipo: "activo" | "inquilino" | "contrato";
  estado: "nuevo" | "existente";
  titulo: string;
  subtitulo?: string;
}

export interface CampoPendiente {
  label: string;
  hint?: string;
}

export interface CreadoResultado {
  property_id?: string;
  inquilino_ids?: string[];
  contrato_id?: string;
}

interface Props {
  intencion: AltaIntencion;
  entidades: EntidadResumen[];
  milestones: Milestone[];
  camposPendientes: CampoPendiente[];
  /** Sección libre con los datos económicos / fechas / etc. */
  detalle?: React.ReactNode;
  onCrear: () => Promise<CreadoResultado | void>;
  onIrAFicha?: (r: CreadoResultado) => void;
  onAltaOtro?: () => void;
  onCompletarDesdeFicha?: (r: CreadoResultado) => void;
  /** Property creada / vinculada para mostrar barra de completitud en el éxito. */
  propertyParaCompletitud?: Property | null;
}

const ENTIDAD_META: Record<
  EntidadResumen["tipo"],
  { icon: typeof Home; label: string }
> = {
  activo: { icon: Home, label: "Activo" },
  inquilino: { icon: UserIcon, label: "Inquilino" },
  contrato: { icon: FileText, label: "Contrato" },
};

function CtaTitulo({ intencion }: { intencion: AltaIntencion }) {
  const map: Record<AltaIntencion, string> = {
    activo: "Vas a dar de alta este activo",
    alquiler: "Vas a crear este alquiler",
    pdf: "Vas a crear este alquiler desde el contrato",
    "otro-activo": "Vas a dar de alta este activo",
    vinculacion: "Vas a vincular sobre un inmueble existente",
  };
  return (
    <h2 className="text-lg font-semibold text-foreground">{map[intencion]}</h2>
  );
}

export default function ResumenAltaFinal({
  intencion,
  entidades,
  milestones,
  camposPendientes,
  detalle,
  onCrear,
  onIrAFicha,
  onAltaOtro,
  onCompletarDesdeFicha,
  propertyParaCompletitud,
}: Props) {
  const [estado, setEstado] = useState<"preview" | "creando" | "exito">("preview");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CreadoResultado | null>(null);

  const totalHitos = milestones.length;
  const hitosDone = milestones.filter((m) => m.done).length;
  const hitosFaltan = totalHitos - hitosDone;
  const microcopy =
    hitosFaltan === 0
      ? "Todo listo. Tu expediente está completo."
      : hitosFaltan === 1
        ? "Falta 1 dato para tener tu expediente completo"
        : `Faltan ${hitosFaltan} datos para tener tu expediente completo`;

  const handleCrear = async () => {
    if (estado === "creando") return;
    setError(null);
    setEstado("creando");
    try {
      const ret = (await onCrear()) as CreadoResultado | void;
      const r: CreadoResultado = ret || {};
      setResultado(r);
      setEstado("exito");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("preview");
    }
  };

  // ───────────────────────── ÉXITO ─────────────────────────
  if (estado === "exito" && resultado) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <CheckCircle2 className="h-7 w-7" />
          </motion.div>
          <div>
            <h3 className="text-base font-semibold">¡Listo! Todo creado correctamente.</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu expediente ya está disponible en tu cartera.
            </p>
          </div>
        </div>

        <section className="rounded-md border p-4">
          <h4 className="mb-3 text-sm font-semibold">Se ha creado</h4>
          <ul className="space-y-2">
            {entidades.map((e, i) => {
              const Icon = ENTIDAD_META[e.tipo].icon;
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">{e.titulo}</div>
                    {e.subtitulo && (
                      <div className="text-xs text-muted-foreground">{e.subtitulo}</div>
                    )}
                  </div>
                  <Badge variant={e.estado === "nuevo" ? "default" : "secondary"}>
                    {e.estado === "nuevo" ? "Creado" : "Vinculado"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>

        {propertyParaCompletitud && (
          <FichaCompletitudBar
            property={propertyParaCompletitud}
            variant="compact"
            onClick={
              onCompletarDesdeFicha
                ? () => onCompletarDesdeFicha(resultado)
                : undefined
            }
          />
        )}

        {camposPendientes.length > 0 && (
          <section className="rounded-md border border-dashed bg-muted/20 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Te falta algún dato</h4>
            </div>
            <ul className="ml-1 space-y-1 text-sm text-muted-foreground">
              {camposPendientes.map((c, i) => (
                <li key={i}>· {c.label}</li>
              ))}
            </ul>
            {onCompletarDesdeFicha && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onCompletarDesdeFicha(resultado)}
              >
                Completar desde la ficha
              </Button>
            )}
          </section>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onAltaOtro && (
            <Button variant="outline" onClick={onAltaOtro}>
              <PlusCircle className="mr-2 h-4 w-4" /> Dar de alta otro inmueble
            </Button>
          )}
          {onIrAFicha && (
            <Button onClick={() => onIrAFicha(resultado)}>
              Ir a la ficha <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // ─────────────────── PREVIEW (o CREANDO) ───────────────────
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <CtaTitulo intencion={intencion} />
        <p className="text-sm text-muted-foreground">
          Revísalo antes de confirmar. No se crea nada hasta que pulses{" "}
          <strong>Crear</strong>.
        </p>
      </div>

      <section className="rounded-md border p-4">
        <h3 className="mb-3 text-sm font-semibold">Se va a crear</h3>
        {entidades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay entidades para mostrar todavía.
          </p>
        ) : (
          <ul className="space-y-2">
            {entidades.map((e, i) => {
              const Icon = ENTIDAD_META[e.tipo].icon;
              const isNuevo = e.estado === "nuevo";
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{e.titulo}</div>
                    {e.subtitulo && (
                      <div className="truncate text-xs text-muted-foreground">
                        {e.subtitulo}
                      </div>
                    )}
                  </div>
                  <Badge variant={isNuevo ? "default" : "secondary"}>
                    {ENTIDAD_META[e.tipo].label} {isNuevo ? "nuevo" : "existente"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detalle && (
        <section className="rounded-md border p-4">
          <h3 className="mb-3 text-sm font-semibold">Detalles</h3>
          {detalle}
        </section>
      )}

      {milestones.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tu expediente</h3>
            <span className="text-xs text-muted-foreground">
              {hitosDone}/{totalHitos} completos
            </span>
          </div>
          <MilestoneProgress milestones={milestones} />
          <p className="text-xs text-muted-foreground">{microcopy}</p>
        </section>
      )}

      {camposPendientes.length > 0 && (
        <section className="rounded-md border border-dashed bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Podrás completar después</h4>
          </div>
          <ul className="ml-1 space-y-1 text-sm text-muted-foreground">
            {camposPendientes.map((c, i) => (
              <li key={i}>
                · {c.label}
                {c.hint && (
                  <span className="ml-1 text-xs opacity-70">— {c.hint}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            No bloquean el alta. Se completan desde la ficha cuando quieras.
          </p>
        </section>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                No se pudo crear
              </div>
              <div className="text-xs text-destructive/80">{error}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tus datos se han mantenido. Corrige y vuelve a intentarlo.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Separator />

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          size="lg"
          onClick={handleCrear}
          disabled={estado === "creando"}
          className="min-h-[44px]"
        >
          {estado === "creando" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando tu expediente…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" /> Crear
            </>
          )}
        </Button>
      </div>
    </div>
  );
}