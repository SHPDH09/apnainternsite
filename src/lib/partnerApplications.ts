import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCybercafePartner } from "@/lib/registerCybercafePartner";
import { createEphemeralSupabaseAuthClient } from "@/lib/createSubUser";
import {
  REGISTRATION_PASSWORD_MIN_LENGTH,
  signUpStudentWithChosenPassword,
} from "@/lib/registrationPassword";
import { signInStudentWithPassword } from "@/lib/studentAuthLogin";
import {
  readAccessTokenFromClient,
  submitPartnerApplicationViaApi,
} from "@/lib/partnerApplicationSubmitApi";

export type PartnerKind = "cyber_cafe" | "referral" | "coupon";

export type ReferralApplyMode = "referral_only" | "coupon_only" | "both";

export const REFERRAL_APPLY_MODE_OPTIONS: Array<{
  value: ReferralApplyMode;
  label: string;
  description: string;
}> = [
  {
    value: "referral_only",
    label: "Referral link only",
    description: "Share your referral link and track clicks and registrations.",
  },
  {
    value: "coupon_only",
    label: "Coupon only",
    description: "Apply as a coupon partner — configure coupon scope in your dashboard after approval.",
  },
  {
    value: "both",
    label: "Referral + Coupon",
    description: "Referral link plus coupons — set coupon details in your dashboard after approval.",
  },
];

export function referralApplyModeLabel(mode: unknown): string {
  const hit = REFERRAL_APPLY_MODE_OPTIONS.find((o) => o.value === mode);
  return hit?.label ?? "Referral link only";
}

export function shouldCreateCouponOnApproval(
  partnerKind: PartnerKind,
  payload: Record<string, unknown>
): boolean {
  if (partnerKind === "coupon") return true;
  if (partnerKind !== "referral") return false;
  const mode = String(payload.referral_apply_mode || "referral_only") as ReferralApplyMode;
  return mode === "coupon_only" || mode === "both";
}

export type PartnerApplicationRow = {
  id: string;
  auth_user_id: string;
  partner_kind: PartnerKind;
  status: "pending" | "approved" | "rejected";
  full_name: string;
  email: string;
  contact_number: string | null;
  payload: Record<string, unknown>;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerRegistrationInput = {
  partner_kind: PartnerKind;
  full_name: string;
  email: string;
  password: string;
  contact_number: string;
  payload: Record<string, unknown>;
};

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  cyber_cafe: "Cyber Cafe Partner",
  referral: "Referral Partner",
  coupon: "Coupon Partner",
};

function partnerApplicationsTableMissing(error: unknown): boolean {
  const code =
    error && typeof error === "object" ? String((error as { code?: string }).code || "") : "";
  const msg =
    error && typeof error === "object"
      ? [(error as { message?: string }).message, code].filter(Boolean).join(" ")
      : String(error ?? "");
  if (code === "42P01") return true;
  return /relation\s+"?partner_applications"?\s+does not exist|undefined_table|schema cache.*partner_applications.*does not exist/i.test(
    msg
  );
}

function formatPartnerApplicationError(error: unknown): string {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message || "")
      : String(error ?? "");
  if (msg.trim()) return msg.trim();
  return "Partner application could not be saved. Please try again in a moment.";
}

/** Create partner_applications on RDS when missing (RPC + API). Never throws. */
async function tryBootstrapPartnerApplicationsTables(client: SupabaseClient): Promise<void> {
  try {
    await client.rpc("admin_ensure_partner_applications");
  } catch {
    /* RPC may require admin or be unavailable until Lambda is redeployed */
  }

  if (typeof window === "undefined") return;
  try {
    const token = await readAccessTokenFromClient(client);
    if (!token) return;
    const origin = window.location.origin.replace(/\/$/, "");
    await fetch(`${origin}/api/ensure-partner-applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    /* optional bootstrap */
  }
}

async function insertPartnerApplicationRow(
  client: SupabaseClient,
  input: PartnerRegistrationInput,
  userId: string,
  accessToken?: string | null
): Promise<string | undefined> {
  await tryBootstrapPartnerApplicationsTables(client);

  const token = accessToken || (await readAccessTokenFromClient(client));
  if (token) {
    try {
      return await submitPartnerApplicationViaApi(token, {
        partner_kind: input.partner_kind,
        full_name: input.full_name.trim(),
        email: input.email.trim(),
        contact_number: input.contact_number.trim(),
        payload: input.payload,
      });
    } catch (apiErr) {
      const msg = String(apiErr instanceof Error ? apiErr.message : apiErr);
      if (!/404|not found|503|502|504|failed to fetch|network/i.test(msg)) {
        throw apiErr;
      }
    }
  }

  const row = {
    auth_user_id: userId,
    partner_kind: input.partner_kind,
    status: "pending",
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    contact_number: input.contact_number.trim(),
    payload: input.payload,
  };

  const attempt = async () => {
    const { data, error } = await client.from("partner_applications").insert(row).select("id").single();
    if (error) throw error;
    return data?.id as string | undefined;
  };

  try {
    return await attempt();
  } catch (err) {
    if (!partnerApplicationsTableMissing(err)) throw err;
    await tryBootstrapPartnerApplicationsTables(client);
    return await attempt();
  }
}

export async function submitPartnerApplication(
  directoryClient: SupabaseClient,
  input: PartnerRegistrationInput
): Promise<{ userId: string; applicationId?: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const password = input.password.trim();
  if (password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters`);
  }

  if (input.partner_kind === "cyber_cafe") {
    const location = String(input.payload.location || input.payload.address || "").trim();
    const { userId, accessToken } = await registerCybercafePartner(directoryClient, {
      owner_name: input.full_name.trim(),
      email: normalizedEmail,
      password,
      shop_name: String(input.payload.shop_name || "").trim(),
      location,
      phone: input.contact_number.trim(),
    });
    try {
      const applicationId = await insertPartnerApplicationRow(
        directoryClient,
        input,
        userId,
        accessToken
      );
      return { userId, applicationId };
    } catch (err) {
      if (partnerApplicationsTableMissing(err)) return { userId };
      throw new Error(formatPartnerApplicationError(err));
    }
  }

  const authClient = createEphemeralSupabaseAuthClient();
  const { userId } = await signUpStudentWithChosenPassword(authClient, directoryClient, {
    email: normalizedEmail,
    password,
    fullName: input.full_name.trim(),
  });

  const signIn = await signInStudentWithPassword(authClient, normalizedEmail, password);
  if (!signIn.ok) {
    throw new Error("Account created but sign-in failed. Try logging in from the partner login page.");
  }

  try {
    const applicationId = await insertPartnerApplicationRow(
      authClient,
      input,
      userId,
      signIn.session.access_token
    );
    return { userId, applicationId };
  } catch (err) {
    throw new Error(formatPartnerApplicationError(err));
  }
}

export async function fetchPartnerApplicationForUser(
  client: SupabaseClient,
  userId: string
): Promise<PartnerApplicationRow | null> {
  await tryBootstrapPartnerApplicationsTables(client);
  const { data, error } = await client
    .from("partner_applications")
    .select("*")
    .eq("auth_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (partnerApplicationsTableMissing(error)) return null;
    throw error;
  }
  return (data as PartnerApplicationRow) || null;
}

export async function fetchPendingPartnerApplications(
  client: SupabaseClient
): Promise<PartnerApplicationRow[]> {
  await tryBootstrapPartnerApplicationsTables(client);
  const { data, error } = await client
    .from("partner_applications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    if (partnerApplicationsTableMissing(error)) return [];
    throw error;
  }
  return (data || []) as PartnerApplicationRow[];
}

export async function fetchCybercafePendingApplications(client: SupabaseClient) {
  const { data, error } = await client
    .from("cybercafe_profiles")
    .select("id, owner_name, email, phone, shop_name, location, status, created_at")
    .in("status", ["pending_approval", "pending_kyc"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}
