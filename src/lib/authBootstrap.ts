import { AUTH_STORAGE_KEY } from "@/lib/studentAuthSession";
import { clearAdminSessionExpiry } from "@/lib/adminAuthSession";

/** Public sign-in surfaces — skip stale refresh + auto-refresh to avoid 60s hangs. */
export function isLoginSurfacePath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return /\/(login|register|forgot-password|reset-password)(\/|$)/i.test(path);
}

/** Drop orphaned refresh tokens before GoTrue initializes on login pages. */
export function clearPersistedAuthOnLoginSurface(): void {
  if (!isLoginSurfacePath()) return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    clearAdminSessionExpiry();
    window.localStorage.removeItem("ezyintern_student_session_until");
    window.localStorage.removeItem("ezyintern_student_remember_login");
  } catch {
    /* ignore */
  }
}
