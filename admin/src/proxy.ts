import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  API_PREFIX,
  API_URL,
  cookieOptions,
  REFRESH_COOKIE,
  type TokenPair,
  tokenExpiresAt,
} from "@/lib/session";

const REFRESH_MARGIN_MS = 60_000;

/**
 * Optimistic session check before every dashboard page:
 * - no session → /login
 * - access token about to expire → rotate it with the refresh token, so server
 *   components always render with a valid token.
 * Real authorization is enforced by the backend on every API call.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const loginUrl = new URL("/login", request.url);

  if (!refresh) return NextResponse.redirect(loginUrl);
  if (access && tokenExpiresAt(access) - Date.now() > REFRESH_MARGIN_MS) return NextResponse.next();

  const response = await fetch(`${API_URL}${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.delete(ACCESS_COOKIE);
    redirect.cookies.delete(REFRESH_COOKIE);
    return redirect;
  }

  const tokens = (await response.json()) as TokenPair;
  // Make the fresh token visible to this same request's server components…
  request.cookies.set(ACCESS_COOKIE, tokens.access_token);
  const next = NextResponse.next({ request });
  // …and store both for the browser.
  next.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...cookieOptions, maxAge: tokens.expires_in });
  next.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 3600 });
  return next;
}

export const config = {
  // Everything except the login page, Next internals and static files.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
