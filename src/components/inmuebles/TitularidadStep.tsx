import { TextField } from "@/components/propietarios/FormFields";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Users, User, UserCheck, UserPlus, Download, KeyRound, Briefcase, Repeat, AlertCircle } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { detectarPendientes } from "@/lib/titularidad/pendientes";
import { relacionToLegacyTitularidad, type RelacionTitularidad, type TitularidadDetalle } from "@/lib/titularidad/types";

/**
 * Convierte una fila legacy de `properties` al estado nuevo de `TitularidadFields`.
 * Compat hacia atrás: lee `titularidad_detalle` (jsonb) si existe; si no,
 * deriva la `relacion` desde las columnas heredadas (`titularidad`,
 * `tiene_usufructo`, `tercero_*`).
 */
export function parseTitularidadFromRow(row: Record<string, any> | null | undefined): TitularidadFields {
  if (!row) return defaultTitularidadFields;
  const det = (row.titularidad_detalle ?? null) as Partial<TitularidadDetalle> | null;

  let relacion: RelacionTitularidad;
  if (det && det.relacion) {
    relacion = det.relacion;
  } else if (row.tiene_usufructo) {
    // Antes "tiene_usufructo" significaba que existía un usufructuario tercero,
    // no que el propio usuario lo fuera. Mapear a "propietario" por defecto.
    relacion = row.titularidad === "copropietarios" ? "copropietarios" : "propietario_unico";
  } else if (row.titularidad === "copropietarios") {
    relacion = "copropietarios";
  } else if (row.titularidad === "tercero") {
    relacion = "gestor";
  } else {
    relacion = "propietario_unico";
  }

  return {
    relacion,
    copropietarios: Array.isArray(row.copropietarios) ? row.copropietarios : [],
    nudo_propietario_nombre: det?.nudo_propietario?.nombre ?? "",
    nudo_propietario_nif: det?.nudo_propietario?.nif ?? "",
    tercero_nombre: row.tercero_nombre ?? "",
    tercero_dni: row.tercero_dni ?? "",
    tercero_telefono: row.tercero_telefono ?? "",
    tercero_email: row.tercero_email ?? "",
    comision_pct: det?.gestion?.comision_pct != null ? String(det.gestion.comision_pct) : "",
    renta_pagada_mensual: det?.subarriendo?.renta_pagada_mensual != null ? String(det.subarriendo.renta_pagada_mensual) : "",
  };
}

export interface Copropietario {
  nombre: string;
  dni: string;
  porcentaje: string;
  telefono: string;
  email: string;
}

/**
 * `TitularidadFields` describe el estado del paso de Titularidad.
 * El campo `relacion` es la nueva fuente de verdad (4 opciones).
 * Los campos legacy (`titularidad`, `tiene_usufructo`, etc.) se siguen
 * exponiendo en `buildTitularidadSaveData` para escribir las columnas
 * existentes de `properties`, sin perder compat hacia atrás.
 */
export interface TitularidadFields {
  relacion: RelacionTitularidad;
  copropietarios: Copropietario[];
  // Usufructo
  nudo_propietario_nombre: string;
  nudo_propietario_nif: string;
  // Gestor / Subarrendador → datos del tercero (propietario real / original)
  tercero_nombre: string;
  tercero_dni: string;
  tercero_telefono: string;
  tercero_email: string;
  // Gestor
  comision_pct: string;
  // Subarrendador
  renta_pagada_mensual: string;
}

export const defaultTitularidadFields: TitularidadFields = {
  relacion: "propietario_unico",
  copropietarios: [],
  nudo_propietario_nombre: "",
  nudo_propietario_nif: "",
  tercero_nombre: "",
  tercero_dni: "",
  tercero_telefono: "",
  tercero_email: "",
  comision_pct: "",
  renta_pagada_mensual: "",
};

interface Props {
  fields: TitularidadFields;
  onChange: (fields: TitularidadFields) => void;
}

const TitularidadStep = ({ fields, onChange }: Props) => {
  const { profile } = useProfile();

  const set = <K extends keyof TitularidadFields>(key: K, value: TitularidadFields[K]) =>
    onChange({ ...fields, [key]: value });

  const addCopropietario = () => {
    set("copropietarios", [...fields.copropietarios, { nombre: "", dni: "", porcentaje: "", telefono: "", email: "" }]);
  };

  const autoFillMe = () => {
    const me: Copropietario = {
      nombre: [profile.nombre, profile.apellidos].filter(Boolean).join(" "),
      dni: profile.nif || "",
      porcentaje: "",
      telefono: profile.telefono || "",
      email: profile.email || "",
    };
    set("copropietarios", [me, ...fields.copropietarios]);
  };

  const updateCopropietario = (index: number, field: keyof Copropietario, value: string) => {
    const updated = [...fields.copropietarios];
    updated[index] = { ...updated[index], [field]: value };
    set("copropietarios", updated);
  };

  const removeCopropietario = (index: number) => {
    set("copropietarios", fields.copropietarios.filter((_, i) => i !== index));
  };

  const opciones: { id: RelacionTitularidad; icon: typeof User; title: string; help: string }[] = [
    { id: "propietario_unico", icon: User, title: "Soy el propietario", help: "El inmueble es tuyo, total o parcialmente." },
    { id: "usufructuario", icon: KeyRound, title: "Tengo el usufructo", help: "Puedes usar o alquilar el inmueble, aunque no seas el propietario." },
    { id: "gestor", icon: Briefcase, title: "Lo gestiono por cuenta de otra persona", help: "Administras el inmueble para el propietario." },
    { id: "subarrendador", icon: Repeat, title: "Lo alquilo y lo subarriendo", help: "Pagas un alquiler al propietario y lo alquilas a terceros." },
  ];

  // Sub-opción de A: solo/con otros — derivado de `relacion`.
  const subA: "solo" | "varios" = fields.relacion === "copropietarios" ? "varios" : "solo";

  const selectRelacion = (r: RelacionTitularidad) => {
    if (r === "copropietarios" && fields.copropietarios.length === 0) {
      onChange({
        ...fields,
        relacion: r,
        copropietarios: [{ nombre: "", dni: "", porcentaje: "", telefono: "", email: "" }],
      });
      return;
    }
    set("relacion", r);
  };

  const sumaPct = fields.copropietarios.reduce((acc, cp) => {
    const n = Number(String(cp.porcentaje).replace(",", "."));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const sumaOk = Math.abs(sumaPct - 100) < 0.01;

  const pendientes = detectarPendientes({
    relacion: fields.relacion,
    copropietarios: fields.copropietarios,
    nudo_propietario_nombre: fields.nudo_propietario_nombre,
    nudo_propietario_nif: fields.nudo_propietario_nif,
    tercero_nombre: fields.tercero_nombre,
    tercero_dni: fields.tercero_dni,
    comision_pct: fields.comision_pct ? Number(fields.comision_pct.replace(",", ".")) : null,
    renta_pagada_mensual: fields.renta_pagada_mensual ? Number(fields.renta_pagada_mensual.replace(",", ".")) : null,
  });

  return (
    <div className="space-y-5">
      {/* Pregunta principal */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">¿Cuál es tu relación con este inmueble?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {opciones.map(op => {
            const isPropietario = op.id === "propietario_unico";
            const active = isPropietario
              ? (fields.relacion === "propietario_unico" || fields.relacion === "copropietarios")
              : fields.relacion === op.id;
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => selectRelacion(op.id)}
                className={`min-h-[64px] p-3 rounded-xl border text-left transition-all ${
                  active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={active ? "text-primary" : "text-muted-foreground"} />
                  <p className="text-sm font-medium">{op.title}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{op.help}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* A — Propietario: solo / con otros */}
      {(fields.relacion === "propietario_unico" || fields.relacion === "copropietarios") && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">¿Solo tú o con más personas?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("relacion", "propietario_unico")}
              className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-all ${
                subA === "solo" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <User size={14} className={subA === "solo" ? "text-primary" : "text-muted-foreground"} />
                <p className="text-sm font-medium">Solo yo (100%)</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => selectRelacion("copropietarios")}
              className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-all ${
                subA === "varios" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={14} className={subA === "varios" ? "text-primary" : "text-muted-foreground"} />
                <p className="text-sm font-medium">Con otras personas</p>
              </div>
            </button>
          </div>

          {fields.relacion === "copropietarios" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propietarios</p>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl h-7" onClick={autoFillMe}>
                  <Download size={12} /> Añadirme a mí
                </Button>
              </div>
              {fields.copropietarios.map((cp, i) => (
                <div key={i} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Propietario {i + 1}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCopropietario(i)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <TextField label="Nombre" value={cp.nombre} onChange={v => updateCopropietario(i, "nombre", v)} placeholder="Nombre completo" />
                    <TextField label="DNI/NIF (opcional)" value={cp.dni} onChange={v => updateCopropietario(i, "dni", v)} placeholder="12345678A" />
                  </div>
                  <TextField label="% participación" value={cp.porcentaje} onChange={v => updateCopropietario(i, "porcentaje", v)} placeholder="50" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={addCopropietario}>
                <Plus size={13} /> Añadir otro propietario
              </Button>
              {fields.copropietarios.length > 0 && (
                <p className={`text-[11px] ${sumaOk ? "text-muted-foreground" : "text-amber-600"}`}>
                  Suma actual: {sumaPct.toFixed(2).replace(".", ",")}% {sumaOk ? "✓" : "(debería ser 100%)"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* B — Usufructo */}
      {fields.relacion === "usufructuario" && (
        <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck size={13} /> Datos del nudo propietario
          </p>
          <p className="text-[11px] text-muted-foreground">Persona que tiene la propiedad “seca”. Si no la conoces, puedes dejarlo vacío.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField label="Nombre" value={fields.nudo_propietario_nombre} onChange={v => set("nudo_propietario_nombre", v)} placeholder="Nombre completo" />
            <TextField label="DNI/NIF (opcional)" value={fields.nudo_propietario_nif} onChange={v => set("nudo_propietario_nif", v)} placeholder="12345678A" />
          </div>
        </div>
      )}

      {/* C — Gestor */}
      {fields.relacion === "gestor" && (
        <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus size={13} /> Datos del propietario
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField label="Nombre o razón social" value={fields.tercero_nombre} onChange={v => set("tercero_nombre", v)} placeholder="Nombre o empresa" />
            <TextField label="DNI/NIF/CIF (opcional)" value={fields.tercero_dni} onChange={v => set("tercero_dni", v)} placeholder="12345678A / B12345678" />
          </div>
          <TextField label="Comisión de gestión (%) — opcional" value={fields.comision_pct} onChange={v => set("comision_pct", v)} placeholder="8" />
        </div>
      )}

      {/* D — Subarrendador */}
      {fields.relacion === "subarrendador" && (
        <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Repeat size={13} /> Datos del propietario original
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField label="Nombre o razón social" value={fields.tercero_nombre} onChange={v => set("tercero_nombre", v)} placeholder="Nombre o empresa" />
            <TextField label="DNI/NIF/CIF (opcional)" value={fields.tercero_dni} onChange={v => set("tercero_dni", v)} placeholder="12345678A / B12345678" />
          </div>
          <TextField label="Renta mensual que pagas al propietario (€)" value={fields.renta_pagada_mensual} onChange={v => set("renta_pagada_mensual", v)} placeholder="900" />
        </div>
      )}

      {/* Aviso — pendientes (informativo, no bloquea) */}
      {pendientes.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Puedes continuar igualmente. Algunos datos quedarán como <b>“Pendiente de completar”</b> y aparecerán en el resumen final.
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Construye el payload que se mezcla en `properties` al crear el activo.
 * - Mapea `relacion` a la columna legacy `titularidad` (text).
 * - Escribe `copropietarios`, `usufructuario_*`, `tercero_*` para mantener
 *   compat con código existente que lee estos campos.
 * - Persiste `titularidad_detalle` (jsonb) como fuente nueva de verdad
 *   para casuísticas no cubiertas (nudo propietario, comisión, subarriendo)
 *   y para el array `pendientes[]`.
 */
export const buildTitularidadSaveData = (fields: TitularidadFields): Record<string, unknown> => {
  const r = fields.relacion;

  const pendientes = detectarPendientes({
    relacion: r,
    copropietarios: fields.copropietarios,
    nudo_propietario_nombre: fields.nudo_propietario_nombre,
    nudo_propietario_nif: fields.nudo_propietario_nif,
    tercero_nombre: fields.tercero_nombre,
    tercero_dni: fields.tercero_dni,
    comision_pct: fields.comision_pct ? Number(fields.comision_pct.replace(",", ".")) : null,
    renta_pagada_mensual: fields.renta_pagada_mensual ? Number(fields.renta_pagada_mensual.replace(",", ".")) : null,
  });

  const detalle: TitularidadDetalle = {
    version: 1,
    relacion: r,
    pendientes,
  };

  if (r === "usufructuario") {
    detalle.nudo_propietario = {
      nombre: fields.nudo_propietario_nombre || undefined,
      nif: fields.nudo_propietario_nif || undefined,
    };
  }
  if (r === "gestor") {
    const n = Number(String(fields.comision_pct).replace(",", "."));
    detalle.gestion = { comision_pct: Number.isFinite(n) && fields.comision_pct !== "" ? n : null };
  }
  if (r === "subarrendador") {
    const n = Number(String(fields.renta_pagada_mensual).replace(",", "."));
    detalle.subarriendo = { renta_pagada_mensual: Number.isFinite(n) && fields.renta_pagada_mensual !== "" ? n : null };
  }

  // Para usufructo seguimos marcando la columna legacy `tiene_usufructo`
  // y `usufructuario_nombre/dni` con los datos del PROPIO usuario en blanco
  // (no los pedimos: el usuario es el usufructuario). El nudo propietario
  // va al jsonb.
  const tieneUsufructo = r === "usufructuario";

  return {
    titularidad: relacionToLegacyTitularidad(r),
    copropietarios: r === "copropietarios" ? fields.copropietarios : [],
    tiene_usufructo: tieneUsufructo,
    usufructuario_nombre: null,
    usufructuario_dni: null,
    usufructuario_telefono: null,
    usufructuario_email: null,
    tercero_nombre: r === "gestor" || r === "subarrendador" ? fields.tercero_nombre || null : null,
    tercero_dni: r === "gestor" || r === "subarrendador" ? fields.tercero_dni || null : null,
    tercero_telefono: r === "gestor" || r === "subarrendador" ? fields.tercero_telefono || null : null,
    tercero_email: r === "gestor" || r === "subarrendador" ? fields.tercero_email || null : null,
    titularidad_detalle: detalle,
  };
};

export default TitularidadStep;
