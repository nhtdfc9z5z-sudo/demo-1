/**
 * Guard: no code outside `src/lib/altas/` may insert directly into the three
 * core tables (properties, inquilinos, contratos_arrendamiento). All writes
 * MUST go through the altas motor (insertPropertyRow / insertInquilinoRow /
 * insertContratoRow or the typed crearActivo / crearInquilino / crearContrato
 * / crearAltaCompleta).
 *
 * If this test fails: route your new code through `@/lib/altas` instead of
 * calling supabase.from(...).insert(...) directly.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const FORBIDDEN_TABLES = [
  "properties",
  "inquilinos",
  "contratos_arrendamiento",
  // Subactivos patrimoniales (fase A+B: motor único de altas).
  "habitaciones",
  "garajes",
  "trasteros",
  "oficinas",
  "locales_naves",
  "terrenos",
  "edificios",
] as const;

const ROOT = join(process.cwd(), "src");
const ALLOWED_PREFIX = join("src", "lib", "altas");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("guard: no direct inserts to core tables outside src/lib/altas/", () => {
  const files = walk(ROOT).filter((f) => !f.includes(ALLOWED_PREFIX));

  for (const table of FORBIDDEN_TABLES) {
    // matches `.from("table")` (single line) or split across two lines as
    // `.from(\n  "table"\n)` — we use a tolerant regex that accepts whitespace.
    const fromRegex = new RegExp(
      `\\.from\\(\\s*["']${table}["']\\s*\\)`,
    );
    const insertNearby = /\.insert\s*\(/;

    it(`no direct .insert on "${table}" outside src/lib/altas/`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        if (!fromRegex.test(text)) continue;
        // Quick heuristic: same file must also contain `.insert(`. Then walk
        // line by line and flag any `.from("<table>")` followed (within 6
        // lines, before any closing semicolon at column 0) by `.insert(`.
        if (!insertNearby.test(text)) continue;

        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (!fromRegex.test(lines[i])) continue;
          const windowText = lines.slice(i, Math.min(i + 8, lines.length)).join("\n");
          if (insertNearby.test(windowText)) {
            offenders.push(`${file.replace(process.cwd() + "/", "")}:${i + 1}`);
            break;
          }
        }
      }
      expect(
        offenders,
        `Direct inserts to "${table}" are forbidden outside src/lib/altas/. ` +
          `Route through the matching helper in "@/lib/altas/raw" ` +
          `(insertPropertyRow / insertInquilinoRow / insertContratoRow / insertSubactivoRow) ` +
          `or the typed crear* functions.\n` +
          `Offenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }
});