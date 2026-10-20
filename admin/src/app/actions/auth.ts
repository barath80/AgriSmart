"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/types";
import { ACCESS_COOKIE, API_PREFIX, API_URL, cookieOptions, REFRESH_COOKIE, type TokenPair } from "@/lib/session";

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 8) return { ok: false, message: "Enter your e-mail and password." };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${API_PREFIX}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "The AgriSmart API is unreachable." };
  }
  if (response.status === 429) return { ok: false, message: "Too many attempts. Wait a minute and try again." };
  if (response.status >= 500) return { ok: false, message: `The AgriSmart API is not available right now (HTTP ${response.status}). Your password was not checked.` };
  if (!response.ok) return { ok: false, message: "Incorrect e-mail or password." };

  const tokens = (await response.json()) as TokenPair;
  if (tokens.role !== "admin") return { ok: false, message: "This account is not an administrator." };
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, { ...cookieOptions, maxAge: tokens.expires_in });
  jar.set(REFRESH_COOKIE, tokens.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 3600 });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // Revoke server-side; sign out locally regardless.
    await fetch(`${API_URL}${API_PREFIX}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/login");
}
