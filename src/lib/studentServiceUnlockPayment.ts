import type { SupabaseClient } from "@supabase/supabase-js";
import { logPaymentSuccessRow } from "@/lib/courseEnrollmentFlow";
import {
  fetchPublicPaymentConfig,
  normalizePaymentSettings,
  runRegistrationRazorpayCheckout,
} from "@/lib/registrationPayment";
import {
  unlockStudentServiceForUser,
  type ResolvedStudentServiceAccess,
} from "@/lib/studentServiceKeys";

export type ServiceUnlockPaymentProfile = {
  email?: string | null;
  full_name?: string | null;
  contact_number?: string | null;
  university_name?: string | null;
  college_name?: string | null;
  registration_id?: string | null;
  metadata?: unknown;
};

export type ServiceUnlockPaymentResult =
  | { success: true; paymentId: string }
  | { success: false; cancelled?: boolean };

/**
 * Razorpay checkout for a single locked dashboard service.
 * Uses legacy checkout (same as course/internship add-ons) so verify/enrollment
 * is not invoked — only this service is unlocked in student metadata.
 */
export async function payToUnlockStudentService(
  client: SupabaseClient,
  opts: {
    userId: string;
    profile: ServiceUnlockPaymentProfile;
    access: ResolvedStudentServiceAccess;
  }
): Promise<ServiceUnlockPaymentResult> {
  const { userId, profile, access } = opts;
  const amountPaise = access.feeBreakdown.totalPaise;

  if (amountPaise < 100) {
    throw new Error(
      "Unlock fee is below the minimum online payment amount. Contact support to unlock this service."
    );
  }

  const cfg = await fetchPublicPaymentConfig(client);
  const settings = normalizePaymentSettings(cfg);
  if (!settings?.razorpay_key_id) {
    throw new Error("Payment gateway is not configured. Contact support.");
  }

  const result = await runRegistrationRazorpayCheckout({
    paymentSettings: settings,
    amountPaise,
    description: `${access.config.label} unlock fee`,
    prefill: {
      name: String(profile.full_name || "Student"),
      email: String(profile.email || ""),
      contact: String(profile.contact_number || ""),
    },
    studentData: {
      user_id: userId,
      email: profile.email,
      full_name: profile.full_name,
      contact_number: profile.contact_number,
      university_name: profile.university_name,
      college_name: profile.college_name,
      registration_id: profile.registration_id,
      purpose: "service_unlock",
      service_key: access.key,
      source: "dashboard_service_unlock_payment",
    },
  });

  if (!result.success) {
    return { success: false, cancelled: "cancelled" in result ? result.cancelled : undefined };
  }

  const paymentId = result.payment_id;

  await logPaymentSuccessRow(client, {
    user_id: userId,
    payment_id: paymentId,
    amount_paise: amountPaise,
    email: profile.email,
    full_name: profile.full_name,
    college_name: profile.college_name,
    metadata: {
      purpose: "service_unlock",
      service_key: access.key,
    },
  });

  await unlockStudentServiceForUser(client, userId, profile.metadata, access.key, {
    paymentId,
    amountPaise,
  });

  return { success: true, paymentId };
}
