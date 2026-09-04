#!/usr/bin/env node
/**
 * Request Amazon SES email verification (ap-south-1).
 * Usage:
 *   node aws/scripts/ses-verify-email.mjs rk331159@gmail.com
 *   node aws/scripts/ses-verify-email.mjs noreply@apnaintern.in
 *
 * Requires AWS CLI credentials with ses:VerifyEmailIdentity (or admin).
 * Check inbox and click the AWS verification link, then retry sending mail.
 */
import { spawnSync } from "node:child_process";

const email = process.argv[2]?.trim();
const region = process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1";

if (!email || !email.includes("@")) {
  console.error("Usage: node aws/scripts/ses-verify-email.mjs <email@example.com>");
  process.exit(1);
}

console.log(`Requesting SES verification for ${email} in ${region}…`);

const result = spawnSync(
  "aws",
  ["ses", "verify-email-identity", "--email-address", email, "--region", region],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "aws CLI failed");
  console.error(
    "\nManual fix: AWS Console → Amazon SES → Verified identities → Create identity → Email →",
    email
  );
  process.exit(result.status || 1);
}

console.log(`Verification email sent to ${email}. Open the AWS link in that inbox, then retry Comms.`);
console.log(
  "For production: verify domain apnaintern.in in SES and request production access (exit sandbox)."
);
