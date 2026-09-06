import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPendingPartnerApplications,
  submitPartnerApplication,
  type PartnerKind,
  type PartnerRegistrationInput,
} from "@/lib/partnerApplications";
import { approvePartnerApplication } from "@/lib/partnerApplicationAdmin";

export async function adminCreatePartnerDirect(
  client: SupabaseClient,
  reviewerId: string,
  input: PartnerRegistrationInput
): Promise<void> {
  await submitPartnerApplication(client, input);

  const pending = await fetchPendingPartnerApplications(client);
  const app = pending.find(
    (row) => row.email.trim().toLowerCase() === input.email.trim().toLowerCase() &&
      row.partner_kind === input.partner_kind
  );
  if (!app) {
    throw new Error("Partner record created but application queue entry was not found.");
  }

  await approvePartnerApplication(client, app, reviewerId);
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
