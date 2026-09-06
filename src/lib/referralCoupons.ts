import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERRAL_CLICK_SESSION_KEY } from "@/lib/referral";

export const COUPON_SESSION_KEY = "registration_coupon_code";

export type ReferralCouponRow = {
  id: string;
  referral_partner_id: string;
  coupon_code: string;
  university_name: string | null;
  college_name: string | null;
  internship_domain: string | null;
  max_students: number | null;
  allowed_student_emails: string[] | null;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
  application_id: string | null;
  click_count: number;
  redemption_count: number;
  coupon_amount: number | null;
  created_at: string;
  updated_at: string;
};

const COUPON_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCodeFromName(fullName: string, uniqueSuffix = ""): string {
  const parts = fullName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  let base =
    parts.length >= 2
      ? `${parts[0]}${parts[parts.length - 1]}`
      : parts[0] || "PARTNER";
  base = base.replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (!base) base = "PARTNER";
  const tail = uniqueSuffix.replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return tail ? `CPN-${base}-${tail}` : `CPN-${base}`;
}

export function generateCouponCode(): string {
  let s = "CPN-";
  for (let i = 0; i < 8; i++) {
    s += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)];
  }
  return s;
}

function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\n,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function isMissingTable(error: unknown): boolean {
  const msg =
    error && typeof error === "object"
      ? String((error as { message?: string }).message || "")
      : String(error ?? "");
  return /42P01|referral_coupons|schema cache|does not exist/i.test(msg);
}

export async function createReferralCouponFromPayload(
  client: SupabaseClient,
  opts: {
    referralPartnerId: string;
    applicationId?: string | null;
    payload: Record<string, unknown>;
    couponCode?: string;
  }
): Promise<ReferralCouponRow> {
  const code = (opts.couponCode || generateCouponCode()).trim().toUpperCase();
  const amountRaw = opts.payload.coupon_amount;
  const couponAmount =
    amountRaw != null && String(amountRaw).trim() !== "" && !Number.isNaN(Number(amountRaw))
      ? Number(amountRaw)
      : null;
  const row = {
    referral_partner_id: opts.referralPartnerId,
    coupon_code: code,
    university_name: String(opts.payload.university_name || opts.payload.universities?.[0] || "").trim() || null,
    college_name: String(opts.payload.college_name || opts.payload.colleges?.[0] || "").trim() || null,
    internship_domain: String(opts.payload.internship_domain || opts.payload.domain || "").trim() || null,
    max_students:
      opts.payload.max_students != null ? Number(opts.payload.max_students) : null,
    allowed_student_emails: parseEmailList(
      opts.payload.allowed_student_emails ?? opts.payload.student_emails
    ),
    valid_from: opts.payload.valid_from ? String(opts.payload.valid_from) : null,
    valid_to: opts.payload.valid_to ? String(opts.payload.valid_to) : null,
    coupon_amount: couponAmount,
    active: true,
    application_id: opts.applicationId || null,
  };

  const { data, error } = await client.from("referral_coupons").insert(row).select("*").single();
  if (error) throw error;
  return data as ReferralCouponRow;
}

export async function fetchCouponsForPartner(
  client: SupabaseClient,
  partnerId: string
): Promise<ReferralCouponRow[]> {
  const { data, error } = await client
    .from("referral_coupons")
    .select("*")
    .eq("referral_partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data || []) as ReferralCouponRow[];
}

export async function updateReferralCoupon(
  client: SupabaseClient,
  couponId: string,
  patch: Partial<{
    coupon_code: string;
    university_name: string | null;
    college_name: string | null;
    internship_domain: string | null;
    max_students: number | null;
    valid_from: string | null;
    valid_to: string | null;
    coupon_amount: number | null;
    active: boolean;
  }>
): Promise<void> {
  const { error } = await client
    .from("referral_coupons")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", couponId);
  if (error) throw error;
}

export async function logReferralCouponClick(
  client: SupabaseClient,
  couponId: string,
  referralCode?: string | null
): Promise<void> {
  const sessionId =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("referral_click_session_id") ||
        (() => {
          const id = crypto.randomUUID();
          sessionStorage.setItem("referral_click_session_id", id);
          return id;
        })()
      : null;

  try {
    await client.from("referral_coupon_clicks").insert({
      coupon_id: couponId,
      referral_code: referralCode || null,
      session_id: sessionId,
    });
    await client
      .from("referral_coupons")
      .update({ click_count: undefined as unknown as number })
      .eq("id", couponId);
  } catch {
    /* optional tracking */
  }

  try {
    const { data } = await client.from("referral_coupons").select("click_count").eq("id", couponId).maybeSingle();
    const next = Number((data as { click_count?: number })?.click_count || 0) + 1;
    await client.from("referral_coupons").update({ click_count: next, updated_at: new Date().toISOString() }).eq("id", couponId);
  } catch {
    /* ignore */
  }
}

export function buildRegisterUrlWithCoupon(couponCode: string, referralCode?: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://apnaintern.in";
  const params = new URLSearchParams();
  if (referralCode) params.set("ref", referralCode);
  params.set("coupon", couponCode.trim().toUpperCase());
  return `${origin.replace(/\/$/, "")}/register?${params.toString()}`;
}

/** First-touch coupon code from ?coupon= (Register page). */
export function captureCouponFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const code = new URLSearchParams(window.location.search).get("coupon")?.trim();
    if (!code) return;
    const normalized = code.slice(0, 64).toUpperCase();
    if (!sessionStorage.getItem(COUPON_SESSION_KEY)) {
      sessionStorage.setItem(COUPON_SESSION_KEY, normalized);
    }
  } catch {
    /* sessionStorage blocked */
  }
}

export function peekStoredCouponCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(COUPON_SESSION_KEY)?.trim();
    return v && v.length > 0 ? v.slice(0, 64).toUpperCase() : null;
  } catch {
    return null;
  }
}

function couponClickSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(REFERRAL_CLICK_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(REFERRAL_CLICK_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Log coupon link click from ?coupon= on register page (fire-and-forget). */
export function logCouponClickFromUrl(client: SupabaseClient): void {
  if (typeof window === "undefined") return;
  try {
    const code = new URLSearchParams(window.location.search).get("coupon")?.trim();
    if (!code) return;
    const ref = new URLSearchParams(window.location.search).get("ref")?.trim() || null;
    void (async () => {
      const { data } = await client
        .from("referral_coupons")
        .select("id")
        .eq("coupon_code", code.toUpperCase())
        .eq("active", true)
        .maybeSingle();
      if (!data?.id) return;
      await logReferralCouponClick(client, String(data.id), ref);
    })();
  } catch {
    /* non-fatal */
  }
}

function couponScopeMatches(
  row: ReferralCouponRow,
  opts: { email: string; universityName?: string; collegeName?: string; domain?: string }
): boolean {
  const now = Date.now();
  if (row.valid_from && new Date(row.valid_from).getTime() > now) return false;
  if (row.valid_to && new Date(row.valid_to).getTime() < now) return false;
  if (row.university_name && opts.universityName) {
    if (!opts.universityName.toLowerCase().includes(row.university_name.toLowerCase()) &&
        !row.university_name.toLowerCase().includes(opts.universityName.toLowerCase())) {
      return false;
    }
  }
  if (row.college_name && opts.collegeName) {
    if (!opts.collegeName.toLowerCase().includes(row.college_name.toLowerCase()) &&
        !row.college_name.toLowerCase().includes(opts.collegeName.toLowerCase())) {
      return false;
    }
  }
  if (row.internship_domain && opts.domain) {
    if (row.internship_domain.toLowerCase() !== opts.domain.toLowerCase()) return false;
  }
  const allowed = row.allowed_student_emails || [];
  if (allowed.length > 0) {
    const email = opts.email.trim().toLowerCase();
    if (!allowed.some((e) => String(e).trim().toLowerCase() === email)) return false;
  }
  if (row.max_students != null && row.redemption_count >= row.max_students) return false;
  return true;
}

/** After successful student registration — increment coupon redemption if applicable. */
export async function recordCouponRedemptionIfAny(
  client: SupabaseClient,
  opts: { email: string; universityName?: string; collegeName?: string; domain?: string }
): Promise<void> {
  const code = peekStoredCouponCode();
  if (!code) return;
  try {
    const { data } = await client
      .from("referral_coupons")
      .select("*")
      .eq("coupon_code", code)
      .eq("active", true)
      .maybeSingle();
    if (!data) return;
    const row = data as ReferralCouponRow;
    if (!couponScopeMatches(row, opts)) return;
    const next = Number(row.redemption_count || 0) + 1;
    await client
      .from("referral_coupons")
      .update({ redemption_count: next, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  } catch {
    /* optional tracking */
  }
}
