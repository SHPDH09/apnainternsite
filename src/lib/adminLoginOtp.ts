import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOtpEmail } from "@/lib/requestOtpDelivery";

const OTP_SEND_COOLDOWN_MS = 60_000;
const OTP_SEND_LAST_KEY = "ezyintern_admin_login_otp_last_send";

function canSendAdminLoginOtpNow(email: string): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.sessionStorage.getItem(OTP_SEND_LAST_KEY);
  if (!raw) return true;
  try {
    const map = JSON.parse(raw) as Record<string, number>;
    const last = map[email] ?? 0;
    return Date.now() - last >= OTP_SEND_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markAdminLoginOtpSent(email: string): void {
  if (typeof window === "undefined") return;
  let map: Record<string, number> = {};
  try {
    map = JSON.parse(window.sessionStorage.getItem(OTP_SEND_LAST_KEY) || "{}") as Record<
      string,
      number
    >;
  } catch {
    map = {};
  }
  map[email] = Date.now();
  window.sessionStorage.setItem(OTP_SEND_LAST_KEY, JSON.stringify(map));
}

/** Store OTP in password_resets and email via /api/send-mail (with RDS server fallback). */
export async function requestAdminLoginOtp(
  client: SupabaseClient,
  rawEmail: string
): Promise<{ ok: true; email: string; devOtp?: string } | { ok: false; error: Error }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    return { ok: false, error: new Error("Enter a valid email address.") };
  }

  if (!canSendAdminLoginOtpNow(email)) {
    return {
      ok: false,
      error: new Error("A verification code was sent recently. Check your inbox or wait a minute."),
    };
  }

  const sent = await deliverOtpEmail(client, email, "login", {
    devSessionKey: "admin_login_otp",
  });

  if (!sent.ok) {
    return sent;
  }

  if (sent.devOtp && typeof window !== "undefined") {
    window.sessionStorage.setItem("admin_login_otp", sent.devOtp);
  }

  markAdminLoginOtpSent(email);
  return { ok: true, email, devOtp: sent.devOtp };
}

export async function verifyAdminLoginOtp(
  client: SupabaseClient,
  rawEmail: string,
  rawOtp: string
): Promise<boolean> {
  const otp = rawOtp.trim();
  if (!rawEmail.trim() || otp.length !== 6) return false;

  const { data: valid, error } = await client.rpc("verify_password_reset_otp", {
    p_identifier: rawEmail.trim(),
    p_otp: otp,
  });

  if (error) throw error;
  return valid === true;
}
