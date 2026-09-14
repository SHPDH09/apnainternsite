/** User-facing SMTP / Amazon SES error text for mail API routes. */

const SES_REGION = process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1";

function extractFailedIdentity(raw: string): string | undefined {
  const patterns = [
    /identities failed the check[^:]*:\s*([^\s,\n]+)/i,
    /address is not verified[^:]*:\s*([^\s,\n]+)/i,
    /Email address is not verified\.?\s*The following identit[^:]*:\s*([^\s,\n]+)/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1].replace(/[)>].*$/, "").trim();
  }
  return undefined;
}

export function isSesIdentityNotVerifiedError(e: unknown): boolean {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    raw.includes("not verified") ||
    raw.includes("messagerejected") ||
    (raw.includes("554") && raw.includes("verified"))
  );
}

/** SMTP login rejected — wrong/expired SMTP_USER or SMTP_PASS on Lambda. */
export function isSmtpAuthError(e: unknown): boolean {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    raw.includes("535") ||
    raw.includes("authentication credentials invalid") ||
    raw.includes("invalid login") ||
    raw.includes("auth") && raw.includes("credentials") && raw.includes("invalid")
  );
}

export function isPasswordResetsSchemaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("password_resets") ||
    m.includes("null value") && m.includes("id") ||
    m.includes("gen_random_uuid") ||
    m.includes("permission denied") && m.includes("password_resets")
  );
}

/**
 * Turn raw nodemailer/SES errors into actionable messages (sandbox + unverified From/To).
 */
export function formatSmtpError(
  e: unknown,
  context?: { to?: string; from?: string }
): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (isSmtpAuthError(e)) {
    return (
      "Email server login failed (SMTP 535 — invalid credentials). " +
      "On AWS Lambda: redeploy with USE_SES_API=true (recommended, uses IAM — no SMTP password), " +
      "or update SMTP_USER/SMTP_PASS in Lambda env with fresh Amazon SES SMTP credentials " +
      "(SES Console → SMTP settings → Create SMTP credentials)."
    );
  }

  if (!isSesIdentityNotVerifiedError(e)) return raw;

  const identity =
    extractFailedIdentity(raw) ||
    context?.to?.trim() ||
    context?.from?.trim() ||
    "email address";

  const fromHint = context?.from ? ` Sender: ${context.from}.` : "";

  return (
    `AWS SES (${SES_REGION}): "${identity}" is not verified.${fromHint} ` +
    "If your SES account is in sandbox mode, verify both the sender (MAIL_FROM) and each recipient in " +
    "AWS Console → Amazon SES → Verified identities, then click the confirmation link. " +
    "For production bulk email, verify your domain (apnaintern.in) and request SES production access. " +
    `Quick fix for testing: run "aws ses verify-email-identity --email-address ${identity} --region ${SES_REGION}" and confirm the email.`
  );
}
