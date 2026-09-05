#!/usr/bin/env node
/**
 * Write .env.awsrds.local from Cursor Environment secrets (injected as env vars).
 * Called from .cursor/environment.json install hook.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".env.awsrds.local");

/** @type {string[]} */
const lines = ["# Auto-generated from Cursor Environment secrets — do not commit"];

const awsKey = process.env.AWS_ACCESS_KEY_ID?.trim();
const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
if (awsKey && awsSecret) {
  lines.push(`AWS_ACCESS_KEY_ID=${awsKey}`);
  lines.push(`AWS_SECRET_ACCESS_KEY=${awsSecret}`);
  lines.push(`AWS_DEFAULT_REGION=${process.env.AWS_DEFAULT_REGION?.trim() || "ap-south-1"}`);
}

let databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.AWS_RDS_DATABASE_URL?.trim() ||
  process.env.AWS_RDS_URL?.trim();

if (!databaseUrl) {
  const host = process.env.AWS_RDS_HOST?.trim();
  const user = process.env.AWS_RDS_USER?.trim();
  const pass = process.env.AWS_RDS_PASSWORD?.trim();
  const db = process.env.AWS_RDS_DATABASE?.trim() || "postgres";
  const port = process.env.AWS_RDS_PORT?.trim() || "5432";
  if (host && user && pass) {
    databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?sslmode=require`;
  }
}

if (databaseUrl) {
  lines.push(`DATABASE_URL=${databaseUrl.replace(/^["']|["']$/g, "")}`);
}

const smtpHost = process.env.SMTP_HOST?.trim();
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const mailFrom = process.env.MAIL_FROM?.trim();
const mailFromAddress = process.env.MAIL_FROM_ADDRESS?.trim();
if (smtpHost) lines.push(`SMTP_HOST=${smtpHost}`);
if (smtpUser) lines.push(`SMTP_USER=${smtpUser}`);
if (smtpPass) lines.push(`SMTP_PASS=${smtpPass}`);
if (mailFrom) lines.push(`MAIL_FROM=${mailFrom}`);
if (mailFromAddress) lines.push(`MAIL_FROM_ADDRESS=${mailFromAddress}`);
if (smtpPass) lines.push("USE_SES_API=false");

if (lines.length === 1) {
  console.log("[cloud-agent-env] No AWS/RDS secrets in environment — skip .env.awsrds.local");
  process.exit(0);
}

lines.push(
  "LOCAL_SUPABASE=true",
  "LOCAL_JWT_SECRET=" + (process.env.LOCAL_JWT_SECRET || "change-me-local-secret"),
  "VITE_SUPABASE_URL=http://localhost:8080",
  "VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key",
  "RDS_RPC_OPEN=true",
  "VITE_SITE_API_ORIGIN=http://localhost:8080",
  "VITE_PUBLIC_APP_URL=http://localhost:8080"
);

fs.writeFileSync(out, lines.join("\n") + "\n", { mode: 0o600 });
console.log("[cloud-agent-env] Wrote .env.awsrds.local from environment secrets");
