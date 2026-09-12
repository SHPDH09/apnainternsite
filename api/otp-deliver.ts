import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';

/** Self-contained OTP deliver — no api/lib or aws/* imports (Vercel safe). */
type OtpPurpose = 'login' | 'password_reset' | 'security';

const DEFAULT_MAIL_FROM = 'info@apnaintern.in';
const MAIL_MANAGER_SMTP_HOST =
  'brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com';
const MAIL_MANAGER_SMTP_USER = 'inp-3u5sedrqj7kqwjazxwmph2th';

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
    DEFAULT_MAIL_FROM
  );
}

const MAIL_MANAGER_SMTP_PASS = 'Raunak@12583';

function isBrokenApnamailEnv(user: string, host: string, pass: string): boolean {
  const u = user.toLowerCase();
  const h = host.toLowerCase();
  return (
    u.endsWith('@apnamail.in') ||
    h.includes('mail1.apnamail.in') ||
    pass === 'wuh4ovfk38aiuboa'
  );
}

function mailManagerSmtpCreds(): {
  user: string;
  pass: string;
  host: string;
  port: number;
  fromAddress: string;
} {
  return {
    user: MAIL_MANAGER_SMTP_USER,
    pass: MAIL_MANAGER_SMTP_PASS,
    host: MAIL_MANAGER_SMTP_HOST,
    port: 587,
    fromAddress: resolveMailFromAddress(),
  };
}

function resolveSmtpFromEnv(): {
  user: string;
  pass: string;
  host: string;
  port: number;
  fromAddress: string;
} {
  const pass = readSmtpPassFromEnv();
  const host = (process.env.SMTP_HOST || MAIL_MANAGER_SMTP_HOST).trim();
  const user = (process.env.SMTP_USER || MAIL_MANAGER_SMTP_USER).trim();
  const portRaw = process.env.SMTP_PORT || '587';
  const port = Number.parseInt(portRaw, 10);

  if (isBrokenApnamailEnv(user, host, pass)) {
    return mailManagerSmtpCreds();
  }

  return {
    user,
    pass: pass || MAIL_MANAGER_SMTP_PASS,
    host,
    port: Number.isFinite(port) ? port : 587,
    fromAddress: resolveMailFromAddress(),
  };
}

function canUseSesApi(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
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

function buildOtpMail(otp: string, purpose: OtpPurpose): { subject: string; html: string; text: string } {
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
  const text = `Apna Intern — ${copy.headline}\n\n${copy.lead}\n\nYour verification code: ${otp}\n\nValid for 15 minutes.\n`;
  return { subject: copy.subject, html, text };
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

function isSesIdentityNotVerifiedError(e: unknown): boolean {
  const raw = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return raw.includes('not verified') || raw.includes('messagerejected');
}

async function sendOtpViaSesApi(
  to: string,
  mail: { subject: string; html: string; text: string }
): Promise<string> {
  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
  const region = process.env.SES_REGION || process.env.AWS_REGION || 'ap-south-1';
  const client = new SESv2Client({ region });
  const fromAddress = resolveMailFromAddress();
  const result = await client.send(
    new SendEmailCommand({
      FromEmailAddress: `Apna Intern <${fromAddress}>`,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: ['info@apnamail.in'],
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: mail.html, Charset: 'UTF-8' },
            Text: { Data: mail.text, Charset: 'UTF-8' },
          },
        },
      },
    })
  );
  return String(result.MessageId || 'ses');
}

async function sendOtpViaSmtpWithCreds(
  to: string,
  mail: { subject: string; html: string; text: string },
  creds: { user: string; pass: string; host: string; port: number; fromAddress: string }
): Promise<string> {
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 465,
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
  });
  const info = await transporter.sendMail({
    from: { name: 'Apna Intern', address: creds.fromAddress },
    sender: creds.fromAddress,
    replyTo: 'info@apnamail.in',
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  return String(info.messageId || '');
}

async function sendOtpEmail(email: string, otp: string, purpose: OtpPurpose): Promise<string> {
  const mail = buildOtpMail(otp, purpose);
  const errors: string[] = [];

  if (canUseSesApi()) {
    try {
      return await sendOtpViaSesApi(email, mail);
    } catch (sesErr) {
      errors.push(`SES: ${sesErr instanceof Error ? sesErr.message : String(sesErr)}`);
      console.warn('SES OTP send failed, trying SMTP:', errors[errors.length - 1]);
    }
  }

  const smtpCandidates = [resolveSmtpFromEnv(), mailManagerSmtpCreds()];
  const seen = new Set<string>();

  for (const creds of smtpCandidates) {
    const key = `${creds.host}|${creds.user}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      return await sendOtpViaSmtpWithCreds(email, mail, creds);
    } catch (smtpErr) {
      errors.push(`SMTP(${creds.host}): ${smtpErr instanceof Error ? smtpErr.message : String(smtpErr)}`);
      if (!isSmtpAuthError(smtpErr)) throw smtpErr;
    }
  }

  throw new Error(errors.join(' | ') || 'Failed to send verification email');
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
