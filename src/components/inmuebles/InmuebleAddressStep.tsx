import { useState, useEffect, useCallback, useRef } from "react";
import { TextField, NumberField, SelectField } from "../propietarios/FormFields";

const TIPOS_VIA = [
  { value: "Calle", label: "Calle" }, { value: "Avenida", label: "Avenida" },
  { value: "Paseo", label: "Paseo" }, { value: "Plaza", label: "Plaza" },
  { value: "Carretera", label: "Carretera" }, { value: "Ronda", label: "Ronda" },
  { value: "Travesía", label: "Travesía" }, { value: "Camino", label: "Camino" },
  { value: "Pasaje", label: "Pasaje" }, { value: "Bulevar", label: "Bulevar" },
  { value: "Glorieta", label: "Glorieta" }, { value: "Urbanización", label: "Urbanización" },
  { value: "Rambla", label: "Rambla" }, { value: "Callejón", label: "Callejón" },
  { value: "Senda", label: "Senda" }, { value: "Vía", label: "Vía" },
];

export interface AddressFields {
  tipo_via: string;
  direccion_completa: string;
  numero: string;
  numero_portal: string;
  planta: string;
  puerta: string;
  urbanizacion: string;
  municipio: string;
  provincia: string;
  comunidad_autonoma: string;
  codigo_postal: string;
}

interface Props {
  fields: AddressFields;
  onChange: <K extends keyof AddressFields>(key: K, value: string) => void;
  showPlantaPuerta?: boolean;
}

const InmuebleAddressStep = ({ fields, onChange, showPlantaPuerta = true }: Props) => {
  const [lookupStatus, setLookupStatus] = useState<"idle" | "searching" | "found" | "not_found" | "missing_data">("idle");
  const [lookupHint, setLookupHint] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const lookupAddress = useCallback(async (calle: string, numero: string, municipio: string) => {
    const fullAddress = `${calle.trim()} ${numero.trim()}`.trim();
    const missing: string[] = [];
    if (!calle.trim()) missing.push("calle");
    if (!numero.trim()) missing.push("número");
    if (!municipio.trim()) missing.push("municipio");
    if (missing.length > 0) {
      if (calle.trim() || numero.trim() || municipio.trim()) {
        setLookupStatus("missing_data");
        setLookupHint(`Para autocompletar, falta: ${missing.join(", ")}`);
      } else { setLookupStatus("idle"); setLookupHint(""); }
      return;
    }
    setLookupStatus("searching");
    setLookupHint("Buscando dirección...");
    try {
      const query = encodeURIComponent(`${fullAddress}, ${municipio.trim()}, España`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1&countrycodes=es`, { headers: { "Accept-Language": "es" } });
      const data = await res.json();
      const result = data?.[0];
      if (!result) { setLookupStatus("not_found"); setLookupHint("Dirección no encontrada."); return; }
      const postcode = result.address?.postcode;
      const state = result.address?.state;
      const provincia = result.address?.province || result.address?.county;
      if (postcode && !fields.codigo_postal) onChange("codigo_postal", postcode);
      if (provincia && !fields.provincia) onChange("provincia", provincia);
      if (state && !fields.comunidad_autonoma) onChange("comunidad_autonoma", state);
      setLookupStatus("found");
      setLookupHint("✓ Datos autocompletados");
    } catch { setLookupStatus("not_found"); setLookupHint("Error al buscar."); }
  }, [fields.codigo_postal, fields.provincia, fields.comunidad_autonoma, onChange]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lookupAddress(fields.direccion_completa, fields.numero, fields.municipio);
    }, 1200);
    return () => clearTimeout(timerRef.current);
  }, [fields.direccion_completa, fields.numero, fields.municipio, lookupAddress]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[120px_1fr_80px] gap-2">
        <SelectField label="Tipo vía" value={fields.tipo_via} onChange={(v) => onChange("tipo_via", v)} options={TIPOS_VIA} />
        <TextField label="Nombre de vía" value={fields.direccion_completa} onChange={(v) => onChange("direccion_completa", v)} placeholder="Mayor" />
        <TextField label="Nº" value={fields.numero} onChange={(v) => onChange("numero", v)} placeholder="12" />
      </div>
      {showPlantaPuerta && (
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Planta" value={fields.planta} onChange={(v) => onChange("planta", v)} placeholder="3º" />
          <TextField label="Puerta" value={fields.puerta} onChange={(v) => onChange("puerta", v)} placeholder="A" />
          <TextField label="Portal" value={fields.numero_portal} onChange={(v) => onChange("numero_portal", v)} placeholder="2" />
        </div>
      )}
      {!showPlantaPuerta && (
        <TextField label="Portal / Nº parcela" value={fields.numero_portal} onChange={(v) => onChange("numero_portal", v)} placeholder="Opcional" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Municipio" value={fields.municipio} onChange={(v) => onChange("municipio", v)} placeholder="Alcorcón" />
        <TextField label="Código postal" value={fields.codigo_postal} onChange={(v) => onChange("codigo_postal", v)} placeholder="Se autocompleta" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Provincia" value={fields.provincia} onChange={(v) => onChange("provincia", v)} placeholder="Se autocompleta" />
        <TextField label="C. Autónoma" value={fields.comunidad_autonoma} onChange={(v) => onChange("comunidad_autonoma", v)} placeholder="Se autocompleta" />
      </div>
      <TextField label="Urbanización" value={fields.urbanizacion} onChange={(v) => onChange("urbanizacion", v)} placeholder="Opcional" />
      {lookupHint && (
        <p className={`text-xs rounded-lg px-3 py-2 ${
          lookupStatus === "found" ? "bg-emerald-500/10 text-emerald-700" :
          lookupStatus === "searching" ? "bg-primary/10 text-primary animate-pulse" :
          lookupStatus === "missing_data" ? "bg-amber-500/10 text-amber-700" :
          "bg-destructive/10 text-destructive"
        }`}>{lookupHint}</p>
      )}
    </div>
  );
};

export default InmuebleAddressStep;
