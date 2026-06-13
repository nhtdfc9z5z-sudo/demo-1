import { describe, it, expect, beforeEach } from "vitest";
import {
  STORAGE_KEY,
  defaultState,
  readState,
  writeState,
  markShown,
  markDismissed,
  markActionTaken,
  puedeMostrar,
} from "../storage";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("progresoInteligente/storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("devuelve estado por defecto cuando no hay nada guardado", () => {
    const s = readState(storage);
    expect(s).toEqual(defaultState());
  });

  it("guarda y lee estado", () => {
    const now = new Date("2026-06-07T10:00:00Z");
    const s = markShown("msg-1", now, storage);
    expect(s.lastMessageId).toBe("msg-1");
    const reread = readState(storage);
    expect(reread.lastMessageId).toBe("msg-1");
    expect(reread.lastShownAt).toBe(now.toISOString());
  });

  it("incrementa contador de cierres consecutivos y activa frecuencia reducida tras 3", () => {
    const now = new Date("2026-06-07T10:00:00Z");
    let s = markDismissed(now, storage);
    expect(s.consecutiveDismisses).toBe(1);
    expect(s.frecuenciaReducida).toBe(false);
    s = markDismissed(now, storage);
    s = markDismissed(now, storage);
    expect(s.consecutiveDismisses).toBe(3);
    expect(s.frecuenciaReducida).toBe(true);
  });

  it("acción del usuario resetea contador y desactiva frecuencia reducida", () => {
    const now = new Date("2026-06-07T10:00:00Z");
    markDismissed(now, storage);
    markDismissed(now, storage);
    markDismissed(now, storage);
    const s = markActionTaken(now, storage);
    expect(s.consecutiveDismisses).toBe(0);
    expect(s.frecuenciaReducida).toBe(false);
    expect(s.lastActionAt).toBe(now.toISOString());
  });

  it("puedeMostrar respeta ventana de 48h en modo normal", () => {
    const t0 = new Date("2026-06-07T10:00:00Z");
    markDismissed(t0, storage);
    const s = readState(storage);
    expect(puedeMostrar(s, new Date("2026-06-08T10:00:00Z"))).toBe(false);
    expect(puedeMostrar(s, new Date("2026-06-09T10:00:01Z"))).toBe(true);
  });

  it("puedeMostrar respeta ventana de 72h en frecuencia reducida", () => {
    const t0 = new Date("2026-06-01T10:00:00Z");
    markDismissed(t0, storage);
    markDismissed(t0, storage);
    markDismissed(t0, storage);
    const s = readState(storage);
    expect(s.frecuenciaReducida).toBe(true);
    expect(puedeMostrar(s, new Date("2026-06-03T10:00:00Z"))).toBe(false);
    expect(puedeMostrar(s, new Date("2026-06-04T10:00:01Z"))).toBe(true);
  });

  it("ignora JSON corrupto y devuelve default", () => {
    storage.setItem(STORAGE_KEY, "no-json-{");
    const s = readState(storage);
    expect(s).toEqual(defaultState());
  });
});