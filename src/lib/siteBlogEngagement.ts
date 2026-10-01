import type { SupabaseClient } from "@supabase/supabase-js";
import { apiUrl } from "@/lib/siteApi";
import { supabase } from "@/integrations/supabase/client";

const LEAD_DONE_PREFIX = "apna_blog_lead_v1:";
const BLOG_DEVICE_UNLOCK_KEY = "apna_blog_reader_unlock_v1";
const BLOG_DEVICE_PROFILE_KEY = "apna_blog_reader_profile_v1";
const BLOG_DEVICE_ID_KEY = "apna_blog_device_id_v1";
const VIEW_SESSION_PREFIX = "apna_blog_view_v1:";

export type BlogDeviceReaderProfile = {
  device_id: string;
  device_label: string;
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  device_info: Record<string, string | number | boolean>;
  submitted_at: string;
};

function hasLegacyPerPostLeadFlag(): boolean {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(LEAD_DONE_PREFIX) && window.localStorage.getItem(key) === "1") {
      return true;
    }
  }
  return false;
}

/** One-time unlock per browser/device — any blog post after first submit. */
export function isBlogReaderUnlockedOnDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(BLOG_DEVICE_UNLOCK_KEY) === "1") return true;
  return hasLegacyPerPostLeadFlag();
}

export function getOrCreateBlogDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(BLOG_DEVICE_ID_KEY)?.trim();
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(BLOG_DEVICE_ID_KEY, id);
  }
  return id;
}

export function getBlogDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return navigator.platform?.trim() || "Browser";
}

export function collectBlogDeviceInfo(): Record<string, string | number | boolean> {
  if (typeof window === "undefined") return {};
  const nav = navigator;
  const info: Record<string, string | number | boolean> = {
    device_label: getBlogDeviceLabel(),
    user_agent: (nav.userAgent || "").slice(0, 400),
    platform: nav.platform || "",
    language: nav.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    touch: (nav.maxTouchPoints ?? 0) > 0,
  };
  if (typeof nav.hardwareConcurrency === "number") {
    info.hardware_concurrency = nav.hardwareConcurrency;
  }
  const mem = (nav as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number") info.device_memory_gb = mem;
  return info;
}

export function getBlogDeviceReaderProfile(): BlogDeviceReaderProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BLOG_DEVICE_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BlogDeviceReaderProfile;
  } catch {
    return null;
  }
}

export function saveBlogDeviceReaderUnlock(input: {
  postId: string;
  fullName: string;
  email: string;
  phone: string;
  collegeName: string;
}): BlogDeviceReaderProfile {
  const device_id = getOrCreateBlogDeviceId();
  const device_label = getBlogDeviceLabel();
  const device_info = collectBlogDeviceInfo();
  const profile: BlogDeviceReaderProfile = {
    device_id,
    device_label,
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.replace(/\D/g, "").slice(-10),
    college_name: input.collegeName.trim(),
    device_info,
    submitted_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BLOG_DEVICE_UNLOCK_KEY, "1");
    window.localStorage.setItem(BLOG_DEVICE_PROFILE_KEY, JSON.stringify(profile));
    window.localStorage.setItem(`${LEAD_DONE_PREFIX}${input.postId}`, "1");
  }
  return profile;
}

type BlogInteractionAction =
  | "increment_view"
  | "get_view"
  | "submit_lead"
  | "lookup_phone"
  | "check_device";

const SEND_MAIL_BLOG_ACTION: Record<BlogInteractionAction, string> = {
  increment_view: "blog_increment_view",
  get_view: "blog_get_view",
  submit_lead: "blog_submit_lead",
  lookup_phone: "blog_lookup_phone",
  check_device: "blog_check_device",
};

async function postBlogViaSendMail(
  action: BlogInteractionAction,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { action: _ignored, ...rest } = body;
  const res = await fetch(apiUrl("/api/send-mail"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, action: SEND_MAIL_BLOG_ACTION[action] }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok === false || json.success === false) {
    throw new Error(String(json.message || json.error || `HTTP ${res.status}`));
  }
  return json;
}

async function postBlogInteraction(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const action = String(body.action || "").trim() as BlogInteractionAction;
  return postBlogViaSendMail(action, body);
}

async function rpcFallback(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

/** @deprecated Use isBlogReaderUnlockedOnDevice — kept for older call sites. */
export function blogLeadAlreadySubmitted(_postId?: string): boolean {
  return isBlogReaderUnlockedOnDevice();
}

export function markBlogLeadSubmitted(postId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLOG_DEVICE_UNLOCK_KEY, "1");
  window.localStorage.setItem(`${LEAD_DONE_PREFIX}${postId}`, "1");
}

/** Restore device-wide unlock from RDS when localStorage was cleared on this browser. */
export async function hydrateBlogReaderUnlockFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isBlogReaderUnlockedOnDevice()) return true;
  const deviceId = getOrCreateBlogDeviceId();
  if (!deviceId) return false;
  try {
    const json = await postBlogViaSendMail("check_device", { device_id: deviceId });
    if (json.unlocked === true) {
      window.localStorage.setItem(BLOG_DEVICE_UNLOCK_KEY, "1");
      return true;
    }
  } catch {
    /* offline or API unavailable */
  }
  return false;
}

export function blogViewRecordedThisSession(postId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${VIEW_SESSION_PREFIX}${postId}`) === "1";
}

export function markBlogViewRecorded(postId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${VIEW_SESSION_PREFIX}${postId}`, "1");
}

export async function incrementBlogPostView(postId: string): Promise<number> {
  try {
    const json = await postBlogInteraction({ action: "increment_view", post_id: postId });
    return Number(json.view_count ?? 0);
  } catch {
    try {
      const count = await rpcFallback("public_increment_blog_post_view", { p_post_id: postId });
      return Number(count ?? 0);
    } catch {
      return 0;
    }
  }
}

export async function fetchBlogPostViewCount(postId: string): Promise<number> {
  try {
    const json = await postBlogInteraction({ action: "get_view", post_id: postId });
    return Number(json.view_count ?? 0);
  } catch {
    return 0;
  }
}

export async function submitBlogReaderLead(input: {
  postId: string;
  fullName: string;
  email: string;
  phone: string;
  collegeName: string;
  deviceId?: string;
  deviceInfo?: Record<string, string | number | boolean>;
}): Promise<void> {
  const payload = {
    action: "submit_lead" as BlogInteractionAction,
    post_id: input.postId,
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    college_name: input.collegeName.trim(),
    device_id: input.deviceId || getOrCreateBlogDeviceId(),
    device_info: input.deviceInfo || collectBlogDeviceInfo(),
  };
  try {
    await postBlogInteraction(payload);
    return;
  } catch {
    await rpcFallback("public_submit_site_blog_lead", {
      p_post_id: input.postId,
      p_full_name: payload.full_name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_college_name: payload.college_name || null,
    });
  }
}

export type BlogLeadAutofillProfile = {
  full_name: string;
  email: string;
  college_name: string;
  phone?: string;
};

/** Merge autofill sources — later keys only fill empty fields. */
export function mergeBlogLeadAutofill(
  current: BlogLeadAutofillProfile,
  patch: Partial<BlogLeadAutofillProfile>
): BlogLeadAutofillProfile {
  const phoneDigits = (patch.phone || current.phone || "").replace(/\D/g, "").slice(-10);
  return {
    full_name: current.full_name.trim() || String(patch.full_name || "").trim(),
    email: current.email.trim() || String(patch.email || "").trim(),
    college_name: current.college_name.trim() || String(patch.college_name || "").trim(),
    phone: phoneDigits || current.phone || "",
  };
}

export async function lookupBlogLeadAutofillByPhone(phone: string): Promise<BlogLeadAutofillProfile> {
  const empty = { full_name: "", email: "", college_name: "" };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return empty;
  try {
    const json = await postBlogInteraction({ action: "lookup_phone", phone: digits });
    const profile = (json.profile || {}) as Record<string, unknown>;
    return {
      full_name: String(profile.full_name || "").trim(),
      email: String(profile.email || "").trim(),
      college_name: String(profile.college_name || "").trim(),
    };
  } catch {
    try {
      const raw = await rpcFallback("public_lookup_blog_lead_autofill", { p_phone: digits });
      const profile = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        full_name: String(profile.full_name || "").trim(),
        email: String(profile.email || "").trim(),
        college_name: String(profile.college_name || "").trim(),
      };
    } catch {
      return empty;
    }
  }
}

/** Prefill from logged-in student profile when available. */
export async function loadStudentBlogAutofill(client: SupabaseClient): Promise<BlogLeadAutofillProfile> {
  const empty = { full_name: "", email: "", college_name: "" };
  try {
    const { data: sessionData } = await client.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return empty;
    const { data, error } = await client
      .from("students")
      .select("full_name, email, contact_number, college_name")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return empty;
    const phone = String(data.contact_number || "")
      .replace(/\D/g, "")
      .slice(-10);
    return {
      full_name: String(data.full_name || "").trim(),
      email: String(data.email || sessionData.session?.user?.email || "").trim(),
      college_name: String(data.college_name || "").trim(),
      phone: phone.length >= 10 ? phone : "",
    };
  } catch {
    return empty;
  }
}
