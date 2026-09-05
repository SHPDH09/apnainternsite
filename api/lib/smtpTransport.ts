/** AWS SES Mail Manager ingress SMTP — shared by Vercel mail API routes. */

import { formatSmtpError } from "./smtpErrors.js";

export type MailFrom = { name: string; address: string };

const MAIL_MANAGER_SMTP_HOST = "brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com";
const MAIL_MANAGER_SMTP_USER = "inp-3u5sedrqj7kqwjazxwmph2th";

function isStaleSmtpConfig(host: string, user: string): boolean {
  const h = host.toLowerCase();
  const u = user.toLowerCase();
  return (
    h.includes("hostinger") ||
    h.includes("email-smtp.") ||
    u === "info@apnaintern.in" ||
    (u.includes("@apnaintern.in") && !u.startsWith("inp-"))
  );
}

export function resolveSmtpHost(): string {
  const raw = (
    process.env.SMTP_HOST ||
    process.env.SES_SMTP_HOST ||
    MAIL_MANAGER_SMTP_HOST
  ).trim();
  const user = (process.env.SMTP_USER || "").trim();
  if (isStaleSmtpConfig(raw, user)) return MAIL_MANAGER_SMTP_HOST;
  return raw;
}

export function resolveSmtpPort(): number {
  const raw = process.env.SMTP_PORT || '587';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 587;
}

/** Verified SES envelope sender — must match a verified identity in SES. */
export function resolveMailFromAddress(): string {
  const explicit = (process.env.MAIL_FROM || process.env.SMTP_FROM || "").trim();
  const angle = explicit.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  if (explicit.includes("@")) return explicit;
  return (
    process.env.MAIL_FROM_ADDRESS?.trim() ||
    process.env.SES_FROM_ADDRESS?.trim() ||
    "info@apnaintern.in"
  );
}

/** Nodemailer `from` object — SES rejects some string-only formats (501). */
export function resolveMailFrom(label = 'Apna Intern'): MailFrom {
  const address = resolveMailFromAddress();
  const explicit = (process.env.MAIL_FROM || '').trim();
  const nameMatch = explicit.match(/^"?([^"<]+)"?\s*</);
  const name = nameMatch ? nameMatch[1].trim() : label;
  return { name, address };
}

export function sesMailHeaders(label = 'Apna Intern'): { from: MailFrom; sender: string } {
  const from = resolveMailFrom(label);
  return { from, sender: from.address };
}

export function getSmtpCredentials(): { user: string; pass: string } {
  const pass = (process.env.SMTP_PASS || "").trim();
  let user = (process.env.SMTP_USER || "").trim();
  const host = resolveSmtpHost();
  if (!user || isStaleSmtpConfig(host, user)) {
    user = MAIL_MANAGER_SMTP_USER;
  }
  return { user, pass };
}

export async function createSmtpTransporter() {
  const nodemailer = (await import("nodemailer")).default;
  const { user, pass } = getSmtpCredentials();
  if (!user || !pass) {
    throw new Error("SMTP credentials missing");
  }
  const port = resolveSmtpPort();
  return nodemailer.createTransport({
    host: resolveSmtpHost(),
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
  });
}

export { formatSmtpError };
