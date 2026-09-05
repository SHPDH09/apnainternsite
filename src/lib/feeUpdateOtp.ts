import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverOtpEmail } from "@/lib/requestOtpDelivery";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";

const OTP_SEND_COOLDOWN_MS = 60_000;
const OTP_SEND_LAST_KEY = "ezyintern_fee_update_otp_last_send";

function canSendFeeOtpNow(email: string): boolean {
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

function markFeeOtpSent(email: string): void {
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

async function currentUserEmail(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const email = String(data.user?.email || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("Signed-in email not found. Please sign in again.");
  return email;
}

/** Email a 6-digit OTP to the signed-in admin/staff before fee update. */
export async function requestFeeUpdateOtp(
  client: SupabaseClient
): Promise<{ ok: true; email: string; devOtp?: string } | { ok: false; error: Error }> {
  let email: string;
  try {
    email = await currentUserEmail(client);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error("Not signed in.") };
  }

  if (!canSendFeeOtpNow(email)) {
    return {
      ok: false,
      error: new Error("A verification code was sent recently. Check your inbox or wait a minute."),
    };
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const localDev = isLocalDevEnvironment();

  const sent = await deliverOtpEmail(client, email, "security", {
    devSessionKey: "fee_update_otp",
  });

  if (!sent.ok) {
    return sent;
  }

  markFeeOtpSent(email);
  return { ok: true, email, devOtp: sent.devOtp ?? (localDev ? generatedOtp : undefined) };
}

export type CollegeFeeUpdateInput = {
  collegeId: string;
  otp: string;
  pisaFeePaise: number;
  feeBasePaise: number;
  feeProcessingPaise: number;
  showFeeBreakdown: boolean;
};

/** Verify OTP and update college fees in one SECURITY DEFINER RPC. */
export async function confirmCollegeFeeUpdateWithOtp(
  client: SupabaseClient,
  input: CollegeFeeUpdateInput
): Promise<void> {
  const otp = input.otp.trim();
  if (otp.length !== 6) throw new Error("Enter the 6-digit verification code.");

  const { data, error } = await client.rpc("admin_update_college_fees", {
    p_college_id: input.collegeId,
    p_otp: otp,
    p_pisa_fee: Math.round(input.pisaFeePaise),
    p_fee_base_paise: Math.round(input.feeBasePaise),
    p_fee_processing_paise: Math.round(input.feeProcessingPaise),
    p_show_fee_breakdown: input.showFeeBreakdown,
  });

  if (error) {
    const msg = String(error.message || "");
    if (/invalid or expired otp/i.test(msg)) {
      throw new Error("Invalid or expired OTP. Please request a new code.");
    }
    if (/not authorized|not authenticated/i.test(msg)) {
      throw new Error("You do not have permission to update college fees.");
    }
    if (/Could not find the function|PGRST202|42883/i.test(msg)) {
      throw new Error(
        "Fee OTP update is not set up in the database yet. Ask an admin to run aws/scripts/45-rds-admin-update-college-fees-otp.sql."
      );
    }
    throw new Error(msg || "Could not update fees.");
  }

  const row = (data || {}) as { ok?: boolean };
  if (row.ok !== true) throw new Error("Fee update failed. Please try again.");
}
