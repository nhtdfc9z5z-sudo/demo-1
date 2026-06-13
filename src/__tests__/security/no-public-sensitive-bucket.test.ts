import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SENSITIVE_BUCKETS } from "@/lib/storage/secureStorage";

/**
 * Sprint 4.1B — Guard automático.
 *
 * Garantiza que ningún componente vuelve a llamar a `getPublicUrl` sobre
 * un bucket sensible. Cualquier acceso a esos ficheros debe ir a través de
 * `resolveStorageUrl` / `SecureFileLink` o de `createSignedUrl`.
 */

const ROOT = join(__dirname, "..", "..");
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "__tests__",
  "lib/storage", // helper que documenta los buckets
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = p.replace(ROOT + "/", "");
    if (EXCLUDED_DIRS.has(name) || EXCLUDED_DIRS.has(rel)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("Storage security — buckets sensibles", () => {
  const files = walk(ROOT);

  for (const bucket of SENSITIVE_BUCKETS) {
    it(`no usa getPublicUrl con bucket "${bucket}"`, () => {
      const offenders: string[] = [];
      // Patrón laxo: from("<bucket>") ... getPublicUrl  o  from('<bucket>')
      const re = new RegExp(
        `from\\((?:["\\'\`])${bucket}(?:["\\'\`])\\)[\\s\\S]{0,200}?getPublicUrl`,
        "m",
      );
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        if (re.test(src)) offenders.push(f.replace(ROOT + "/", ""));
      }
      expect(offenders).toEqual([]);
    });
  }
});