import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/auth/tokens';
import { config } from '@/config';

import type { TokenPair } from './types';

/** Every failure carries a stable `code`; screens translate it with `t(`errors.${code}`)`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Body;
  query?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string>;
  auth?: boolean;
  timeoutMs?: number; // default config.requestTimeoutMs
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh request. */
async function refreshSession(): Promise<boolean> {
  const token = getRefreshToken();
  if (!token) return false;
  refreshing ??= (async () => {
    try {
      const tokens = await send<TokenPair>('/auth/refresh', { method: 'POST', body: { refresh_token: token }, auth: false });
      await saveTokens(tokens);
      return true;
    } catch {
      await clearTokens();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const url = new URL(`${config.apiUrl}${config.apiPrefix}${path}`);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  const isForm = options.body instanceof FormData;
  if (options.body && !isForm) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? config.requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    // fetch rejects for offline, timeouts and also for requests it cannot build (an
    // unsupported upload body); log the real cause so the last kind is never hidden.
    if (__DEV__) console.warn(`[api] ${options.method ?? 'GET'} ${path} failed before a response:`, error);
    if (controller.signal.aborted) throw new ApiError('timeout', 'The server took too long', 0);
    throw new ApiError('network', 'Network unavailable', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    // A host that is paused, restarting or crashed answers 5xx with a web page, not our JSON.
    const fallback = response.status >= 500 && !payload?.error ? 'server_down' : 'generic';
    throw new ApiError(error.code ?? fallback, error.message ?? response.statusText, response.status, error.details);
  }
  return payload as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (error) {
    const expired = error instanceof ApiError && error.status === 401 && options.auth !== false;
    if (expired && (await refreshSession())) return send<T>(path, options);
    throw error;
  }
}
