#!/usr/bin/env node
/**
 * One-time fix so OTP reaches ALL users (not per-email manual verify).
 *
 * Amazon SES "sandbox" only delivers to verified addresses.
 * Production Access = send to any email (Gmail, college, etc.) — request ONCE.
 *
 * Usage: node aws/scripts/ses-request-production-access.mjs
 */
const region = process.env.SES_REGION || process.env.AWS_REGION || 'ap-south-1';

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  OTP sab users ko bhejne ke liye — SIRF EK BAAR ye karo         ║
╚══════════════════════════════════════════════════════════════════╝

Problem:
  Har email manually verify karna possible nahi.
  SES abhi "SANDBOX" mode mein hai → sirf kuch verified emails par mail jati hai.

Fix (one time, ~24–48 hours AWS approval):

  1. AWS Console login (account owner / admin IAM)
     https://console.aws.amazon.com/ses/home?region=${region}#/account

  2. Region: ${region} (Mumbai) — top-right dropdown

  3. Left menu → "Account dashboard" → "Request production access"
     (Ya "Get set up" → "Request production access")

  4. Form mein likho:
     - Mail type: Transactional
     - Website: https://apnaintern.in
     - Use case: OTP login, password reset, registration confirmations,
       certificate notifications for internship portal users.
     - Expected volume: 500–5000 emails/month (adjust as needed)
     - Bounce/complaint handling: We use verified domain apnaintern.in

  5. Domain verify (recommended, ek baar DNS):
     SES → Verified identities → Create → Domain → apnaintern.in
     DNS mein SES ke TXT/CNAME records add karo (domain host par)

  6. Approval ke baad — kuch code change nahi:
     Production OTP already uses SES API on Vercel.
     Sab users ko OTP automatically chalega.

Abhi (sandbox):
  - apnaintern.in@gmail.com → SES se OTP aata hai
  - Baaki emails → SMTP fallback try hota hai (Gmail par kabhi deliver nahi hota)

Checklist script: npm run aws:ses:checklist
`);
