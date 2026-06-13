/**
 * Smoke test del flujo completo archivo → OCR → fusión.
 *
 * Mockeamos `supabase.functions.invoke` para verificar que:
 *   - cada archivo dispara UNA llamada a "analyze-contrato"
 *   - los resultados se fusionan según reglas (primer archivo gana,
 *     arrendatarios se acumulan)
 *   - si la edge function falla en uno o todos los archivos, no
 *     se lanza excepción y el caller puede ofrecer fallback manual
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
  },
}));

// Import DESPUÉS del mock para que el wrapper use el cliente mockeado.
import { analizarDocumento } from "../analizarDocumento";

function fakeFile(name: string, type = "application/pdf"): File {
  // jsdom no implementa Blob.arrayBuffer() en todas las versiones.
  // Creamos un stub mínimo con la API que usa analizarDocumento.
  return {
    name,
    type,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  } as unknown as File;
}

beforeEach(() => {
  invokeMock.mockReset();
});

describe("analizarDocumento(File[])", () => {
  it("devuelve resultado vacío si no hay archivos", async () => {
    const r = await analizarDocumento([]);
    expect(r.fusionado).toBeNull();
    expect(r.okCount).toBe(0);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("llama una vez por archivo y fusiona resultados", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          renta_mensual: 800,
          direccion_calle: "Calle Arces",
          fecha_inicio: "2024-01-01",
          arrendatarios: [{ nombre: "Ana López", nif: "12345678A" }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          renta_mensual: 950, // debe perder frente al primero
          fianza_importe: 800,
          arrendatarios: [
            { nombre: "Ana López", nif: "12345678A", email: "ana@ex.com" },
            { nombre: "Pepe Ruiz", nif: "87654321B" },
          ],
        },
        error: null,
      });

    const files = [fakeFile("principal.pdf"), fakeFile("anexo.pdf")];
    const r = await analizarDocumento(files);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0][0]).toBe("analyze-contrato");
    expect(invokeMock.mock.calls[0][1]).toMatchObject({
      body: { mimeType: "application/pdf" },
    });
    expect(typeof (invokeMock.mock.calls[0][1] as any).body.imageBase64).toBe("string");

    expect(r.okCount).toBe(2);
    expect(r.errorCount).toBe(0);
    expect(r.fusionado).not.toBeNull();
    // primer archivo gana en renta
    expect(r.fusionado!.renta_mensual).toBe(800);
    // segundo archivo completa fianza
    expect(r.fusionado!.fianza_importe).toBe(800);
    // arrendatarios acumulan y deduplican (Ana completa con email del 2º)
    expect(r.fusionado!.arrendatarios).toHaveLength(2);
    const ana = r.fusionado!.arrendatarios!.find((x) => x.nif === "12345678A")!;
    expect(ana.email).toBe("ana@ex.com");
  });

  it("si TODOS los archivos fallan, no lanza y permite fallback manual", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: { message: "AI gateway 500" } })
      .mockRejectedValueOnce(new Error("network"));

    const r = await analizarDocumento([fakeFile("a.pdf"), fakeFile("b.pdf")]);
    expect(r.fusionado).toBeNull();
    expect(r.okCount).toBe(0);
    expect(r.errorCount).toBe(2);
    expect(r.porArchivo[0].status).toBe("error");
    expect(r.porArchivo[1].status).toBe("error");
  });

  it("si solo algunos fallan, fusiona los OK y reporta los fallidos", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: { message: "rate limit" } })
      .mockResolvedValueOnce({
        data: { renta_mensual: 720, arrendatarios: [{ nombre: "Solo Uno" }] },
        error: null,
      });

    const r = await analizarDocumento([fakeFile("bad.pdf"), fakeFile("good.pdf")]);
    expect(r.okCount).toBe(1);
    expect(r.errorCount).toBe(1);
    expect(r.fusionado).not.toBeNull();
    expect(r.fusionado!.renta_mensual).toBe(720);
    expect(r.fusionado!.arrendatarios).toHaveLength(1);
  });
});