import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const insertDocMock = vi.fn();
const insertVinMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: uploadMock }),
    },
    from: (table: string) => {
      if (table === "documentos") {
        return {
          insert: (payload: any) => {
            insertDocMock(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: "doc-1" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "documento_vinculos") {
        return {
          insert: async (payload: any) => {
            insertVinMock(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import { guardarComunicacion } from "../guardarComunicacion";

beforeEach(() => {
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({ error: null });
  insertDocMock.mockReset();
  insertVinMock.mockReset();
});

describe("guardarComunicacion", () => {
  it("uploads, inserts the doc and links contrato + property", async () => {
    const { id } = await guardarComunicacion({
      userId: "u-1",
      contratoId: "c-1",
      propertyId: "p-1",
      canal: "carta",
      contexto: "revision_renta",
      texto: "Estimado inquilino...",
    });

    expect(id).toBe("doc-1");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(insertDocMock).toHaveBeenCalledTimes(1);
    const docPayload = insertDocMock.mock.calls[0][0];
    expect(docPayload.categoria).toBe("comunicacion");
    expect(docPayload.bucket).toBe("documentos");
    expect(docPayload.origen_tipo).toBe("comunicacion_legal");
    expect(docPayload.origen_id).toBe("c-1");

    expect(insertVinMock).toHaveBeenCalledTimes(1);
    const vinPayload = insertVinMock.mock.calls[0][0];
    expect(vinPayload).toHaveLength(2);
    expect(vinPayload[0].entidad_tipo).toBe("contrato");
    expect(vinPayload[1].entidad_tipo).toBe("activo");
  });

  it("skips vinculo insert when no contrato/property given", async () => {
    await guardarComunicacion({
      userId: "u-1",
      canal: "email",
      contexto: "generico",
      texto: "Hola",
    });
    expect(insertVinMock).not.toHaveBeenCalled();
  });

  it("rejects empty text", async () => {
    await expect(
      guardarComunicacion({ userId: "u-1", canal: "carta", contexto: "generico", texto: "" }),
    ).rejects.toThrow();
  });
});