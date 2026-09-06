import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCybercafePartner } from "@/lib/registerCybercafePartner";
import { createEphemeralSupabaseAuthClient } from "@/lib/createSubUser";
import {
  REGISTRATION_PASSWORD_MIN_LENGTH,
  signUpStudentWithChosenPassword,
} from "@/lib/registrationPassword";
import { signInStudentWithPassword } from "@/lib/studentAuthLogin";

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
    description: "Apply for scoped discount coupons by university, college, and domain.",
  },
  {
    value: "both",
    label: "Referral + Coupon",
    description: "Get both a referral link and an initial coupon after verification.",
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

function isMissingTable(error: unknown): boolean {
  const msg =
    error && typeof error === "object"
      ? [(error as { message?: string }).message, (error as { code?: string }).code]
          .filter(Boolean)
          .join(" ")
      : String(error ?? "");
  return /42P01|partner_applications|schema cache|does not exist/i.test(msg);
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
    const { userId } = await registerCybercafePartner(directoryClient, {
      owner_name: input.full_name.trim(),
      email: normalizedEmail,
      password,
      shop_name: String(input.payload.shop_name || "").trim(),
      location: String(input.payload.location || "").trim(),
      phone: input.contact_number.trim(),
    });
    try {
      const { data } = await directoryClient
        .from("partner_applications")
        .insert({
          auth_user_id: userId,
          partner_kind: "cyber_cafe",
          status: "pending",
          full_name: input.full_name.trim(),
          email: normalizedEmail,
          contact_number: input.contact_number.trim(),
          payload: input.payload,
        })
        .select("id")
        .single();
      return { userId, applicationId: data?.id };
    } catch (err) {
      if (isMissingTable(err)) return { userId };
      throw err;
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

  const { data, error } = await authClient.from("partner_applications").insert({
    auth_user_id: userId,
    partner_kind: input.partner_kind,
    status: "pending",
    full_name: input.full_name.trim(),
    email: normalizedEmail,
    contact_number: input.contact_number.trim(),
    payload: input.payload,
  }).select("id").single();

  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        "Partner applications are not set up on the database yet. Ask admin to run aws/scripts/60-rds-partner-applications-coupons.sql"
      );
    }
    throw error;
  }

  return { userId, applicationId: data?.id };
}

export async function fetchPartnerApplicationForUser(
  client: SupabaseClient,
  userId: string
): Promise<PartnerApplicationRow | null> {
  const { data, error } = await client
    .from("partner_applications")
    .select("*")
    .eq("auth_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return (data as PartnerApplicationRow) || null;
}

export async function fetchPendingPartnerApplications(
  client: SupabaseClient
): Promise<PartnerApplicationRow[]> {
  const { data, error } = await client
    .from("partner_applications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
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
