import type { TokenPair } from '@/api/types';
import { storage } from '@/storage';

/**
 * Tokens live in the device keystore (localStorage on web), cached in memory for speed.
 * The farmer never sees a password: the refresh token keeps them signed in for 30 days.
 */
const ACCESS_KEY = 'agrismart.access';
const REFRESH_KEY = 'agrismart.refresh';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let loaded = false;
const listeners = new Set<(signedIn: boolean) => void>();

export async function loadTokens(): Promise<boolean> {
  if (!loaded) {
    [accessToken, refreshToken] = await Promise.all([
      storage.get(ACCESS_KEY),
      storage.get(REFRESH_KEY),
    ]);
    loaded = true;
  }
  return refreshToken !== null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  await Promise.all([
    storage.set(ACCESS_KEY, tokens.access_token),
    storage.set(REFRESH_KEY, tokens.refresh_token),
  ]);
  listeners.forEach((listener) => listener(true));
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
  listeners.forEach((listener) => listener(false));
}

/** Notified when the session starts or ends (including forced sign-out on expiry). */
export function onSessionChange(listener: (signedIn: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
