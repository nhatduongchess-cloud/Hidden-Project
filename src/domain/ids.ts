let counter = 0;
/** Locally unique id. Station-generated ids are what make sync idempotent. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${rand}`;
}
