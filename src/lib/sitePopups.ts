/** Admin-managed site popups: page targeting and schedule helpers. */

export const POPUP_TYPES = ["text", "image"] as const;
export type SitePopupType = (typeof POPUP_TYPES)[number];

export const POPUP_PAGE_OPTIONS = [
  { key: "all", label: "All Pages" },
  { key: "home", label: "Home Page" },
  { key: "about", label: "About Page" },
  { key: "benefits", label: "Benefits Page" },
  { key: "courses", label: "Courses Page" },
  { key: "universities", label: "Universities" },
  { key: "blog", label: "Blog" },
  { key: "gallery", label: "Gallery" },
  { key: "team", label: "Team" },
  { key: "mous", label: "MOUs" },
  { key: "verify", label: "Verify Certificate" },
  { key: "contact", label: "Contact Page" },
  { key: "login", label: "Login Page" },
  { key: "admin_login", label: "Admin Login" },
  { key: "registration", label: "Registration Page" },
  { key: "dashboard", label: "Student Dashboard" },
  { key: "terms", label: "Terms Page" },
  { key: "privacy", label: "Privacy Page" },
  { key: "cybercafe", label: "Cyber Cafe Page" },
] as const;

export type PopupPageKey = (typeof POPUP_PAGE_OPTIONS)[number]["key"];

export const POPUP_PAGE_KEYS = POPUP_PAGE_OPTIONS.map((p) => p.key) as PopupPageKey[];

export type SitePopup = {
  id: string;
  title: string;
  popup_type: SitePopupType;
  message?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  pages: string[];
  start_at?: string | null;
  end_at?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

const HASH_PAGE: Record<string, PopupPageKey> = {
  about: "about",
  universities: "universities",
  gallery: "gallery",
  "expert-team": "team",
  team: "team",
  mous: "mous",
};

/** Working admin/staff UIs — never interrupt even when “All Pages” is selected. */
export function isPopupSuppressedPath(pathname: string): boolean {
  if (pathname === "/admin/login") return false;
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/super-admin" ||
    pathname.startsWith("/super-admin/") ||
    pathname === "/staff-dashboard" ||
    pathname.startsWith("/staff-dashboard/") ||
    pathname === "/college/dashboard" ||
    pathname.startsWith("/college/dashboard/") ||
    pathname === "/referral/dashboard" ||
    pathname.startsWith("/referral/dashboard/") ||
    pathname === "/cybercafe/dashboard" ||
    pathname.startsWith("/cybercafe/dashboard/")
  );
}

/** Keys for the current URL (never includes `all`). */
export function resolvePopupPageKeys(pathname: string, hash = ""): PopupPageKey[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  const hashKey = hash.replace(/^#/, "").split("?")[0].trim().toLowerCase();
  const keys = new Set<PopupPageKey>();

  if (path === "/") {
    if (hashKey && HASH_PAGE[hashKey]) keys.add(HASH_PAGE[hashKey]);
    else keys.add("home");
  }
  if (path === "/benefits") keys.add("benefits");
  if (path === "/courses" || path.startsWith("/courses/")) keys.add("courses");
  if (path === "/verify") keys.add("verify");
  if (path === "/contact") keys.add("contact");
  if (path === "/blog" || path.startsWith("/blog/")) keys.add("blog");
  if (path === "/login" || path === "/college/login" || path === "/referral/login" || path === "/cybercafe/login") {
    keys.add("login");
  }
  if (path === "/admin/login") keys.add("admin_login");
  if (path === "/register") keys.add("registration");
  if (path === "/dashboard") keys.add("dashboard");
  if (path === "/terms") keys.add("terms");
  if (path === "/privacy") keys.add("privacy");
  if (path === "/cybercafe") keys.add("cybercafe");

  return [...keys];
}

export function normalizePopupPages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return ["all"];
    if (s.startsWith("{") && s.endsWith("}")) {
      return s
        .slice(1, -1)
        .split(",")
        .map((p) => p.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      /* ignore */
    }
    return s.split(",").map((p) => p.trim()).filter(Boolean);
  }
  return ["all"];
}

export function popupTargetsPage(pages: string[], currentKeys: PopupPageKey[]): boolean {
  const set = new Set(pages.map((p) => p.trim().toLowerCase()).filter(Boolean));
  if (set.size === 0 || set.has("all")) return true;
  return currentKeys.some((k) => set.has(k));
}

export function isPopupInSchedule(
  popup: Pick<SitePopup, "start_at" | "end_at">,
  now = new Date()
): boolean {
  if (popup.start_at) {
    const start = new Date(popup.start_at);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (popup.end_at) {
    const end = new Date(popup.end_at);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

export function isPopupLiveForLocation(
  popup: Pick<SitePopup, "is_active" | "pages" | "start_at" | "end_at">,
  pathname: string,
  hash = "",
  now = new Date()
): boolean {
  if (!popup.is_active) return false;
  if (isPopupSuppressedPath(pathname)) return false;
  if (!isPopupInSchedule(popup, now)) return false;
  const pages = normalizePopupPages(popup.pages);
  return popupTargetsPage(pages, resolvePopupPageKeys(pathname, hash));
}

export function datetimeLocalFromIso(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoFromDatetimeLocal(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
