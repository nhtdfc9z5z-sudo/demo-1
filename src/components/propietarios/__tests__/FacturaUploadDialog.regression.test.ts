import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regresión: `FacturaUploadDialog` NO debe crear un `property_gastos`
 * automáticamente al guardar una factura. Esa duplicidad provocaba doble
 * cómputo en fiscalPack (factura + gasto). Regla del proyecto:
 * "un gasto vive en una sola tabla".
 */
describe("FacturaUploadDialog regression: sin doble inserción", () => {
  const src = readFileSync(
    path.join(process.cwd(), "src/components/propietarios/FacturaUploadDialog.tsx"),
    "utf8",
  );

  it("no contiene la función legacy createGastoFromFactura", () => {
    expect(src).not.toMatch(/createGastoFromFactura/);
  });

  it("no inserta directamente en property_gastos", () => {
    expect(src).not.toMatch(/from\(["']property_gastos["']\)\s*\.insert/);
    expect(src).not.toMatch(/property_gastos[^a-zA-Z_]/);
  });
});