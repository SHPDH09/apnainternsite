import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSendMailOk, getSendMailApiUrl } from "@/lib/sendMailApi";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";
import { PASSWORD_RESETS_SCHEMA_HINT, passwordResetInsertRow } from "@/lib/passwordResetRow";
import { siteApiUrl } from "@/lib/siteApi";

export type OtpPurpose = "login" | "password_reset" | "security";

type DeliverResult =
  | { ok: true; email: string; devOtp?: string; viaServer?: boolean }
  | { ok: false; error: Error };

type ServerOtpJson = {
  success?: boolean;
  emailSent?: boolean;
  message?: string;
  hint?: string;
  error?: string;
  devOtp?: string;
};

function isSmtpAuthMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("535") ||
    m.includes("authentication credentials invalid") ||
    m.includes("invalid login") ||
    m.includes("smtp 535") ||
    m.includes("email server authentication failed")
  );
}

function isSesSandboxMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("not verified") || m.includes("sandbox");
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

function formatOtpDeliveryError(insertError: string | undefined, server: ServerOtpJson): string {
  const primary = [server.error, server.message, insertError].filter(Boolean).join(" ").trim();

  if (isSmtpAuthMessage(primary)) {
    return (
      "Email server login failed (SMTP 535). Update Mail Manager SMTP credentials on the server (Vercel SMTP_PASS or RDS site_smtp_config)."
    );
  }

  if (primary.toLowerCase().includes('smtp credentials missing')) {
    return primary;
  }

  if (isSesSandboxMessage(primary)) {
    return (
      primary ||
      "Verification email could not be delivered — recipient must be verified in Amazon SES, or request SES production access."
    );
  }

  if (isPasswordResetsSchemaMessage(insertError || "")) {
    return [insertError, PASSWORD_RESETS_SCHEMA_HINT].filter(Boolean).join(" ");
  }

  return primary || "Failed to send verification code. Try again in a minute or contact support.";
}

async function requestOtpViaServer(
  email: string,
  purpose: OtpPurpose
): Promise<{ ok: true; json: ServerOtpJson } | { ok: false; json: ServerOtpJson; status: number }> {
  const serverRes = await fetch(siteApiUrl("/api/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request_otp", email, purpose }),
  });
  const serverJson = (await serverRes.json().catch(() => ({}))) as ServerOtpJson;

  if (serverRes.ok && serverJson.success && serverJson.emailSent !== false) {
    return { ok: true, json: serverJson };
  }

  return { ok: false, json: serverJson, status: serverRes.status };
}

async function requestOtpViaClient(
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
 * On RDS production, tries server insert + SES API first (avoids browser RLS + broken SMTP).
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

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const localDev = isLocalDevEnvironment();
  const mailAction = purpose === "login" ? "login_otp" : "send_otp";
  // Prefer browser insert + edge/Lambda send-mail (edge can use Hostinger SMTP).
  // Server forgot-password path fails when Lambda SMTP env is stale (535).
  const preferServer = false;

  if (localDev && opts?.devSessionKey && typeof window !== "undefined") {
    window.sessionStorage.setItem(opts.devSessionKey, generatedOtp);
  }

  let insertError: string | undefined;
  let lastServerJson: ServerOtpJson = {};

  if (preferServer) {
    const server = await requestOtpViaServer(email, purpose);
    if (server.ok) {
      if (opts?.devSessionKey && typeof window !== "undefined") {
        sessionStorage.removeItem(opts.devSessionKey);
      }
      return {
        ok: true,
        email,
        devOtp: server.json.devOtp ?? (localDev ? generatedOtp : undefined),
        viaServer: true,
      };
    }
    lastServerJson = server.json;
    // Server mail often fails on stale Lambda SMTP — fall back to browser insert + /api/send-mail.
    const clientFallback = await requestOtpViaClient(client, email, purpose, generatedOtp, mailAction);
    if (clientFallback.ok) {
      return { ok: true, email, devOtp: localDev ? generatedOtp : undefined };
    }
    insertError = clientFallback.insertError;
    if (!insertError && clientFallback.mailError) {
      lastServerJson = { error: clientFallback.mailError, ...lastServerJson };
    }
  } else {
    const clientAttempt = await requestOtpViaClient(client, email, purpose, generatedOtp, mailAction);
    if (clientAttempt.ok) {
      return { ok: true, email, devOtp: localDev ? generatedOtp : undefined };
    }
    insertError = clientAttempt.insertError;
    if (!insertError && clientAttempt.mailError) {
      lastServerJson = { error: clientAttempt.mailError };
    }
  }

  if (!preferServer) {
    const server = await requestOtpViaServer(email, purpose);
    if (server.ok) {
      if (opts?.devSessionKey && typeof window !== "undefined") {
        sessionStorage.removeItem(opts.devSessionKey);
      }
      return {
        ok: true,
        email,
        devOtp: server.json.devOtp ?? (localDev ? generatedOtp : undefined),
        viaServer: true,
      };
    }
    if (server.json && (server.json.message || server.json.error)) {
      lastServerJson = server.json;
    }
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
    error: new Error(formatOtpDeliveryError(insertError, lastServerJson)),
  };
}
