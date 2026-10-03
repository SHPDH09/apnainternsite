import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_LOGOUT_INTENT_KEY,
  clearAdminSessionExpiry,
} from "@/lib/adminAuthSession";
import { AUTH_STORAGE_KEY } from "@/lib/studentAuthSession";

const STUDENT_SESSION_UNTIL_KEY = "ezyintern_student_session_until";
const STUDENT_REMEMBER_KEY = "ezyintern_student_remember_login";

function clearPortalSessionMarkers(): void {
  if (typeof window === "undefined") return;
  clearAdminSessionExpiry();
  window.localStorage.removeItem(STUDENT_SESSION_UNTIL_KEY);
  window.localStorage.removeItem(STUDENT_REMEMBER_KEY);
  window.localStorage.removeItem("impersonate_id");
}

/** Clear Supabase auth storage even if signOut() stalls on a slow /auth/v1/logout. */
function forceClearAuthStorage(client: SupabaseClient): void {
  if (typeof window === "undefined") return;
  try {
    const key = (client.auth as unknown as { storageKey?: string }).storageKey || AUTH_STORAGE_KEY;
    window.localStorage.removeItem(key);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/**
 * Reliable sign-out on Vercel (local auth shim). Server logout is best-effort;
 * local session is always cleared so Logout works without waiting on cold bundles.
 */
export async function portalSignOut(
  client: SupabaseClient,
  opts?: { adminPortal?: boolean }
): Promise<void> {
  if (typeof window !== "undefined" && opts?.adminPortal) {
    window.sessionStorage.setItem(ADMIN_LOGOUT_INTENT_KEY, "1");
  }

  clearPortalSessionMarkers();

  try {
    await Promise.race([
      client.auth.signOut(),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* network / 504 — continue with local clear */
  }

  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    forceClearAuthStorage(client);
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ADMIN_LOGOUT_INTENT_KEY);
  }
}
