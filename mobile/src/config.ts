import { storage } from '@/storage';

/**
 * Only public configuration lives in the app. Every secret (weather, market, speech, AI
 * keys) stays on the backend — the app talks to AgriSmart's API and nothing else.
 */
// A web build served by the API itself talks to the same address it was loaded from.
const sameOrigin = typeof window !== 'undefined' && window.location?.origin?.startsWith('http') && !window.location.port.match(/^(8081|19006)$/)
  ? window.location.origin
  : undefined;
const builtIn = (process.env.EXPO_PUBLIC_API_URL ?? sameOrigin ?? 'http://localhost:8000').replace(/\/$/, '');
const SERVER_KEY = 'agrismart.server';

export const config = {
  /** Built in at build time, or the address the user typed under "Server" on the sign-in screen. */
  apiUrl: builtIn,
  apiPrefix: '/api/v1',
  requestTimeoutMs: 30_000,
  maxRecordingSeconds: 30,
};

export const builtInApiUrl = builtIn;

/** Applies a server address saved earlier. Call once at start-up, before any request. */
export async function loadServerAddress(): Promise<void> {
  try {
    const saved = await storage.get(SERVER_KEY);
    if (saved) config.apiUrl = saved;
  } catch {
    // storage unavailable: keep the built-in address
  }
}

/** Saves a server address; an empty value goes back to the built-in one. */
export async function saveServerAddress(value: string): Promise<string> {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    await storage.remove(SERVER_KEY);
    config.apiUrl = builtIn;
    return builtIn;
  }
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  await storage.set(SERVER_KEY, url);
  config.apiUrl = url;
  return url;
}
