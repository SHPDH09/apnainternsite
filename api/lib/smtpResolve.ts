/**
 * Shared SMTP env resolution (no pg/aws imports — safe for all Vercel mail routes).
 */

export const DEFAULT_MAIL_FROM_ADDRESS = "info@apnaintern.in";
export const DEFAULT_SMTP_HOST =
  "brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com";
export const DEFAULT_SMTP_USER = "inp-3u5sedrqj7kqwjazxwmph2th";

const LEGACY_MAIL_MANAGER_HOST =
  "brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com";
const LEGACY_MAIL_MANAGER_USER = "inp-3u5sedrqj7kqwjazxwmph2th";

export type ResolvedSmtp = {
  user: string;
  pass: string;
  host: string;
  port: number;
  fromAddress: string;
};

/** App passwords are often pasted with spaces or hyphens — SMTP expects 16 raw chars. */
export function normalizeSmtpPassword(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[\s-]+/g, "");
}

export function readSmtpPassFromEnv(): string {
  const raw =
    process.env.SMTP_PASS ||
    process.env.HOSTINGER_SMTP_PASS ||
    process.env.MAIL_SMTP_PASS ||
    process.env.EMAIL_SMTP_PASS ||
    "";
  return normalizeSmtpPassword(raw);
}

export function resolveMailFromAddress(): string {
  const explicit = (process.env.MAIL_FROM || process.env.SMTP_FROM || "").trim();
  const angle = explicit.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  if (explicit.includes("@")) return explicit;
  return (
    process.env.MAIL_FROM_ADDRESS?.trim() ||
    process.env.SES_FROM_ADDRESS?.trim() ||
    process.env.SMTP_USER?.trim() ||
    DEFAULT_MAIL_FROM_ADDRESS
  );
}

function defaultHostForUser(user: string): string {
  const u = user.toLowerCase();
  if (u.endsWith("@apnamail.in")) return DEFAULT_SMTP_HOST;
  if (u.endsWith("@gmail.com") || u.includes("gmail")) return "smtp.gmail.com";
  return DEFAULT_SMTP_HOST;
}

/**
 * Only fall back to legacy Mail Manager when env has no working mailbox password.
 * Never override explicit SMTP_USER + SMTP_PASS (fixes Hostinger / apnamail.in sends).
 */
export function shouldUseLegacyMailManager(user: string, pass: string, host: string): boolean {
  if (pass.trim()) return false;
  if (!user.trim()) return true;
  const h = host.toLowerCase();
  const u = user.toLowerCase();
  if (u === "info@apnaintern.in") return true;
  if (u.includes("@apnaintern.in") && !u.startsWith("inp-")) return true;
  if (h.includes("email-smtp.")) return true;
  return false;
}

export function resolveSmtpHost(user = ""): string {
  const explicit = (
    process.env.SMTP_HOST ||
    process.env.SES_SMTP_HOST ||
    ""
  ).trim();
  const resolvedUser = (process.env.SMTP_USER || user || DEFAULT_SMTP_USER).trim();
  if (explicit) return explicit;
  return defaultHostForUser(resolvedUser);
}

export function resolveSmtpPort(): number {
  const raw = process.env.SMTP_PORT || "587";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 587;
}

export function resolveSmtpFromEnv(): ResolvedSmtp {
  let user = (process.env.SMTP_USER || DEFAULT_SMTP_USER).trim();
  const pass = readSmtpPassFromEnv();
  let host = resolveSmtpHost(user);
  const port = resolveSmtpPort();
  const fromAddress = resolveMailFromAddress();

  if (shouldUseLegacyMailManager(user, pass, host)) {
    user = LEGACY_MAIL_MANAGER_USER;
    host = LEGACY_MAIL_MANAGER_HOST;
  }

  return { user, pass, host, port, fromAddress };
}

export function legacyMailManagerDefaults(): { host: string; user: string } {
  return { host: LEGACY_MAIL_MANAGER_HOST, user: LEGACY_MAIL_MANAGER_USER };
}
