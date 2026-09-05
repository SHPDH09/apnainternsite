#!/usr/bin/env node
/**
 * Print steps to exit Amazon SES sandbox so OTP/transactional mail reaches all users.
 *
 * Current behaviour in sandbox: only verified recipient addresses receive mail.
 * That is why admin (apnaintern.in@gmail.com) may get OTP but other staff/students do not.
 *
 * Usage: node aws/scripts/ses-production-checklist.mjs [recipient@example.com]
 */
import { spawnSync } from 'node:child_process';

const region = process.env.SES_REGION || process.env.AWS_REGION || 'ap-south-1';
const sampleRecipient = process.argv[2]?.trim() || 'your-user@gmail.com';

console.log(`
Amazon SES — production mail checklist (${region})
================================================

Problem: OTP shows "sent" but inbox is empty for most users.
Cause:   SES account is usually in SANDBOX — mail only delivers to verified recipients.

Do these once (AWS Console → Amazon SES, region ${region}):

1. Verified identities
   - Verify DOMAIN: apnaintern.in (recommended) OR at least noreply@apnaintern.in
   - DNS: add the TXT/CNAME records SES gives you on your domain host

2. Request production access (exit sandbox)
   - SES → Account dashboard → "Request production access"
   - Use case: transactional OTP + registration + certificate notifications
   - Expected volume: your monthly estimate
   - After approval, mail can go to ANY recipient (e.g. ${sampleRecipient})

3. Redeploy Lambda after code update
   - npm run aws:lambda:deploy
   - Ensures SES API + IAM permissions are active

Quick test (verify one inbox while still in sandbox):
  npm run aws:ses:verify -- ${sampleRecipient}
  Then click the AWS link in that inbox.

Verify sender identity:
  npm run aws:ses:verify -- noreply@apnaintern.in
`);

const result = spawnSync(
  'aws',
  ['sesv2', 'get-account', '--region', region],
  { encoding: 'utf8' }
);

if (result.status === 0 && result.stdout) {
  const sandbox = /ProductionAccessEnabled[\s\S]*?false/i.test(result.stdout);
  console.log(sandbox ? '\nStatus: SANDBOX (production access not enabled)\n' : '\nStatus: production access appears enabled\n');
} else {
  console.log('\n(Could not query SES account — run with AWS CLI credentials configured.)\n');
}
