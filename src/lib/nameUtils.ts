/**
 * Removes Spanish/English honorifics from names extracted by AI.
 * e.g. "Don Juan" → "Juan", "Dña. María García" → "María García"
 */
export function stripHonorifics(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/^(Don|Doña|Dña\.|Dña|D\.\s*ª|D\.|Dª\.|Dª|Señor|Señora|Sr\.|Sra\.|Sr|Sra|Mr\.|Mrs\.|Ms\.)\s+/i, '')
    .trim();
}
