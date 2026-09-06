import type { SupabaseClient } from "@supabase/supabase-js";
import { approvePartnerApplication } from "@/lib/partnerApplicationAdmin";
import {
  fetchPartnerApplicationForUser,
  fetchPendingPartnerApplications,
  submitPartnerApplication,
  type PartnerApplicationRow,
  type PartnerKind,
  type PartnerRegistrationInput,
} from "@/lib/partnerApplications";
import { readAccessTokenFromClient } from "@/lib/partnerApplicationSubmitApi";

function isAdminPartnerApiUnavailable(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    /404|503|502|504|cannot post|failed to fetch|network|database_url|not configured|method not allowed|function_invocation/i.test(
      msg
    ) || msg.includes("<!doctype html>")
  );
}

export async function adminCreatePartnerViaApi(
  accessToken: string,
  input: PartnerRegistrationInput
): Promise<{ recordId: string; applicationId: string }> {
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  if (!origin) {
    throw new Error("Admin partner registration API is unavailable in this environment.");
  }

  const res = await fetch(`${origin}/api/admin-partner-register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      partner_kind: input.partner_kind,
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      password: input.password,
      contact_number: input.contact_number.trim(),
      payload: input.payload,
    }),
  });

  const text = await res.text().catch(() => "");
  let body: {
    ok?: boolean;
    recordId?: string;
    applicationId?: string;
    message?: string;
    detail?: string;
  } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = { message: text.trim().slice(0, 280) || `Request failed (${res.status})` };
  }

  if (!res.ok || body.ok !== true || !body.recordId) {
    throw new Error(body.message || body.detail || `Partner registration failed (${res.status})`);
  }

  return {
    recordId: body.recordId,
    applicationId: body.applicationId || "",
  };
}

async function resolveApplicationForApproval(
  client: SupabaseClient,
  input: PartnerRegistrationInput,
  userId: string,
  applicationId?: string
): Promise<PartnerApplicationRow> {
  if (applicationId) {
    const { data, error } = await client
      .from("partner_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as PartnerApplicationRow;
  }

  const byUser = await fetchPartnerApplicationForUser(client, userId);
  if (byUser) return byUser;

  const pending = await fetchPendingPartnerApplications(client);
  const match = pending.find(
    (row) =>
      row.email.trim().toLowerCase() === input.email.trim().toLowerCase() &&
      row.partner_kind === input.partner_kind
  );
  if (match) return match;

  throw new Error(
    "Partner account was created but the application record could not be loaded for approval."
  );
}

/** Fallback when /api/admin-partner-register is unavailable (Lambda not deployed / no Vercel DATABASE_URL). */
async function adminCreatePartnerViaSubmitAndApprove(
  client: SupabaseClient,
  reviewerId: string,
  input: PartnerRegistrationInput
): Promise<void> {
  const { userId, applicationId } = await submitPartnerApplication(client, input);
  const app = await resolveApplicationForApproval(client, input, userId, applicationId);
  await approvePartnerApplication(client, app, reviewerId);
}

export async function adminCreatePartnerDirect(
  client: SupabaseClient,
  reviewerId: string,
  input: PartnerRegistrationInput
): Promise<void> {
  const token = await readAccessTokenFromClient(client);
  if (!token) {
    throw new Error("Admin session required");
  }

  try {
    await adminCreatePartnerViaApi(token, input);
    return;
  } catch (err) {
    if (!isAdminPartnerApiUnavailable(err)) throw err;
  }

  await adminCreatePartnerViaSubmitAndApprove(client, reviewerId, input);
}

export type AdminPartnerFormPayload = {
  partner_kind: PartnerKind;
  full_name: string;
  email: string;
  password: string;
  contact_number: string;
  address: string;
  shop_name?: string;
  city?: string;
  referral_type?: string;
  referral_apply_mode?: string;
  universities?: string[];
  colleges?: string[];
  internship_domain?: string | null;
  max_students?: number | null;
  student_emails?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  coupon_amount?: number | null;
  coupon_code?: string | null;
  access_mode?: string;
};

export function buildAdminPartnerRegistrationInput(
  form: AdminPartnerFormPayload
): PartnerRegistrationInput {
  const payload: Record<string, unknown> = {
    address: form.address.trim(),
    city: form.city?.trim() || null,
  };

  if (form.partner_kind === "cyber_cafe") {
    payload.shop_name = String(form.shop_name || "").trim();
    payload.location = form.address.trim();
  } else {
    payload.universities = form.universities || [];
    payload.colleges = form.colleges || [];
    payload.referral_type = form.referral_type || "partner";
    payload.university_name = form.universities?.[0] || null;
    payload.college_name = form.colleges?.[0] || null;
    if (form.partner_kind === "referral") {
      payload.referral_apply_mode = form.referral_apply_mode || "referral_only";
      payload.access_mode = form.access_mode || form.referral_apply_mode || "referral_only";
    }
    if (
      form.partner_kind === "coupon" ||
      form.referral_apply_mode === "coupon_only" ||
      form.referral_apply_mode === "both"
    ) {
      payload.internship_domain = form.internship_domain || null;
      payload.max_students = form.max_students ?? null;
      payload.student_emails = form.student_emails || "";
      payload.valid_from = form.valid_from || null;
      payload.valid_to = form.valid_to || null;
      payload.coupon_amount = form.coupon_amount ?? null;
      payload.coupon_code = form.coupon_code || null;
    }
  }

  return {
    partner_kind: form.partner_kind,
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    password: form.password,
    contact_number: form.contact_number.trim(),
    payload,
  };
}
