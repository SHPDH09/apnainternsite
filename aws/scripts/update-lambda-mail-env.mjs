#!/usr/bin/env node
/**
 * Merge Hostinger SMTP mail env into ezyintern-api-staging Lambda (preserves other vars).
 * Used by GitHub Actions after code deploy.
 */
import { execFileSync } from "node:child_process";

const fn = process.env.LAMBDA_FUNCTION_NAME || "ezyintern-api-staging";
const region = process.env.AWS_DEFAULT_REGION || "ap-south-1";

const smtpHost = process.env.SMTP_HOST || "brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com";
const smtpUser = process.env.SMTP_USER || "inp-3u5sedrqj7kqwjazxwmph2th";
const smtpPass = process.env.SMTP_PASS || "";
const mailFromAddress = process.env.MAIL_FROM_ADDRESS || "info@apnaintern.in";

if (!smtpPass) {
  console.error("SMTP_PASS missing — set GitHub secret SMTP_PASS or export locally");
  process.exit(1);
}

function awsJson(args) {
  const out = execFileSync("aws", args, { encoding: "utf8" });
  return JSON.parse(out);
}

const current = awsJson([
  "lambda",
  "get-function-configuration",
  "--function-name",
  fn,
  "--region",
  region,
  "--output",
  "json",
]);

const vars = { ...(current.Environment?.Variables || {}) };
Object.assign(vars, {
  SMTP_HOST: smtpHost,
  SMTP_PORT: "587",
  SMTP_USER: smtpUser,
  SMTP_PASS: smtpPass,
  MAIL_FROM: `Apna Intern <${mailFromAddress}>`,
  MAIL_FROM_ADDRESS: mailFromAddress,
  USE_SES_API: "false",
});

const payload = JSON.stringify({ Variables: vars });
awsJson([
  "lambda",
  "update-function-configuration",
  "--function-name",
  fn,
  "--region",
  region,
  "--environment",
  payload,
  "--output",
  "json",
]);

console.log(`Updated Lambda mail env on ${fn} (${region})`);
// Trigger Lambda deploy with correct SMTP credentials
