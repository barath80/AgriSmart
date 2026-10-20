/**
 * Web build: browsers have no keystore, so values live in localStorage. Access can throw
 * (private windows, blocked site data) — then the app still works, it just forgets on reload.
 */
function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

export const storage = {
  get: async (key: string) => attempt(() => globalThis.localStorage.getItem(key), null),
  set: async (key: string, value: string) => attempt(() => globalThis.localStorage.setItem(key, value), undefined),
  remove: async (key: string) => attempt(() => globalThis.localStorage.removeItem(key), undefined),
};
