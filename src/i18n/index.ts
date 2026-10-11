import { vi, type Dict } from './vi';
import { en } from './en';

export type Locale = 'vi' | 'en';

function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && typeof v === 'object' ? merge(b, v) : v;
  }
  return out as T;
}

const dicts: Record<Locale, Dict> = { vi, en: merge(vi, en) };
let current: Locale = 'vi';

export function setLocale(l: Locale) {
  current = l;
}
export function useT(): Dict {
  return dicts[current];
}
export type { Dict };
