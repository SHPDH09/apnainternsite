#!/usr/bin/env node
/** Cloudflare Workers Git deploy — pass mail vars from build env when present. */
import { execSync } from "node:child_process";

const vars = [];
const smtpPass =
  process.env.SMTP_PASS?.trim() ||
  process.env.HOSTINGER_SMTP_PASS?.trim() ||
  process.env.MAIL_SMTP_PASS?.trim();

if (smtpPass) vars.push(`SMTP_PASS=${smtpPass}`);
if (process.env.SMTP_USER?.trim()) vars.push(`SMTP_USER=${process.env.SMTP_USER.trim()}`);
if (process.env.SMTP_HOST?.trim()) vars.push(`SMTP_HOST=${process.env.SMTP_HOST.trim()}`);
if (process.env.SMTP_PORT?.trim()) vars.push(`SMTP_PORT=${process.env.SMTP_PORT.trim()}`);
if (process.env.MAIL_FROM_ADDRESS?.trim()) {
  vars.push(`MAIL_FROM_ADDRESS=${process.env.MAIL_FROM_ADDRESS.trim()}`);
}

const varArgs = vars.map((v) => `--var ${v}`).join(" ");
const cmd = `npx wrangler deploy ${varArgs}`.trim();

console.log("[wrangler-deploy-ci]", cmd.replace(/SMTP_PASS=[^\s]+/, "SMTP_PASS=***"));
execSync(cmd, { stdio: "inherit", env: process.env });
