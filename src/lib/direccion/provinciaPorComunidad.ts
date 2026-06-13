/**
 * Comunidades uniprovinciales: cuando la comunidad autónoma está
 * definida pero la provincia no, podemos inferirla automáticamente.
 * Canarias y el resto de comunidades pluriprovinciales no se infieren.
 */
const MAPA: Record<string, string> = {
  "comunidad de madrid": "Madrid",
  "madrid": "Madrid",
  "región de murcia": "Murcia",
  "region de murcia": "Murcia",
  "murcia": "Murcia",
  "principado de asturias": "Asturias",
  "asturias": "Asturias",
  "cantabria": "Cantabria",
  "la rioja": "La Rioja",
  "rioja": "La Rioja",
  "comunidad foral de navarra": "Navarra",
  "navarra": "Navarra",
  "illes balears": "Illes Balears",
  "islas baleares": "Illes Balears",
  "baleares": "Illes Balears",
};

export function provinciaDesdeComunidad(
  comunidad: string | null | undefined,
): string | null {
  if (!comunidad) return null;
  const key = comunidad.trim().toLowerCase();
  return MAPA[key] ?? null;
}