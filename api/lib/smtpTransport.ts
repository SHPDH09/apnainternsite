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

export type SmtpCreds = { user: string; pass: string; host: string; port: number; fromAddress: string };

function readSmtpPassFromEnv(): string {
  return (
    process.env.SMTP_PASS ||
    process.env.HOSTINGER_SMTP_PASS ||
    process.env.MAIL_SMTP_PASS ||
    process.env.EMAIL_SMTP_PASS ||
    ""
  ).trim();
}

let cachedDbSmtp: SmtpCreds | null | undefined;

async function loadSmtpFromDatabase(): Promise<SmtpCreds | null> {
  if (cachedDbSmtp !== undefined) return cachedDbSmtp;
  cachedDbSmtp = null;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: databaseUrl,
      ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 1,
      connectionTimeoutMillis: 8000,
    });
    const { rows } = await pool.query<{
      smtp_host: string;
      smtp_port: string;
      smtp_user: string;
      smtp_pass: string;
      mail_from_address: string;
    }>(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, mail_from_address
       FROM public.site_smtp_config WHERE id = 1 LIMIT 1`
    );
    await pool.end();
    const row = rows[0];
    if (!row?.smtp_pass?.trim()) return null;
    cachedDbSmtp = {
      user: row.smtp_user.trim(),
      pass: row.smtp_pass.trim(),
      host: row.smtp_host.trim(),
      port: Number(row.smtp_port) || 587,
      fromAddress: row.mail_from_address.trim() || "info@apnaintern.in",
    };
    return cachedDbSmtp;
  } catch (e) {
    console.warn("site_smtp_config load failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function resolveSmtpCredentials(): Promise<SmtpCreds> {
  let user = (process.env.SMTP_USER || "").trim();
  let pass = readSmtpPassFromEnv();
  let host = resolveSmtpHost();
  const port = resolveSmtpPort();
  let fromAddress = resolveMailFromAddress();

  if (!pass) {
    const db = await loadSmtpFromDatabase();
    if (db) return db;
  }

  if (!user || isStaleSmtpConfig(host, user)) {
    user = MAIL_MANAGER_SMTP_USER;
    host = MAIL_MANAGER_SMTP_HOST;
  }

  return { user, pass, host, port, fromAddress };
}

/** @deprecated Prefer resolveSmtpCredentials() for RDS site_smtp_config fallback. */
export function getSmtpCredentials(): { user: string; pass: string } {
  const pass = readSmtpPassFromEnv();
  let user = (process.env.SMTP_USER || "").trim();
  const host = resolveSmtpHost();
  if (!user || isStaleSmtpConfig(host, user)) {
    user = MAIL_MANAGER_SMTP_USER;
  }
  return { user, pass };
}

export async function createSmtpTransporter(creds?: SmtpCreds) {
  const nodemailer = (await import("nodemailer")).default;
  const resolved = creds || (await resolveSmtpCredentials());
  const { user, pass, host, port } = resolved;
  if (!user || !pass) {
    throw new Error(
      "SMTP credentials missing on server. Add SMTP_PASS in Vercel project env, or store Mail Manager SMTP in RDS site_smtp_config."
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
  });
}

export { formatSmtpError };
