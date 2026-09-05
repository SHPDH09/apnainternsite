/**
 * Flat Vercel route for server-side OTP request (RDS insert + SMTP).
 * Nested `api/auth/forgot-password.ts` is not reliably deployed on Vercel (POST → 405).
 */
export { default } from './auth/forgot-password.js';
