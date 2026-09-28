/**
 * POST /api/request-otp — OTP request (Vercel).
 * request_otp → otp-deliver (SMTP proof + RDS store). reset_password → forgot-password handler.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import otpDeliver from './otp-deliver.js';
import forgotPassword from './auth/forgot-password.js';

function readAction(req: VercelRequest): string {
  const b = req.body as unknown;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) {
    return String((b as { action?: string }).action || '')
      .trim()
      .toLowerCase();
  }
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (readAction(req) === 'reset_password') {
    return forgotPassword(req, res);
  }
  return otpDeliver(req, res);
}
