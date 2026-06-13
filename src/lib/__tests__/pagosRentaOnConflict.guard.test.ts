/**
 * Guard Sprint 3.7: cualquier upsert sobre pagos_renta DEBE usar
 * onConflict = "contrato_id,mes,anio". El legacy
 * "property_id,inquilino_id,mes,anio" queda prohibido fuera del propio
 * usePagosRenta (que solo lo referencia para migrar) y de tests.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
const LEGACY_KEY = "property_id,inquilino_id,mes,anio";
const CANONICAL_KEY = "contrato_id,mes,anio";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("guard: pagos_renta upserts use contrato canonical key", () => {
  const files = walk(ROOT);

  it(`no usage of legacy onConflict "${LEGACY_KEY}" in non-test source`, () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.includes("__tests__")) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(LEGACY_KEY)) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }
    expect(
      offenders,
      `Use onConflict: "${CANONICAL_KEY}" instead. Offenders:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every pagos_renta upsert in usePagosRenta uses contrato_id,mes,anio", () => {
    const text = readFileSync(join(ROOT, "hooks/usePagosRenta.ts"), "utf8");
    // Acepta literal o constante. Buscamos cualquier onConflict y verificamos
    // que solo aparecen formas válidas: literal canonical o constante.
    const occurrences = text.match(/onConflict:\s*[^,\n)]+/g) || [];
    expect(occurrences.length).toBeGreaterThan(0);
    for (const occ of occurrences) {
      const ok =
        occ.includes(CANONICAL_KEY) ||
        occ.includes("ON_CONFLICT_CONTRATO");
      expect(ok, `onConflict no canónico encontrado: ${occ}`).toBe(true);
    }
  });
});