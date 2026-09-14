/**
 * API base URL for the frontend.
 *
 * Production Cloudflare *.workers.dev uses /staging prefix (see resolveDeployedApiBase).
 * Vercel rewrites /auth and /rest to Lambda — no /staging prefix in the browser URL.
 */
import {
  resolveBrowserApiOrigin,
  resolveDeployedApiBase,
  resolveSupabaseUrl,
} from "@/lib/supabaseEnv";

export function getSiteApiOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = import.meta.env.VITE_SITE_API_ORIGIN as string | undefined;
  if (fromEnv?.trim()) return resolveBrowserApiOrigin(fromEnv.trim());
  const appUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (appUrl?.trim()) return resolveBrowserApiOrigin(appUrl.trim());
  return resolveDeployedApiBase();
}

/** Build full API path — relative on prod, absolute when `VITE_SITE_API_ORIGIN` is set. */
export function siteApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = getSiteApiOrigin();
  return origin ? `${origin}${p}` : p;
}

/** Alias used across the app for fetch() calls. */
export const apiUrl = siteApiUrl;

/** Local Express or AWS Lambda API — Supabase Realtime is unavailable; use polling. */
export function usePollingInsteadOfRealtime(): boolean {
  const resolved = resolveSupabaseUrl();
  return !/\.supabase\.co/i.test(resolved);
}

/** @deprecated use usePollingInsteadOfRealtime */
export const isLocalApiMode = usePollingInsteadOfRealtime;
