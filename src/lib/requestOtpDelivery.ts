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
  messageId?: string;
  channel?: string;
  via?: string;
};

/** Reject synthetic ids from edge/mailchannels — they caused false "sent" toasts without inbox delivery. */
function isTrustedOtpMessageId(messageId: string, body: OtpApiJson): boolean {
  const id = messageId.trim();
  if (!id) return false;
  if (id.startsWith("edge-smtp-")) return false;
  if (body.via === "mailchannels") return false;
  if (id.includes("@")) return true;
  if (/^[0-9a-f-]{20,}$/i.test(id)) return true;
  return id.startsWith("<") && id.includes("@");
}

/** Vercel origin — bypasses Cloudflare edge Mail Manager (accepts mail but never delivers). */
const OTP_VERCEL_ORIGIN = "https://apnainternsite.vercel.app";

/** Production OTP — Vercel Hostinger SMTP (not CF edge Mail Manager). */
function getOtpDeliverApiUrl(): string {
  if (typeof window === "undefined") return "/api/otp-deliver";
  if (isLocalDevEnvironment()) return "/api/send-mail";
  return `${OTP_VERCEL_ORIGIN}/api/otp-deliver`;
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

function otpDeliverPayload(url: string, email: string, purpose: OtpPurpose): string {
  return JSON.stringify(
    url.includes("otp-deliver")
      ? { email, purpose }
      : { action: "otp_deliver", email, purpose }
  );
}

async function parseOtpDeliverResponse(
  res: Response,
  email: string
): Promise<
  | { ok: true; email: string; sesSandboxLimited?: boolean }
  | { ok: false; error: Error; edgeFakeSuccess?: boolean }
> {
  const text = await res.text().catch(() => "");
  let body: OtpApiJson = {};
  try {
    body = JSON.parse(text) as OtpApiJson;
  } catch {
    return {
      ok: false,
      error: new Error(
        text.includes("FUNCTION_INVOCATION_FAILED")
          ? "Email server error. Open https://apnaintern.in and try again."
          : text.trim().slice(0, 280) || `OTP request failed (${res.status})`
      ),
    };
  }

  const detail = (body.error || body.message || "").trim();
  const messageId = String(body.messageId || "").trim();
  const otpDeliveryHeader = (res.headers.get("X-Otp-Delivery") || "").toLowerCase();
  const edgeFakeSuccess =
    otpDeliveryHeader.includes("edge-mail-manager") || otpDeliveryHeader.includes("edge-smtp");
  const trustedId = !edgeFakeSuccess && isTrustedOtpMessageId(messageId, body);

  if (!res.ok || body.success !== true || body.emailSent !== true || !trustedId) {
    const smtpHint =
      body.message?.includes("outbound") || body.message?.includes("SMTP")
        ? ""
        : body.message?.includes("sandbox") || body.error?.includes("not verified")
          ? " Check SMTP_USER/SMTP_PASS in Vercel (use Hostinger or Gmail app password)."
          : "";
    const missingIdHint =
      res.ok && body.success === true && body.emailSent === true && !trustedId
        ? " Email server did not confirm delivery — OTP was not sent from info@apnaintern.in."
        : "";
    return {
      ok: false,
      edgeFakeSuccess,
      error: new Error(
        (detail || missingIdHint || `OTP request failed (${res.status})`) + smtpHint
      ),
    };
  }

  return {
    ok: true,
    email: body.email || email,
    sesSandboxLimited: body.sesSandboxLimited,
  };
}

async function deliverOtpViaServer(
  email: string,
  purpose: OtpPurpose
): Promise<
  | { ok: true; email: string; sesSandboxLimited?: boolean }
  | { ok: false; error: Error }
> {
  const primaryUrl = getOtpDeliverApiUrl();
  const vercelUrl = `${OTP_VERCEL_ORIGIN}/api/otp-deliver`;

  const attempt = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: otpDeliverPayload(url, email, purpose),
    });
    return parseOtpDeliverResponse(res, email);
  };

  const first = await attempt(primaryUrl);
  if (first.ok) return first;

  if (first.edgeFakeSuccess && primaryUrl !== vercelUrl) {
    const retry = await attempt(vercelUrl);
    if (retry.ok) return retry;
    return retry;
  }

  return first;
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
