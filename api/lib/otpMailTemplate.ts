export type OtpMailPurpose = "login" | "password_reset" | "security";

const PURPOSE_COPY: Record<
  OtpMailPurpose,
  { subject: string; headline: string; lead: string; footerNote: string }
> = {
  login: {
    subject: "Apna Intern — Your sign-in verification code",
    headline: "Sign-in verification",
    lead: "Use the one-time code below to complete your secure sign-in to Apna Intern.",
    footerNote: "This code was requested for your Apna Intern account sign-in.",
  },
  password_reset: {
    subject: "Apna Intern — Password reset verification code",
    headline: "Password reset",
    lead: "You requested to reset your password. Enter this verification code to continue.",
    footerNote: "If you did not request a password reset, you can safely ignore this email.",
  },
  security: {
    subject: "Apna Intern — Security verification code",
    headline: "Security verification",
    lead: "Use this verification code to confirm your identity for a sensitive account action.",
    footerNote: "Never share this code with anyone, including Apna Intern staff.",
  },
};

export function resolveOtpMailPurpose(raw: unknown): OtpMailPurpose {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "login" || v === "login_otp") return "login";
  if (v === "password_reset" || v === "reset" || v === "send_otp") return "password_reset";
  if (v === "security" || v === "pin") return "security";
  return "password_reset";
}

export function buildOtpMailContent(
  otp: string,
  purpose: OtpMailPurpose = "password_reset"
): { subject: string; html: string } {
  const copy = PURPOSE_COPY[purpose];
  const code = String(otp || "").trim();
  const year = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#5AA3E6 0%,#3b82c4 100%);"></td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Apna Intern</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">${copy.headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${copy.lead}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;text-align:center;">
              <div style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 28px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Verification code</p>
                <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.35em;color:#1e40af;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${code}</p>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Valid for <strong style="color:#334155;">15 minutes</strong>. Do not share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#1e3a8a;"><strong>Official message</strong> — ${copy.footerNote}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:600;color:#475569;">SDP Technology Pvt Ltd · Apna Intern</p>
              <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">This is an automated security email. Please do not reply to this message.<br/>© ${year} Apna Intern. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, html };
}
