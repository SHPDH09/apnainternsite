import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';

/** Self-contained OTP deliver — no api/lib or aws/* imports (Vercel safe). */
type OtpPurpose = 'login' | 'password_reset' | 'security';

const DEFAULT_MAIL_FROM = 'info@apnamail.in';
const DEFAULT_SMTP_HOST = 'mail1.apnamail.in';
const DEFAULT_SMTP_USER = 'info@apnamail.in';
const LEGACY_MAIL_MANAGER_HOST =
  'brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com';
const LEGACY_MAIL_MANAGER_USER = 'inp-3u5sedrqj7kqwjazxwmph2th';

const RDS_REST =
  process.env.RDS_REST_URL?.trim() ||
  'https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging/rest/v1/password_resets';
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || 'local-anon-key';

function normalizeSmtpPassword(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[\s-]+/g, '');
}

function readSmtpPassFromEnv(): string {
  const raw =
    process.env.SMTP_PASS ||
    process.env.HOSTINGER_SMTP_PASS ||
    process.env.MAIL_SMTP_PASS ||
    process.env.EMAIL_SMTP_PASS ||
    '';
  return normalizeSmtpPassword(raw);
}

function resolveMailFromAddress(): string {
  const explicit = (process.env.MAIL_FROM || process.env.SMTP_FROM || '').trim();
  const angle = explicit.match(/<([^>]+)>/);
  if (angle) return angle[1].trim();
  if (explicit.includes('@')) return explicit;
  return (
    process.env.MAIL_FROM_ADDRESS?.trim() ||
    process.env.SES_FROM_ADDRESS?.trim() ||
    process.env.SMTP_USER?.trim() ||
    DEFAULT_MAIL_FROM
  );
}

function defaultHostForUser(user: string): string {
  const u = user.toLowerCase();
  if (u.endsWith('@apnamail.in')) return DEFAULT_SMTP_HOST;
  if (u.endsWith('@gmail.com') || u.includes('gmail')) return 'smtp.gmail.com';
  return DEFAULT_SMTP_HOST;
}

function shouldUseLegacyMailManager(user: string, pass: string, host: string): boolean {
  if (pass.trim()) return false;
  if (!user.trim()) return true;
  const h = host.toLowerCase();
  const u = user.toLowerCase();
  if (u === 'info@apnaintern.in') return true;
  if (u.includes('@apnaintern.in') && !u.startsWith('inp-')) return true;
  if (h.includes('email-smtp.')) return true;
  return false;
}

function resolveSmtpFromEnv(): {
  user: string;
  pass: string;
  host: string;
  port: number;
  fromAddress: string;
} {
  let user = (process.env.SMTP_USER || DEFAULT_SMTP_USER).trim();
  const pass = readSmtpPassFromEnv();
  const explicitHost = (process.env.SMTP_HOST || process.env.SES_SMTP_HOST || '').trim();
  let host = explicitHost || defaultHostForUser(user);
  const portRaw = process.env.SMTP_PORT || '587';
  const port = Number.parseInt(portRaw, 10);
  const fromAddress = resolveMailFromAddress();

  if (shouldUseLegacyMailManager(user, pass, host)) {
    user = LEGACY_MAIL_MANAGER_USER;
    host = LEGACY_MAIL_MANAGER_HOST;
  }

  return { user, pass, host, port: Number.isFinite(port) ? port : 587, fromAddress };
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b == null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b as Record<string, unknown>;
  const s = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : String(b);
  try {
    const parsed = JSON.parse(s) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function resolvePurpose(raw: unknown): OtpPurpose {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'login' || v === 'login_otp') return 'login';
  if (v === 'security' || v === 'pin') return 'security';
  return 'password_reset';
}

function buildOtpMail(otp: string, purpose: OtpPurpose): { subject: string; html: string } {
  const copy =
    purpose === 'login'
      ? {
          subject: 'Apna Intern — Your sign-in verification code',
          headline: 'Sign-in verification',
          lead: 'Use the one-time code below to complete your secure sign-in to Apna Intern.',
        }
      : purpose === 'security'
        ? {
            subject: 'Apna Intern — Security verification code',
            headline: 'Security verification',
            lead: 'Use this verification code to confirm your identity.',
          }
        : {
            subject: 'Apna Intern — Password reset verification code',
            headline: 'Password reset',
            lead: 'Enter this verification code to reset your password.',
          };
  const year = new Date().getFullYear();
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;"><table role="presentation" width="100%" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;"><tr><td style="padding:28px 32px 8px;text-align:center;"><p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Apna Intern</p><h1 style="margin:0;font-size:22px;color:#0f172a;">${copy.headline}</h1></td></tr><tr><td style="padding:8px 32px 0;text-align:center;"><p style="margin:0;font-size:15px;color:#475569;">${copy.lead}</p></td></tr><tr><td style="padding:28px 32px;text-align:center;"><p style="margin:0;font-size:36px;font-weight:700;letter-spacing:.35em;color:#1e40af;font-family:monospace;">${otp}</p><p style="margin:20px 0 0;font-size:13px;color:#64748b;">Valid for 15 minutes. Check spam if you do not see this email.</p></td></tr><tr><td style="padding:20px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:11px;color:#94a3b8;">© ${year} Apna Intern</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: copy.subject, html };
}

async function storeOtp(email: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const res = await fetch(RDS_REST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: REST_KEY,
      Authorization: `Bearer ${REST_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: randomUUID(),
      email,
      otp,
      expires_at: expiresAt,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail.trim().slice(0, 240) || `Could not store OTP (${res.status})`);
  }
}

function isSmtpAuthError(e: unknown): boolean {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return raw.includes('535') || raw.includes('authentication credentials invalid') || raw.includes('invalid login');
}

async function sendOtpEmail(email: string, otp: string, purpose: OtpPurpose): Promise<string> {
  const { user, pass, host, port, fromAddress } = resolveSmtpFromEnv();
  if (!pass) {
    throw new Error(
      'SMTP credentials missing on server. Add SMTP_USER and SMTP_PASS in Vercel env.'
    );
  }
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
  });
  const mail = buildOtpMail(otp, purpose);
  const info = await transporter.sendMail({
    from: { name: 'Apna Intern', address: fromAddress },
    sender: fromAddress,
    to: email,
    subject: mail.subject,
    html: mail.html,
  });
  return String(info.messageId || '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const email = String(body.email || body.to || '').trim().toLowerCase();
    const purpose = resolvePurpose(body.purpose);

    if (!email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await storeOtp(email, otp);
    const messageId = await sendOtpEmail(email, otp, purpose);

    return res.status(200).json({
      success: true,
      emailSent: true,
      email,
      message: `Verification code sent to ${email}. Check inbox and spam.`,
      messageId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('otp-deliver error:', msg);
    return res.status(isSmtpAuthError(e) ? 502 : 500).json({
      success: false,
      emailSent: false,
      message: isSmtpAuthError(e)
        ? 'Email server authentication failed (SMTP 535). Check SMTP_USER/SMTP_PASS on Vercel.'
        : msg || 'Failed to send verification code',
    });
  }
}
