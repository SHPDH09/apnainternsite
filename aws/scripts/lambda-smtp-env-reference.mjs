#!/usr/bin/env node
/**
 * Print Lambda environment variables for AWS SES Mail Manager SMTP (ingress endpoint).
 * Set these in AWS Console → Lambda → ezyintern-api-staging → Configuration → Environment variables
 * Or redeploy: npm run aws:lambda:deploy (with SMTP_* in .env.awsrds.local)
 *
 * Usage: node aws/scripts/lambda-smtp-env-reference.mjs
 */
console.log(`
Lambda mail environment (AWS SES Mail Manager — ingress endpoint)
================================================================
SMTP_HOST          brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com
SMTP_PORT          587
SMTP_USER          (Mail Manager ingress username, e.g. inp-xxxxxxxx)
SMTP_PASS          (Mail Manager SMTP password — set in Console, never commit)
MAIL_FROM          Apna Intern <info@apnaintern.in>
MAIL_FROM_ADDRESS  info@apnaintern.in
USE_SES_API        false
SES_REGION         us-east-1

After saving, retry admin/student login OTP.
`);
