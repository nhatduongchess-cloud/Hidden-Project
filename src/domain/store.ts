import type { AppState } from './types';
import { reducer, type Action } from './reducer';
import { STATE_VERSION, STORAGE_KEY } from './constants';
import { createSeedState } from './seed';

export interface Store {
  getState(): AppState;
  dispatch(a: Action): void;
  subscribe(fn: () => void): () => void;
  reset(): void;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadState(storage: StorageLike | null): AppState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return parsed && parsed.version === STATE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(storage: StorageLike | null, state: AppState): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the demo keeps running in memory */
  }
}

/** Tiny synchronous store so the deposit sequence can read state between steps. */
export function createStore(storage: StorageLike | null = safeStorage(), seed: () => AppState = () => createSeedState()): Store {
  let state = loadState(storage) ?? seed();
  const subs = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveState(storage, state), 150);
  };
  const flush = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveState(storage, state);
  };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
  saveState(storage, state);
  return {
    getState: () => state,
    dispatch(a) {
      const next = reducer(state, a);
      if (next === state) return;
      state = next;
      persist();
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    reset() {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state = seed();
      flush();
      subs.forEach((f) => f());
    },
  };
}
