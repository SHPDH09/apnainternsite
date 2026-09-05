import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSendMailOk, getSendMailApiUrl } from "@/lib/sendMailApi";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";
import { PASSWORD_RESETS_SCHEMA_HINT, passwordResetInsertRow } from "@/lib/passwordResetRow";
import { siteApiUrl } from "@/lib/siteApi";

export type OtpPurpose = "login" | "password_reset" | "security";

type DeliverResult =
  | { ok: true; email: string; devOtp?: string; viaServer?: boolean }
  | { ok: false; error: Error };

/**
 * Store OTP in password_resets and email the user.
 * Falls back to POST /api/auth/forgot-password when browser insert or SMTP fails
 * (same path used by forgot-password / forgot-PIN — fixes non-admin OTP delivery on RDS).
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

  if (localDev && opts?.devSessionKey && typeof window !== "undefined") {
    window.sessionStorage.setItem(opts.devSessionKey, generatedOtp);
  }

  const { error: insertError } = await client
    .from("password_resets")
    .insert(passwordResetInsertRow(email, generatedOtp));

  if (!insertError) {
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
      return { ok: true, email, devOtp: localDev ? generatedOtp : undefined };
    } catch {
      // SMTP failed — server fallback generates a fresh OTP via RDS SQL.
    }
  }

  try {
    const serverRes = await fetch(siteApiUrl("/api/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_otp", email, purpose }),
    });
    const serverJson = (await serverRes.json().catch(() => ({}))) as {
      success?: boolean;
      emailSent?: boolean;
      message?: string;
      hint?: string;
      error?: string;
      devOtp?: string;
    };

    if (!serverRes.ok || !serverJson.success || serverJson.emailSent === false) {
      const detail = [
        insertError?.message,
        serverJson.error,
        serverJson.message,
        serverJson.hint,
        PASSWORD_RESETS_SCHEMA_HINT,
      ]
        .filter(Boolean)
        .join(" ");
      throw new Error(detail || "Failed to send verification code");
    }

    if (opts?.devSessionKey && typeof window !== "undefined") {
      sessionStorage.removeItem(opts.devSessionKey);
    }

    return {
      ok: true,
      email,
      devOtp: serverJson.devOtp ?? (localDev ? generatedOtp : undefined),
      viaServer: true,
    };
  } catch (err: unknown) {
    if (localDev) {
      const dev =
        (typeof window !== "undefined" && opts?.devSessionKey
          ? sessionStorage.getItem(opts.devSessionKey)
          : null) || generatedOtp;
      if (dev) {
        return { ok: true, email, devOtp: dev };
      }
    }
    const detail = err instanceof Error ? err.message : "Failed to send verification code";
    return { ok: false, error: new Error(detail) };
  }
}
