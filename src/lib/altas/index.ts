/**
 * Altas — Single source of truth for creating CapitalRent core entities.
 *
 * RULE: every code path that creates an Activo, an Inquilino, or a Contrato
 * MUST go through this module. UI variants (PDF, fotos, cámara, manual,
 * OCR) only change HOW data is captured — never HOW it is persisted.
 *
 * Architecture:
 *   crearActivo(input)       → properties row (or specialised table)
 *   crearInquilino(input)    → inquilinos row
 *   crearContrato(input)     → contratos_arrendamiento + contrato_personas
 *   crearAltaCompleta(...)   → orchestrates the three for the alquiler wizard
 *
 * All helpers:
 *   - require an authenticated user (read from supabase.auth)
 *   - normalise structured address fields via formatDireccion
 *   - return { id, ... } on success or throw with a Spanish error message
 */

export * from "./crearActivo";
export * from "./crearInquilino";
export * from "./crearContrato";
export * from "./crearAltaCompleta";
export * from "./crearPagosHistoricos";
export * from "./types";
export * from "./raw";