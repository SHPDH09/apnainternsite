/**
 * Resolves Supabase URL + anon key for the browser bundle.
 */

/** Production Supabase project (Hyderabad migration target). */
const DEFAULT_PROJECT_ID = "hflapipozwwwinbbfpuh";

export const SUPABASE_PROJECT_URL = `https://${DEFAULT_PROJECT_ID}.supabase.co`;

const EXECUTE_API_RE = /execute-api\.[a-z0-9-]+\.amazonaws\.com/i;

/** Owner admin emails — emergency portal access if role fetch fails transiently. */
export const OWNER_ADMIN_EMAILS = new Set(["apnaintern.in@gmail.com"]);

export function resolveSupabaseProjectId(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_PROJECT_ID || "").trim();
  return fromEnv || DEFAULT_PROJECT_ID;
}

function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

/**
 * Same-origin API base in the browser.
 * Cloudflare *.workers.dev: prefix /staging so the edge proxy hits API Gateway stage.
 * Vercel/custom domains: plain origin (platform rewrites /auth → Lambda /staging/auth).
 */
export function resolveDeployedApiBase(): string {
  if (typeof window === "undefined" || isLocalBrowserHost()) {
    return "";
  }
  const origin = window.location.origin.replace(/\/$/, "");
  if (window.location.hostname.endsWith(".workers.dev")) {
    return `${origin}/staging`;
  }
  return origin;
}

/** Never call execute-api directly from the browser on deployed hosts (CORS). */
export function resolveBrowserApiOrigin(configuredUrl: string): string {
  const deployed = resolveDeployedApiBase();
  if (deployed) return deployed;
  return configuredUrl.replace(/\/$/, "");
}

export function resolveSupabaseUrl(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (fromEnv) return resolveBrowserApiOrigin(fromEnv);

  const deployed = resolveDeployedApiBase();
  if (deployed) return deployed;

  const projectId = resolveSupabaseProjectId();
  if (projectId === "ezyintern-local") {
    return "";
  }

  return `https://${projectId}.supabase.co`;
}

export function resolveSupabaseAnonKey(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (fromEnv && fromEnv !== "local-anon-key") return fromEnv;

  const projectId = resolveSupabaseProjectId();
  if (projectId === "ezyintern-local") {
    return "local-anon-key";
  }

  const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (
    configuredUrl.includes("localhost") ||
    configuredUrl.includes("127.0.0.1") ||
    EXECUTE_API_RE.test(configuredUrl)
  ) {
    return "local-anon-key";
  }

  return fromEnv;
}

export function assertSupabaseConfig(url: string, context = "Supabase client"): void {
  if (!url) {
    throw new Error(
      `[apnaintern] ${context}: supabaseUrl is required. ` +
        "Set VITE_SUPABASE_URL in .env.local (dev) or build env (production), " +
        "or run npm run dev:frontend:awsrds for local AWS shim."
    );
  }
}

export function isOwnerAdminEmail(email: string | null | undefined): boolean {
  return OWNER_ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}
