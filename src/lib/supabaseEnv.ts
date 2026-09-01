/**
 * Resolves Supabase URL + anon key for the browser bundle.
 */

const DEFAULT_PROJECT_ID = "unqfphgjilxpbzajcdjl";

/** Staging Lambda — auth, rest, storage, /api (hard fallback when env vars missing). */
export const STAGING_LAMBDA_API =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

const EXECUTE_API_RE = /execute-api\.[a-z0-9-]+\.amazonaws\.com/i;

/** Public anon JWT for project unqfphgjilxpbzajcdjl (RLS enforced server-side). */
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucWZwaGdqaWx4cGJ6YWpjZGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzYxMjUsImV4cCI6MjA5Mjk1MjEyNX0.lgQXDkliN603WXSENd_odb6ndg6urW8UaaKP7wf1fTU";

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
 * On deployed hosts, always use same-origin (/auth, /rest → Cloudflare/Vercel proxy).
 * Direct execute-api calls fail CORS from *.workers.dev and other staging domains.
 */
export function resolveBrowserApiOrigin(configuredUrl: string): string {
  if (typeof window !== "undefined" && !isLocalBrowserHost()) {
    return window.location.origin;
  }
  return configuredUrl.replace(/\/$/, "");
}

export function resolveSupabaseUrl(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (fromEnv) return resolveBrowserApiOrigin(fromEnv);

  if (import.meta.env.PROD) {
    if (typeof window !== "undefined" && !isLocalBrowserHost()) {
      return window.location.origin;
    }
    return STAGING_LAMBDA_API;
  }

  const projectId = resolveSupabaseProjectId();
  if (projectId === "ezyintern-local") {
    return "";
  }

  return `https://${projectId}.supabase.co`;
}

export function resolveSupabaseAnonKey(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (fromEnv) return fromEnv;

  const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (
    configuredUrl.includes("local-anon-key") ||
    EXECUTE_API_RE.test(configuredUrl) ||
    import.meta.env.PROD
  ) {
    return "local-anon-key";
  }

  const projectId = resolveSupabaseProjectId();
  if (projectId === "ezyintern-local") {
    return "local-anon-key";
  }

  return DEFAULT_SUPABASE_ANON_KEY;
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
