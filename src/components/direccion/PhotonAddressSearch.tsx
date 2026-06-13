import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseDireccionLibre, provinciaDesdeCP } from "@/lib/catastro/normalizacion";
import { comunidadDesdeProvincia } from "@/lib/direccion/comunidadPorProvincia";

const CAPITAL_A_PROVINCIA: Record<string, string> = {
  albacete: "Albacete",
  alicante: "Alicante",
  almeria: "Almería",
  avila: "Ávila",
  badajoz: "Badajoz",
  barcelona: "Barcelona",
  bilbao: "Vizcaya",
  burgos: "Burgos",
  caceres: "Cáceres",
  cadiz: "Cádiz",
  castellon: "Castellón",
  ceuta: "Ceuta",
  "ciudad real": "Ciudad Real",
  cordoba: "Córdoba",
  coruna: "A Coruña",
  cuenca: "Cuenca",
  girona: "Girona",
  granada: "Granada",
  guadalajara: "Guadalajara",
  huelva: "Huelva",
  huesca: "Huesca",
  jaen: "Jaén",
  leon: "León",
  lleida: "Lleida",
  logrono: "La Rioja",
  lugo: "Lugo",
  madrid: "Madrid",
  malaga: "Málaga",
  melilla: "Melilla",
  murcia: "Murcia",
  ourense: "Ourense",
  oviedo: "Asturias",
  palencia: "Palencia",
  palma: "Illes Balears",
  pamplona: "Navarra",
  pontevedra: "Pontevedra",
  salamanca: "Salamanca",
  "san sebastian": "Guipúzcoa",
  santander: "Cantabria",
  "santa cruz de tenerife": "Santa Cruz de Tenerife",
  segovia: "Segovia",
  sevilla: "Sevilla",
  soria: "Soria",
  tarragona: "Tarragona",
  teruel: "Teruel",
  toledo: "Toledo",
  valencia: "Valencia",
  valladolid: "Valladolid",
  vitoria: "Álava",
  zamora: "Zamora",
  zaragoza: "Zaragoza",
};

function normalizeLocation(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function provinciaDesdeCapital(municipio?: string | null): string {
  return CAPITAL_A_PROVINCIA[normalizeLocation(municipio)] || "";
}

/**
 * Resultado normalizado al seleccionar una sugerencia de Photon.
 * Cualquier campo puede venir vacío — el consumidor decide qué hacer.
 */
export interface PhotonSelection {
  tipo_via?: string;
  nombre_via?: string;
  numero?: string;
  municipio?: string;
  codigo_postal?: string;
  provincia?: string;
  comunidad_autonoma?: string;
  lat?: number;
  lon?: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    locality?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    type?: string;
    osm_id?: number;
  };
}

async function fetchPhotonFeature(query: string): Promise<PhotonFeature | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=1&countrycode=es`;
  const res = await fetch(url);
  const data = await res.json();
  return Array.isArray(data?.features) && data.features[0] ? data.features[0] : null;
}

interface Props {
  onSelect: (selection: PhotonSelection) => void;
  placeholder?: string;
  /**
   * Si es `true`, tras una selección de Photon se muestra un texto
   * discreto recordando rellenar manualmente planta / puerta / portal.
   * El padre decide cuándo siguen pendientes esos campos.
   */
  interiorPending?: boolean;
}

/**
 * Buscador de direcciones (Photon / Komoot). Sin clave, limitado a España.
 * Solo rellena campos cuando el usuario elige explícitamente una sugerencia
 * — nunca autocompleta mientras escribe. Sustituye al antiguo lookup
 * automático contra Nominatim.
 */
const PhotonAddressSearch = ({
  onSelect,
  placeholder = "Busca tu dirección...",
  interiorPending = false,
}: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setSearched(false);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=5&countrycode=es`;
        const res = await fetch(url);
        const data = await res.json();
        const feats: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
        setResults(feats);
        setSearched(true);
        setOpen(true);
      } catch {
        setResults([]);
        setSearched(true);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatLine = (f: PhotonFeature): { primary: string; secondary: string } => {
    const p = f.properties ?? {};
    const street = p.street || p.name || "";
    const primary = [street, p.housenumber].filter(Boolean).join(" ").trim() || p.name || "";
    const muni = p.city || p.town || p.village || p.locality || p.district || "";
    const secondary = [muni, p.county || p.state].filter(Boolean).join(", ");
    return { primary, secondary };
  };

  const handleSelect = async (f: PhotonFeature) => {
    const p = f.properties ?? {};
    // Photon devuelve a veces el tipo de vía en `name` ("Calle Mayor") y
    // a veces en `street`. Probamos ambas y nos quedamos con la que sí
    // reconozca un tipo de vía; si ninguna lo reconoce, dejamos vacío.
    const candidatos = [p.name, p.street].filter(Boolean) as string[];
    let parsed = parseDireccionLibre(candidatos[0] || "");
    let fuente = candidatos[0] || "";
    for (const c of candidatos) {
      const r = parseDireccionLibre(c);
      if (r.tipo_via_label) {
        parsed = r;
        fuente = c;
        break;
      }
    }
    const numero = p.housenumber || parsed.numero || "";
    const nombre_via = parsed.nombre_via || p.street || fuente;
    const tipo_via = parsed.tipo_via_label || "";
    const municipio = p.city || p.town || p.village || p.locality || p.district || "";
    const baseProvincia = p.county || (p.postcode ? provinciaDesdeCP(p.postcode) || "" : "") || provinciaDesdeCapital(municipio);
    let enriched = f;
    let ep = p;
    const needsEnrichment = !p.postcode || !baseProvincia;

    if (needsEnrichment) {
      const enrichedFeature = await fetchPhotonFeature(
        [fuente || nombre_via, numero, municipio].filter(Boolean).join(" "),
      ).catch(() => null);
      if (enrichedFeature) {
        enriched = enrichedFeature;
        ep = enrichedFeature.properties ?? p;
      }
    }

    const codigo_postal = p.postcode || ep.postcode || "";
    let provincia = p.county || ep.county || "";

    if (!provincia && codigo_postal) {
      provincia = provinciaDesdeCP(codigo_postal) || "";
    }
    if (!provincia && municipio) {
      provincia = provinciaDesdeCapital(municipio);
    }

    const comunidad_autonoma = provincia
      ? comunidadDesdeProvincia(provincia) || ""
      : "";

    const coords = f.geometry?.coordinates || enriched.geometry?.coordinates;
    const sel: PhotonSelection = {
      tipo_via: tipo_via || undefined,
      nombre_via: nombre_via || undefined,
      numero: numero || undefined,
      municipio: municipio || undefined,
      codigo_postal: codigo_postal || undefined,
      provincia: provincia || undefined,
      comunidad_autonoma: comunidad_autonoma || undefined,
      lon: coords?.[0],
      lat: coords?.[1],
    };
    onSelect(sel);
    setQuery("");
    setResults([]);
    setOpen(false);
    setSearched(false);
    setJustSelected(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {results.map((f, i) => {
            const { primary, secondary } = formatLine(f);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelect(f)}
                  className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <div className="text-sm font-medium">{primary || "(sin nombre)"}</div>
                  {secondary && (
                    <div className="text-xs text-muted-foreground">{secondary}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && searched && !loading && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No encontramos esa dirección. Puedes rellenar los campos manualmente.
        </p>
      )}

      {justSelected && interiorPending && (
        <p className="mt-2 text-xs text-muted-foreground">
          La dirección completa incluye planta, puerta y portal. Rellénalos
          manualmente después de buscar.
        </p>
      )}
    </div>
  );
};

export default PhotonAddressSearch;