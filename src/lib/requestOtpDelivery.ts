import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSendMailOk, getSendMailApiUrl } from "@/lib/sendMailApi";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";
import { getCanonicalMailApiUrl } from "@/lib/legacyDomainRedirect";
import { PASSWORD_RESETS_SCHEMA_HINT, passwordResetInsertRow } from "@/lib/passwordResetRow";

export type OtpPurpose = "login" | "password_reset" | "security";

type DeliverResult =
  | { ok: true; email: string; devOtp?: string; viaServer?: boolean; sesSandboxLimited?: boolean }
  | { ok: false; error: Error };

type OtpApiJson = {
  success?: boolean;
  emailSent?: boolean;
  email?: string;
  message?: string;
  error?: string;
  devOtp?: string;
  sesSandboxLimited?: boolean;
};

/** Production OTP — always use apnaintern.in mail API (ezyintern.in send-mail crashes). */
function getOtpDeliverApiUrl(): string {
  if (typeof window === "undefined") return "/api/send-mail";
  if (isLocalDevEnvironment()) return "/api/send-mail";
  return getCanonicalMailApiUrl("/api/send-mail");
}

function isPasswordResetsSchemaMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("password_resets") ||
    (m.includes("null value") && m.includes("id")) ||
    m.includes("gen_random_uuid") ||
    (m.includes("permission denied") && m.includes("insert"))
  );
}

function formatOtpDeliveryError(message: string, insertError?: string): string {
  const primary = [message, insertError].filter(Boolean).join(" ").trim();
  if (isPasswordResetsSchemaMessage(primary)) {
    return [primary, PASSWORD_RESETS_SCHEMA_HINT].filter(Boolean).join(" ");
  }
  return primary || "Failed to send verification code. Try again in a minute or contact support.";
}

async function deliverOtpViaServer(
  email: string,
  purpose: OtpPurpose
): Promise<
  | { ok: true; email: string; sesSandboxLimited?: boolean }
  | { ok: false; error: Error }
> {
  const res = await fetch(getOtpDeliverApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "otp_deliver", email, purpose }),
  });

  const text = await res.text().catch(() => "");
  let body: OtpApiJson = {};
  try {
    body = JSON.parse(text) as OtpApiJson;
  } catch {
    throw new Error(
      text.includes("FUNCTION_INVOCATION_FAILED")
        ? "Email server error. Open https://apnaintern.in and try again."
        : text.trim().slice(0, 280) || `OTP request failed (${res.status})`
    );
  }

  const detail = (body.error || body.message || "").trim();
  if (!res.ok || body.success !== true || body.emailSent !== true) {
    const sandboxHint =
      body.message?.includes('sandbox') || body.error?.includes('not verified')
        ? ' OTP sab users ke liye bhejne ke liye AWS Console → SES → Request production access (sirf ek baar).'
        : '';
    return {
      ok: false,
      error: new Error((detail || `OTP request failed (${res.status})`) + sandboxHint),
    };
  }

  return { ok: true, email: body.email || email, sesSandboxLimited: body.sesSandboxLimited };
}

async function deliverOtpViaClient(
  client: SupabaseClient,
  email: string,
  purpose: OtpPurpose,
  generatedOtp: string,
  mailAction: string
): Promise<{ ok: true } | { ok: false; insertError?: string; mailError?: string }> {
  const { error: insertError } = await client
    .from("password_resets")
    .insert(passwordResetInsertRow(email, generatedOtp));

  if (insertError) {
    return { ok: false, insertError: insertError.message };
  }

  try {
    const response = await fetch(getSendMailApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: mailAction,
        otp: generatedOtp,
        to: email,
        email,
        purpose,
      }),
    });
    await assertSendMailOk(response);
    return { ok: true };
  } catch (err: unknown) {
    const mailError = err instanceof Error ? err.message : "Failed to send verification email";
    return { ok: false, mailError };
  }
}

/**
 * Store OTP in password_resets and email the user.
 * Production uses /api/otp-deliver (single server call: RDS insert + SMTP).
 */
export async function deliverOtpEmail(
  client: SupabaseClient,
  rawEmail: string,
  purpose: OtpPurpose,
  opts?: { devSessionKey?: string }
): Promise<DeliverResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    return { ok: false, error: new Error("Enter a valid email address.") };
  }

  const localDev = isLocalDevEnvironment();

  if (localDev && opts?.devSessionKey && typeof window !== "undefined") {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    window.sessionStorage.setItem(opts.devSessionKey, generatedOtp);
  }

  if (!localDev) {
    try {
      const server = await deliverOtpViaServer(email, purpose);
      if (server.ok) {
        if (opts?.devSessionKey && typeof window !== "undefined") {
          sessionStorage.removeItem(opts.devSessionKey);
        }
        return { ok: true, email: server.email, viaServer: true, sesSandboxLimited: server.sesSandboxLimited };
      }
      return server;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send verification code";
      return { ok: false, error: new Error(msg) };
    }
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const mailAction = purpose === "login" ? "login_otp" : "send_otp";
  const clientAttempt = await deliverOtpViaClient(client, email, purpose, generatedOtp, mailAction);

  if (clientAttempt.ok) {
    return { ok: true, email, devOtp: generatedOtp };
  }

  if (localDev) {
    const dev =
      (typeof window !== "undefined" && opts?.devSessionKey
        ? sessionStorage.getItem(opts.devSessionKey)
        : null) || generatedOtp;
    if (dev) {
      return { ok: true, email, devOtp: dev };
    }
  }

  return {
    ok: false,
    error: new Error(
      formatOtpDeliveryError(clientAttempt.mailError || "", clientAttempt.insertError)
    ),
  };
}
