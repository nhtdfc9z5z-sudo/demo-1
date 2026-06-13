import { useCallback } from "react";
import { TextField, SelectField } from "../propietarios/FormFields";
import type { DireccionEstructurada } from "@/lib/direccion/formatDireccion";
import {
  parseDireccionLibre,
  formatearPlantaCorto,
} from "@/lib/catastro/normalizacion";
import PhotonAddressSearch, { type PhotonSelection } from "./PhotonAddressSearch";

const TIPOS_VIA = [
  "Calle","Avenida","Paseo","Plaza","Carretera","Ronda","Travesía","Camino",
  "Pasaje","Bulevar","Glorieta","Urbanización","Rambla","Callejón","Senda","Vía",
].map((v) => ({ value: v, label: v }));

export type DireccionVariant = "vivienda" | "no-vivienda" | "rustica";

interface Props {
  value: DireccionEstructurada;
  onChange: (next: DireccionEstructurada) => void;
  /** vivienda: muestra planta/puerta. no-vivienda: portal/parcela. rustica: parcela y "s/n" implícito. */
  variant?: DireccionVariant;
  /** Etiqueta visible del bloque. */
  title?: string;
}

/**
 * Formulario único de dirección estructurada. Reemplaza progresivamente a
 * `InmuebleAddressStep` y a los formularios duplicados de wizards/alquiler.
 *
 * Emite siempre el modelo `DireccionEstructurada` definido en
 * `src/lib/direccion/formatDireccion.ts`. La cadena `direccion_completa`
 * se compone con `formatDireccion()` fuera de aquí — este form NO la edita.
 */
const DireccionEstructuradaForm = ({
  value,
  onChange,
  variant = "vivienda",
}: Props) => {
  const set = <K extends keyof DireccionEstructurada>(key: K, v: DireccionEstructurada[K]) =>
    onChange({ ...value, [key]: v });

  /**
   * Si el usuario pega "Calle Gran Vía 24" en Nombre de vía, lo separamos al
   * salir del campo: tipo_via, nombre_via limpio y número en su casilla.
   * Solo actúa cuando aporta información nueva sin pisar campos ya rellenos.
   */
  const normalizarNombreVia = useCallback(() => {
    const raw = (value.nombre_via ?? "").trim();
    if (!raw) return;
    const parsed = parseDireccionLibre(raw);
    const tieneTipoNuevo =
      parsed.tipo_via_label && !(value.tipo_via ?? "").trim();
    const tieneNumeroNuevo = parsed.numero && !(value.numero ?? "").trim();
    const nombreCambia = parsed.nombre_via && parsed.nombre_via !== raw;
    if (!tieneTipoNuevo && !tieneNumeroNuevo && !nombreCambia) return;
    onChange({
      ...value,
      tipo_via: tieneTipoNuevo ? parsed.tipo_via_label! : value.tipo_via,
      nombre_via: parsed.nombre_via || raw,
      numero: tieneNumeroNuevo ? parsed.numero! : value.numero,
    });
  }, [value, onChange]);

  /**
   * Aplicar selección Photon: solo sobrescribe campos vacíos salvo
   * tipo_via/nombre_via/numero, que sí se actualizan (el usuario eligió
   * explícitamente una dirección concreta). CP/provincia/CA solo si están
   * vacíos para no pisar correcciones manuales previas.
   */
  const handlePhotonSelect = useCallback(
    (sel: PhotonSelection) => {
      const next: DireccionEstructurada = { ...value };
      if (sel.tipo_via) next.tipo_via = sel.tipo_via;
      if (sel.nombre_via) next.nombre_via = sel.nombre_via;
      if (sel.numero) next.numero = sel.numero;
      if (sel.municipio) next.municipio = sel.municipio;
      if (sel.codigo_postal) next.codigo_postal = sel.codigo_postal;
      if (sel.provincia) next.provincia = sel.provincia;
      if (sel.comunidad_autonoma) next.comunidad_autonoma = sel.comunidad_autonoma;
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <div className="space-y-4">
      <PhotonAddressSearch
        onSelect={handlePhotonSelect}
        interiorPending={
          !(value.planta ?? "").trim() ||
          !(value.puerta ?? "").trim() ||
          !(value.portal ?? "").trim()
        }
      />

      <div className="grid grid-cols-[120px_1fr_80px] gap-2">
        <SelectField label="Tipo vía" value={value.tipo_via ?? ""} onChange={(v) => set("tipo_via", v)} options={TIPOS_VIA} />
        <TextField
          label="Nombre de vía"
          value={value.nombre_via ?? ""}
          onChange={(v) => set("nombre_via", v)}
          onBlur={normalizarNombreVia}
          placeholder="Ej: Gran Vía"
        />
        <TextField label="Nº portal" value={value.numero ?? ""} onChange={(v) => set("numero", v)} placeholder={variant === "rustica" ? "s/n" : "Ej: 24"} />
      </div>

      {variant === "vivienda" && (
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Planta"
            value={value.planta ?? ""}
            onChange={(v) => set("planta", v)}
            onBlur={() => {
              const formatted = formatearPlantaCorto(value.planta);
              if (formatted !== (value.planta ?? "")) set("planta", formatted);
            }}
            placeholder="Ej: 2"
          />
          <TextField label="Puerta" value={value.puerta ?? ""} onChange={(v) => set("puerta", v)} placeholder="Ej: A" />
          <TextField label="Portal" value={value.portal ?? ""} onChange={(v) => set("portal", v)} placeholder="si se precisa" />
        </div>
      )}

      {variant !== "vivienda" && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Portal" value={value.portal ?? ""} onChange={(v) => set("portal", v)} placeholder="si se precisa" />
          <TextField label="Parcela" value={value.parcela ?? ""} onChange={(v) => set("parcela", v)} placeholder="si se precisa" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Municipio / Ciudad"
          value={value.municipio ?? ""}
          onChange={(v) => set("municipio", v)}
          placeholder="Ej: Madrid, Albacete, Alcorcón..."
        />
        <TextField label="Código postal" value={value.codigo_postal ?? ""} onChange={(v) => set("codigo_postal", v)} placeholder="Ej: 28013" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Provincia" value={value.provincia ?? ""} onChange={(v) => set("provincia", v)} placeholder="Ej: Madrid" />
        <TextField
          label="Comunidad Autónoma"
          value={value.comunidad_autonoma ?? ""}
          onChange={(v) => set("comunidad_autonoma", v)}
          placeholder="Ej: Comunidad de Madrid"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Urbanización" value={value.urbanizacion ?? ""} onChange={(v) => set("urbanizacion", v)} placeholder="si se precisa" />
        <div />
      </div>

      {/* ── Búsqueda en Catastro: acción explícita del usuario ─────── */}
    </div>
  );
};

export default DireccionEstructuradaForm;