/** SMTP transport — shared by Vercel mail API routes. */

import { formatSmtpError } from "./smtpErrors.js";
import {
  readSmtpPassFromEnv,
  resolveMailFromAddress,
  resolveSmtpFromEnv,
  resolveSmtpHost,
  resolveSmtpPort,
  shouldUseLegacyMailManager,
  type ResolvedSmtp,
} from "./smtpResolve.js";

export type MailFrom = { name: string; address: string };

/** Verified envelope sender — must match mailbox / verified identity. */
export { resolveMailFromAddress };

/** Nodemailer `from` object — some providers reject string-only formats (501). */
export function resolveMailFrom(label = "Apna Intern"): MailFrom {
  const address = resolveMailFromAddress();
  const explicit = (process.env.MAIL_FROM || "").trim();
  const nameMatch = explicit.match(/^"?([^"<]+)"?\s*</);
  const name = nameMatch ? nameMatch[1].trim() : label;
  return { name, address };
}

export function sesMailHeaders(label = "Apna Intern"): { from: MailFrom; sender: string } {
  const from = resolveMailFrom(label);
  return { from, sender: from.address };
}

export type SmtpCreds = ResolvedSmtp;

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
      fromAddress: row.mail_from_address.trim() || resolveMailFromAddress(),
    };
    return cachedDbSmtp;
  } catch (e) {
    console.warn("site_smtp_config load failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function resolveSmtpCredentials(): Promise<SmtpCreds> {
  const envCreds = resolveSmtpFromEnv();
  if (envCreds.pass) return envCreds;

  const db = await loadSmtpFromDatabase();
  if (db) return db;

  return envCreds;
}

/** @deprecated Prefer resolveSmtpCredentials() for RDS site_smtp_config fallback. */
export function getSmtpCredentials(): { user: string; pass: string } {
  const env = resolveSmtpFromEnv();
  return { user: env.user, pass: env.pass };
}

export async function createSmtpTransporter(creds?: SmtpCreds) {
  const nodemailer = (await import("nodemailer")).default;
  const resolved = creds || (await resolveSmtpCredentials());
  const { user, pass, host, port } = resolved;
  if (!user || !pass) {
    throw new Error(
      "SMTP credentials missing on server. Add SMTP_USER and SMTP_PASS in deployment env, or store SMTP in RDS site_smtp_config."
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
  });
}

export { formatSmtpError, resolveSmtpHost, resolveSmtpPort, shouldUseLegacyMailManager };
