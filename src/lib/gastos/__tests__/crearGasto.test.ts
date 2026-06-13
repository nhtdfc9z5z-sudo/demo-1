import { describe, it, expect, vi, beforeEach } from "vitest";

const authState: { userId: string | null } = { userId: "user-A" };
const properties: Record<string, { id: string; user_id: string }> = {
  "prop-A": { id: "prop-A", user_id: "user-A" },
  "prop-B": { id: "prop-B", user_id: "user-B" },
};
const inserted: any[] = [];
const deleted: string[] = [];
const uploaded: { bucket: string; path: string }[] = [];
let uploadShouldFail = false;
const documentos: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: authState.userId ? { id: authState.userId } : null } }),
      },
      from: (table: string) => {
        if (table === "properties") {
          return {
            select: () => ({
              eq: (_c: string, id: string) => ({
                maybeSingle: async () => ({ data: properties[id] || null, error: null }),
              }),
            }),
          };
        }
        if (table === "property_gastos") {
          return {
            insert: (row: any) => ({
              select: () => ({
                single: async () => {
                  inserted.push(row);
                  return { data: { id: `gasto-${inserted.length}` }, error: null };
                },
              }),
            }),
            update: (_row: any) => ({
              eq: () => ({ eq: async () => ({ data: null, error: null }) }),
            }),
            delete: () => ({
              eq: (_c: string, id: string) => ({
                eq: async () => { deleted.push(id); return { data: null, error: null }; },
              }),
            }),
          };
        }
        if (table === "property_documentos") {
          return {
            insert: async (row: any) => { documentos.push(row); return { data: null, error: null }; },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string) => {
            if (uploadShouldFail) return { data: null, error: { message: "boom" } };
            uploaded.push({ bucket, path });
            return { data: { path }, error: null };
          },
        }),
      },
    },
  };
});

import { crearGasto } from "../crearGasto";

beforeEach(() => {
  inserted.length = 0;
  deleted.length = 0;
  uploaded.length = 0;
  documentos.length = 0;
  uploadShouldFail = false;
  authState.userId = "user-A";
});

describe("crearGasto", () => {
  it("crea gasto con datos válidos y asigna user_id de la sesión", async () => {
    const r = await crearGasto({
      property_id: "prop-A",
      fecha: "2025-03-10",
      importe: 120.5,
      categoria: "ibi",
    });
    expect(r.id).toBe("gasto-1");
    expect(inserted[0].user_id).toBe("user-A");
    expect(inserted[0].property_id).toBe("prop-A");
    expect(inserted[0].categoria).toBe("ibi");
    expect(inserted[0].importe).toBe(120.5);
    // Sin fecha_devengo explícita → cae a `fecha`.
    expect(inserted[0].fecha).toBe("2025-03-10");
    expect(inserted[0].fecha_devengo).toBe("2025-03-10");
  });

  it("guarda fecha_devengo distinta a fecha operativa cuando se aporta (doc de año anterior)", async () => {
    await crearGasto({
      property_id: "prop-A",
      fecha: "2026-06-10",         // hoy / fecha operativa
      fecha_devengo: "2024-06-30", // fecha del documento OCR
      importe: 75,
      categoria: "comunidad",
    });
    expect(inserted[0].fecha).toBe("2026-06-10");
    expect(inserted[0].fecha_devengo).toBe("2024-06-30");
  });

  it("rechaza fecha_devengo inválida", async () => {
    await expect(
      crearGasto({
        property_id: "prop-A", fecha: "2026-06-10", fecha_devengo: "30/06/2024",
        importe: 10, categoria: "ibi",
      }),
    ).rejects.toThrow(/devengo/i);
  });

  it("rechaza property_id que no pertenece al usuario", async () => {
    await expect(
      crearGasto({ property_id: "prop-B", fecha: "2025-03-10", importe: 50, categoria: "ibi" }),
    ).rejects.toThrow(/no pertenece/i);
    expect(inserted).toHaveLength(0);
  });

  it("rechaza importe <= 0", async () => {
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "2025-03-10", importe: 0, categoria: "ibi" }),
    ).rejects.toThrow(/importe/i);
  });

  it("rechaza fecha vacía o inválida", async () => {
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "", importe: 10, categoria: "ibi" }),
    ).rejects.toThrow(/fecha/i);
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "10/03/2025", importe: 10, categoria: "ibi" }),
    ).rejects.toThrow(/fecha/i);
  });

  it("rechaza categoría inválida", async () => {
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "2025-03-10", importe: 10, categoria: "phantom" as any }),
    ).rejects.toThrow(/categoría/i);
  });

  it("rechaza property_id vacío", async () => {
    await expect(
      crearGasto({ property_id: "", fecha: "2025-03-10", importe: 10, categoria: "ibi" }),
    ).rejects.toThrow(/activo/i);
  });

  it("rechaza sin sesión", async () => {
    authState.userId = null;
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "2025-03-10", importe: 10, categoria: "ibi" }),
    ).rejects.toThrow(/sesión/i);
  });

  it("sube archivo a facturas/{user_id}/{gasto_id}/... y, si falla, hace rollback del gasto", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const file = new File([blob], "f.png", { type: "image/png" });

    // Caso ok
    await crearGasto({
      property_id: "prop-A", fecha: "2025-03-10", importe: 10, categoria: "ibi", archivo: file,
    });
    expect(uploaded[0].bucket).toBe("facturas");
    expect(uploaded[0].path.startsWith("user-A/gasto-1/")).toBe(true);
    // Documento vinculado con categoría reservada para gastos
    expect(documentos).toHaveLength(1);
    expect(documentos[0].categoria).toBe("factura_gasto");
    expect(documentos[0].gasto_id).toBe("gasto-1");
    expect(documentos[0].storage_path).toBe(uploaded[0].path);

    // Caso fallo subida → rollback
    uploadShouldFail = true;
    await expect(
      crearGasto({ property_id: "prop-A", fecha: "2025-03-10", importe: 10, categoria: "ibi", archivo: file }),
    ).rejects.toThrow(/archivo/i);
    expect(deleted).toContain("gasto-2");
  });

  it("guarda proveedor_id y factura_id cuando se aportan", async () => {
    await crearGasto({
      property_id: "prop-A",
      fecha: "2025-03-10",
      importe: 50,
      categoria: "ibi",
      proveedor_id: "prov-1",
      factura_id: "fact-1",
    });
    expect(inserted[0].proveedor_id).toBe("prov-1");
    expect(inserted[0].factura_id).toBe("fact-1");
  });

  it("guarda gasto_compartido y porcentaje_usuario cuando se aportan", async () => {
    await crearGasto({
      property_id: "prop-A",
      fecha: "2025-03-10",
      importe: 200,
      categoria: "comunidad",
      gasto_compartido: true,
      porcentaje_usuario: 50,
    });
    expect(inserted[0].gasto_compartido).toBe(true);
    expect(inserted[0].porcentaje_usuario).toBe(50);
  });

  it("rechaza gasto_compartido con porcentaje fuera de 1..100", async () => {
    await expect(
      crearGasto({
        property_id: "prop-A", fecha: "2025-03-10", importe: 100, categoria: "ibi",
        gasto_compartido: true, porcentaje_usuario: 0,
      }),
    ).rejects.toThrow(/porcentaje/i);
    await expect(
      crearGasto({
        property_id: "prop-A", fecha: "2025-03-10", importe: 100, categoria: "ibi",
        gasto_compartido: true, porcentaje_usuario: 150,
      }),
    ).rejects.toThrow(/porcentaje/i);
  });

  it("si gasto_compartido es false, porcentaje_usuario se guarda como null", async () => {
    await crearGasto({
      property_id: "prop-A", fecha: "2025-03-10", importe: 30, categoria: "ibi",
      gasto_compartido: false, porcentaje_usuario: 50,
    });
    expect(inserted[0].gasto_compartido).toBe(false);
    expect(inserted[0].porcentaje_usuario).toBeNull();
  });
});