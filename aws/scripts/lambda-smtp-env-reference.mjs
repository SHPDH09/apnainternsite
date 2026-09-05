#!/usr/bin/env node
/**
 * Print Lambda environment variables for Hostinger OTP mail (info@apnaintern.in).
 * Set these in AWS Console → Lambda → ezyintern-api-staging → Configuration → Environment variables
 * Or redeploy: npm run aws:lambda:deploy (with SMTP_* in .env.awsrds.local)
 *
 * Usage: node aws/scripts/lambda-smtp-env-reference.mjs
 */
console.log(`
Lambda mail environment (Hostinger — apnaintern.in)
===================================================
SMTP_HOST          smtp.hostinger.com
SMTP_PORT          587
SMTP_USER          info@apnaintern.in
SMTP_PASS          (your Hostinger mailbox password — set in Console, never commit)
MAIL_FROM          Apna Intern <info@apnaintern.in>
MAIL_FROM_ADDRESS  info@apnaintern.in
USE_SES_API        false

After saving, retry admin/student OTP login.
`);
