/**
 * Resolves Supabase URL + anon key for the browser bundle.
 * Vite inlines VITE_* at build time; on Vercel these must be set in project env
 * OR we fall back to the committed project id / public anon key.
 */

const DEFAULT_PROJECT_ID = "unqfphgjilxpbzajcdjl";

const EXECUTE_API_RE = /execute-api\.[a-z0-9-]+\.amazonaws\.com/i;

/** Public anon JWT for project unqfphgjilxpbzajcdjl (RLS enforced server-side). */
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucWZwaGdqaWx4cGJ6YWpjZGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzYxMjUsImV4cCI6MjA5Mjk1MjEyNX0.lgQXDkliN603WXSENd_odb6ndg6urW8UaaKP7wf1fTU";

export function resolveSupabaseProjectId(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_PROJECT_ID || "").trim();
  return fromEnv || DEFAULT_PROJECT_ID;
}

/**
 * When VITE_SUPABASE_URL points at API Gateway (execute-api), the browser should
 * call same-origin /auth + /rest (Vercel rewrites → Lambda) to avoid CORS failures.
 */
export function resolveBrowserApiOrigin(configuredUrl: string): string {
  const url = configuredUrl.replace(/\/$/, "");
  if (typeof window !== "undefined" && EXECUTE_API_RE.test(url)) {
    return window.location.origin.replace(/\/$/, "");
  }
  return url;
}

export function resolveSupabaseUrl(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (fromEnv) return resolveBrowserApiOrigin(fromEnv);

  const projectId = resolveSupabaseProjectId();
  if (projectId === "ezyintern-local") {
    return "";
  }

  return `https://${projectId}.supabase.co`;
}

export function resolveSupabaseAnonKey(): string {
  const fromEnv = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (fromEnv) return fromEnv;

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
        "Set VITE_SUPABASE_URL in .env.local (dev) or Vercel Environment Variables (production), " +
        "or run npm run dev:frontend:awsrds for local AWS shim."
    );
  }
}
