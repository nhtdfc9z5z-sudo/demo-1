import type { RelacionTitularidad, CopropietarioInput } from "./types";

/**
 * Único punto de verdad para detectar datos pendientes de completar
 * en el paso de Titularidad. Consumido por:
 *   - TitularidadStep (no bloquea, solo informa)
 *   - ResumenAltaFinal (sección "Pendiente de completar")
 *   - Centro de salud / Auditoría (futuro)
 */

export interface TitularidadPendientesInput {
  relacion: RelacionTitularidad;
  copropietarios?: CopropietarioInput[];
  nudo_propietario_nombre?: string;
  nudo_propietario_nif?: string;
  tercero_nombre?: string;
  tercero_dni?: string;
  comision_pct?: number | null;
  renta_pagada_mensual?: number | null;
}

const trim = (v?: string | null) => (v ?? "").trim();

export function detectarPendientes(input: TitularidadPendientesInput): string[] {
  const out: string[] = [];

  switch (input.relacion) {
    case "propietario_unico":
      break;

    case "copropietarios": {
      const cps = input.copropietarios ?? [];
      if (cps.length === 0) {
        out.push("copropietarios_vacio");
        break;
      }
      cps.forEach((cp, i) => {
        if (!trim(cp.nombre)) out.push(`copropietario_${i}_nombre`);
        if (!trim(cp.dni)) out.push(`copropietario_${i}_dni`);
        if (!trim(cp.porcentaje)) out.push(`copropietario_${i}_porcentaje`);
      });
      const suma = cps.reduce((acc, cp) => {
        const n = Number(String(cp.porcentaje).replace(",", "."));
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (cps.every(cp => trim(cp.porcentaje)) && Math.abs(suma - 100) > 0.01) {
        out.push("copropietarios_suma");
      }
      break;
    }

    case "usufructuario":
      if (!trim(input.nudo_propietario_nombre)) out.push("nudo_propietario_nombre");
      if (!trim(input.nudo_propietario_nif)) out.push("nudo_propietario_nif");
      break;

    case "gestor":
      if (!trim(input.tercero_nombre)) out.push("propietario_real_nombre");
      if (!trim(input.tercero_dni)) out.push("propietario_real_nif");
      // comision_pct es opcional, no pendiente
      break;

    case "subarrendador":
      if (!trim(input.tercero_nombre)) out.push("propietario_original_nombre");
      if (!trim(input.tercero_dni)) out.push("propietario_original_nif");
      if (input.renta_pagada_mensual == null) out.push("renta_pagada_mensual");
      break;
  }

  return out;
}

/**
 * Convierte cada código de `detectarPendientes` en una etiqueta legible
 * para mostrar al usuario (ResumenAltaFinal, Centro de salud, etc.).
 */
export function etiquetaPendienteTitularidad(codigo: string): string {
  if (codigo === "copropietarios_vacio") return "Datos de copropietarios";
  if (codigo === "copropietarios_suma") return "Porcentajes de copropiedad (deben sumar 100%)";
  const cpMatch = codigo.match(/^copropietario_(\d+)_(nombre|dni|porcentaje)$/);
  if (cpMatch) {
    const idx = Number(cpMatch[1]) + 1;
    const campo = cpMatch[2] === "dni" ? "DNI/NIF" : cpMatch[2] === "porcentaje" ? "% participación" : "nombre";
    return `Copropietario ${idx}: ${campo}`;
  }
  if (codigo === "nudo_propietario_nombre") return "Nombre del nudo propietario";
  if (codigo === "nudo_propietario_nif") return "DNI/NIF del nudo propietario";
  if (codigo === "propietario_real_nombre") return "Nombre del propietario (gestión)";
  if (codigo === "propietario_real_nif") return "DNI/NIF/CIF del propietario (gestión)";
  if (codigo === "propietario_original_nombre") return "Nombre del propietario original (subarriendo)";
  if (codigo === "propietario_original_nif") return "DNI/NIF/CIF del propietario original (subarriendo)";
  if (codigo === "renta_pagada_mensual") return "Renta mensual pagada al propietario";
  return codigo;
}
