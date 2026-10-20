/**
 * Admin session = two httpOnly cookies holding the backend's JWT pair.
 * Tokens never reach browser JavaScript; the dashboard is a backend-for-frontend.
 */
export const ACCESS_COOKIE = "agrismart_access";
export const REFRESH_COOKIE = "agrismart_refresh";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const API_URL = (process.env.AGRISMART_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_PREFIX = "/api/v1";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  role: string;
}

/** Reads a JWT's expiry without verifying it — only to decide when to refresh. */
export function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}
