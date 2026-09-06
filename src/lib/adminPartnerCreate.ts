import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type PartnerKind,
  type PartnerRegistrationInput,
} from "@/lib/partnerApplications";
import { readAccessTokenFromClient } from "@/lib/partnerApplicationSubmitApi";

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

export async function adminCreatePartnerDirect(
  client: SupabaseClient,
  _reviewerId: string,
  input: PartnerRegistrationInput
): Promise<void> {
  const token = await readAccessTokenFromClient(client);
  if (!token) {
    throw new Error("Admin session required");
  }
  await adminCreatePartnerViaApi(token, input);
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
