import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOtpEmail } from "@/lib/requestOtpDelivery";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";

/** Dev-only OTP storage for company registration email verify (CompanyRegister). */
export const COMPANY_REGISTER_OTP_DEV_KEY = "company_register_otp_dev";

export async function requestAdminLoginOtp(
  client: SupabaseClient,
  rawEmail: string
): Promise<{ ok: true; devOtp?: string } | { ok: false; error: Error }> {
  const result = await deliverOtpEmail(client, rawEmail, "security", {
    devSessionKey: COMPANY_REGISTER_OTP_DEV_KEY,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, devOtp: result.devOtp };
}

export async function verifyAdminLoginOtp(
  client: SupabaseClient,
  rawEmail: string,
  otp: string
): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  const code = otp.trim();
  if (code.length !== 6) return false;

  if (isLocalDevEnvironment()) {
    const dev =
      typeof window !== "undefined"
        ? sessionStorage.getItem(COMPANY_REGISTER_OTP_DEV_KEY)
        : null;
    if (dev && dev === code) return true;
  }

  const { data: valid, error } = await client.rpc("verify_password_reset_otp", {
    p_identifier: email,
    p_otp: code,
  });
  if (error) return false;
  return Boolean(valid);
}
