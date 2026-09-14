import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOtpEmail } from "@/lib/requestOtpDelivery";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";

export const PARTNER_REGISTER_OTP_DEV_KEY = "partner_register_otp_dev";
export const PARTNER_REGISTER_VERIFIED_EMAIL_KEY = "partner_register_verified_email";

export async function sendPartnerRegistrationOtp(
  client: SupabaseClient,
  rawEmail: string
): Promise<{ ok: true; devOtp?: string } | { ok: false; error: string }> {
  const result = await deliverOtpEmail(client, rawEmail, "security", {
    devSessionKey: PARTNER_REGISTER_OTP_DEV_KEY,
  });
  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, devOtp: result.devOtp };
}

export async function verifyPartnerRegistrationOtp(
  client: SupabaseClient,
  rawEmail: string,
  otp: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = rawEmail.trim().toLowerCase();
  const code = otp.trim();
  if (code.length !== 6) {
    return { ok: false, error: "Enter the 6-digit verification code." };
  }

  if (isLocalDevEnvironment()) {
    const dev =
      typeof window !== "undefined"
        ? sessionStorage.getItem(PARTNER_REGISTER_OTP_DEV_KEY)
        : null;
    if (dev && dev === code) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PARTNER_REGISTER_VERIFIED_EMAIL_KEY, email);
      }
      return { ok: true };
    }
  }

  const { data: valid, error } = await client.rpc("verify_password_reset_otp", {
    p_identifier: email,
    p_otp: code,
  });
  if (error) {
    return { ok: false, error: error.message || "Verification failed." };
  }
  if (!valid) {
    return { ok: false, error: "Invalid or expired code. Request a new one." };
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem(PARTNER_REGISTER_VERIFIED_EMAIL_KEY, email);
  }
  return { ok: true };
}

export function peekPartnerVerifiedEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PARTNER_REGISTER_VERIFIED_EMAIL_KEY)?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export function clearPartnerVerifiedEmail(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PARTNER_REGISTER_VERIFIED_EMAIL_KEY);
    sessionStorage.removeItem(PARTNER_REGISTER_OTP_DEV_KEY);
  } catch {
    /* ignore */
  }
}

export function isPartnerEmailVerified(rawEmail: string): boolean {
  const verified = peekPartnerVerifiedEmail();
  return Boolean(verified && verified === rawEmail.trim().toLowerCase());
}
