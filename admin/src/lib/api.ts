import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE, API_PREFIX, API_URL } from "./session";

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

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(method: string, path: string, init: { query?: Query; body?: unknown } = {}): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  const url = new URL(`${API_URL}${API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const isForm = init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store", // admin data must always be live
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      },
      body: isForm ? (init.body as FormData) : init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("network", "The AgriSmart API is unreachable", 0);
  }

  if (response.status === 401) redirect("/login");
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(error.code ?? "error", error.message ?? response.statusText, response.status, error.details);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, query?: Query) => request<T>("PATCH", path, { query }),
};

/** Human-readable message for a failed admin action. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const fields = (error.details.fields as { field: string; issue: string }[] | undefined) ?? [];
    return fields.length ? `${error.message}: ${fields.map((f) => `${f.field} — ${f.issue}`).join("; ")}` : error.message;
  }
  return "Unexpected error";
}
