export type OtpPurpose = "login" | "password_reset" | "security";

const COPY: Record<OtpPurpose, { subject: string; headline: string; lead: string }> = {
  login: {
    subject: "Apna Intern — Your sign-in verification code",
    headline: "Sign-in verification",
    lead: "Use the one-time code below to complete your secure sign-in to Apna Intern.",
  },
  password_reset: {
    subject: "Apna Intern — Password reset verification code",
    headline: "Password reset",
    lead: "You requested to reset your password. Enter this verification code to continue.",
  },
  security: {
    subject: "Apna Intern — Security verification code",
    headline: "Security verification",
    lead: "Use this verification code to confirm your identity for a sensitive account action.",
  },
};

export function resolveOtpPurpose(raw: unknown): OtpPurpose {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "login" || v === "login_otp") return "login";
  if (v === "security" || v === "pin") return "security";
  return "password_reset";
}

export function buildOtpMailHtml(otp: string, purpose: OtpPurpose): { subject: string; html: string } {
  const copy = COPY[purpose];
  const code = String(otp || "").trim();
  const year = new Date().getFullYear();
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,sans-serif;">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
<tr><td style="padding:24px;text-align:center;border-bottom:1px solid #e2e8f0;">
<p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">Apna Intern</p>
<h1 style="margin:8px 0 0;font-size:22px;color:#0f172a;">${copy.headline}</h1>
<p style="margin:12px 0 0;font-size:15px;color:#475569;">${copy.lead}</p>
</td></tr>
<tr><td style="padding:28px;text-align:center;">
<p style="margin:0;font-size:34px;font-weight:700;letter-spacing:.32em;color:#1e40af;font-family:monospace;">${code}</p>
<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Valid for 15 minutes. Do not share this code.</p>
</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:11px;color:#94a3b8;">© ${year} Apna Intern · SDP Technology Pvt Ltd</p>
</td></tr>
</table></body></html>`;
  return { subject: copy.subject, html };
}

export interface OtpSmtpEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM_ADDRESS?: string;
}

export async function sendOtpViaHostinger(
  env: OtpSmtpEnv,
  to: string,
  otp: string,
  purpose: OtpPurpose
): Promise<void> {
  const pass = String(env.SMTP_PASS || "").trim();
  const user = String(env.SMTP_USER || "info@apnaintern.in").trim();
  const host = String(env.SMTP_HOST || "smtp.hostinger.com").trim();
  const port = Number(env.SMTP_PORT || 587);
  const fromAddress = String(env.MAIL_FROM_ADDRESS || user).trim();

  if (!pass) {
    throw new Error("SMTP_PASS is not configured on the Cloudflare Worker");
  }

  const { WorkerMailer } = await import("@workermailer/smtp");
  const mailer = await WorkerMailer.connect({
    host,
    port,
    secure: port === 465,
    startTls: port !== 465,
    credentials: { username: user, password: pass },
  });

  const mail = buildOtpMailHtml(otp, purpose);
  await mailer.send({
    from: { mail: fromAddress, name: "Apna Intern" },
    to: { mail: to },
    subject: mail.subject,
    html: mail.html,
  });
}
