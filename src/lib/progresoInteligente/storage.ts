/**
 * Persistencia local del banner inteligente.
 * No depende de Supabase. Sin PII.
 */

export const STORAGE_KEY = "capitalrent.progreso-inteligente.v1";

export interface ProgresoState {
  lastShownAt: string | null;
  lastDismissAt: string | null;
  lastActionAt: string | null;
  consecutiveDismisses: number;
  frecuenciaReducida: boolean;
  lastMessageId: string | null;
}

export function defaultState(): ProgresoState {
  return {
    lastShownAt: null,
    lastDismissAt: null,
    lastActionAt: null,
    consecutiveDismisses: 0,
    frecuenciaReducida: false,
    lastMessageId: null,
  };
}

export function readState(storage: Storage = safeLocalStorage()): ProgresoState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function writeState(state: ProgresoState, storage: Storage = safeLocalStorage()): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function markShown(messageId: string, now: Date, storage?: Storage): ProgresoState {
  const s = readState(storage);
  const next: ProgresoState = {
    ...s,
    lastShownAt: now.toISOString(),
    lastMessageId: messageId,
  };
  writeState(next, storage);
  return next;
}

export function markDismissed(now: Date, storage?: Storage): ProgresoState {
  const s = readState(storage);
  const consecutiveDismisses = s.consecutiveDismisses + 1;
  const next: ProgresoState = {
    ...s,
    lastDismissAt: now.toISOString(),
    consecutiveDismisses,
    frecuenciaReducida: consecutiveDismisses >= 3,
  };
  writeState(next, storage);
  return next;
}

export function markActionTaken(now: Date, storage?: Storage): ProgresoState {
  const s = readState(storage);
  const next: ProgresoState = {
    ...s,
    lastActionAt: now.toISOString(),
    consecutiveDismisses: 0,
    frecuenciaReducida: false,
  };
  writeState(next, storage);
  return next;
}

/**
 * ¿Permitimos mostrar un mensaje ahora según la ventana temporal?
 */
export function puedeMostrar(state: ProgresoState, now: Date): boolean {
  if (!state.lastDismissAt) return true;
  const diffMs = now.getTime() - new Date(state.lastDismissAt).getTime();
  const horas = diffMs / (1000 * 60 * 60);
  // Ventanas ampliadas para reducir solapamientos y fatiga del usuario:
  // - Modo normal: 48h tras cierre.
  // - Frecuencia reducida (tras 3 cierres seguidos): 72h (máximo una vez cada 3 días).
  const ventanaHoras = state.frecuenciaReducida ? 72 : 48;
  return horas >= ventanaHoras;
}

function safeLocalStorage(): Storage {
  if (typeof window === "undefined") {
    // Memory fallback for SSR/tests sin window
    return memoryStorage;
  }
  return window.localStorage;
}

const memoryMap = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memoryMap.size;
  },
  clear: () => memoryMap.clear(),
  getItem: (k) => memoryMap.get(k) ?? null,
  key: (i) => Array.from(memoryMap.keys())[i] ?? null,
  removeItem: (k) => {
    memoryMap.delete(k);
  },
  setItem: (k, v) => {
    memoryMap.set(k, v);
  },
};