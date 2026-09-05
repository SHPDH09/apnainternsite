import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { query } from '../../aws/server/db.js';
import { useRds } from '../lib/useRds.js';
import { buildOtpMailContent, resolveOtpMailPurpose, type OtpMailPurpose } from '../lib/otpMailTemplate.js';
import { formatSmtpError, isSesIdentityNotVerifiedError } from '../lib/smtpErrors.js';

type Action = 'request_otp' | 'reset_password';

function getJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b == null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) {
    return b as Record<string, unknown>;
  }
  const s = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : String(b);
  try {
    const parsed = JSON.parse(s) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function sendOtpEmail(
  normalizedEmail: string,
  generatedOtp: string,
  purpose: OtpMailPurpose
): Promise<void> {
  const mailContent = buildOtpMailContent(generatedOtp, purpose);

  const { canUseSesApi, sendEmailViaSesApi } = await import('../lib/sesSend.js');
  if (canUseSesApi()) {
    await sendEmailViaSesApi({
      to: normalizedEmail,
      subject: mailContent.subject,
      html: mailContent.html,
    });
    return;
  }

  const { createSmtpTransporter, getSmtpCredentials, sesMailHeaders } = await import('../lib/smtpTransport.js');
  const { user: SMTP_USER, pass: SMTP_PASS } = getSmtpCredentials();
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP Credentials missing');
  }

  const transporter = await createSmtpTransporter();
  await transporter.sendMail({
    ...sesMailHeaders('Apna Intern Security'),
    to: normalizedEmail,
    subject: mailContent.subject,
    html: mailContent.html,
  });
}

async function handleWithRds(
  action: Action,
  normalizedEmail: string,
  otp: string | undefined,
  newPassword: string | undefined,
  purpose: OtpMailPurpose,
  res: VercelResponse
) {
  if (action === 'request_otp') {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    await query(
      `INSERT INTO public.password_resets (id, email, otp, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [randomUUID(), normalizedEmail, generatedOtp]
    );

    try {
      await sendOtpEmail(normalizedEmail, generatedOtp, purpose);
    } catch (mailErr) {
      // Local AWS often has no SMTP — still store OTP so browser/session can verify.
      if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_OTP_WITHOUT_SMTP === 'true') {
        return res.status(200).json({
          success: true,
          emailSent: false,
          message: 'OTP stored (email skipped — SMTP missing or failed)',
          devOtp: generatedOtp,
        });
      }
      const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      return res.status(isSesIdentityNotVerifiedError(mailErr) ? 503 : 500).json({
        success: false,
        emailSent: false,
        message: isSesIdentityNotVerifiedError(mailErr)
          ? 'Verification email could not be delivered — Amazon SES sandbox blocks unverified recipients'
          : 'Failed to send verification email',
        error: formatSmtpError(mailErr, { to: normalizedEmail }),
      });
    }

    return res.status(200).json({ success: true, emailSent: true, message: 'OTP sent successfully' });
  }

  if (action === 'reset_password') {
    const normalizedOtp = String(otp || '').trim();
    const password = String(newPassword || '');
    if (normalizedOtp.length !== 6 || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid OTP or password' });
    }

    const { rows: otpRows } = await query<{ id: string }>(
      `SELECT id FROM public.password_resets
       WHERE lower(trim(email)) = $1 AND trim(otp) = $2 AND expires_at > now()
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [normalizedEmail, normalizedOtp]
    );
    if (!otpRows[0]) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const { rows: okRows } = await query<{ result: boolean }>(
      `SELECT public.reset_user_password($1, $2, $3) AS result`,
      [normalizedEmail, normalizedOtp, password]
    );
    if (!okRows[0]?.result) {
      return res.status(400).json({ success: false, message: 'Password reset failed' });
    }

    return res.status(200).json({ success: true, message: 'Password reset successful' });
  }

  return res.status(400).json({ success: false, message: 'Invalid action' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const body = getJsonBody(req);
    const { action, email, otp, newPassword, purpose: purposeRaw } = body as {
      action?: Action;
      email?: string;
      otp?: string;
      newPassword?: string;
      purpose?: string;
    };

    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const purpose = resolveOtpMailPurpose(purposeRaw || 'password_reset');

    if (!action || !normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Missing action or email' });
    }

    if (!useRds()) {
      return res.status(503).json({
        success: false,
        message: 'Password reset requires RDS. Set DATABASE_URL in .env.awsrds.local.',
      });
    }

    return await handleWithRds(action, normalizedEmail, otp, newPassword, purpose, res);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('forgot-password error:', msg);
    return res.status(500).json({ success: false, message: msg || 'Internal server error' });
  }
}
