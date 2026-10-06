#!/usr/bin/env node
/**
 * Push all required Apna Intern production env vars to Vercel (no local .env files needed).
 * Usage: VERCEL_TOKEN=... [SUPABASE_DB_PW_B64=...] node scripts/vercel-set-all-production-env.mjs
 *
 * Reads optional secrets from the environment and from .env.vercel.prod / .env.vercel.production
 * once (then delete those files locally).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.VERCEL_TOKEN?.trim();
if (!TOKEN) {
  console.error("VERCEL_TOKEN is required");
  process.exit(1);
}

const PROJECT_ID =
  process.env.VITE_SUPABASE_PROJECT_ID?.trim() || "hflapipozwwwinbbfpuh";
const SITE_ORIGIN =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.SITE_URL?.trim() ||
  "https://apnaintern.in";

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function mergeLocalFiles() {
  return {
    ...parseEnvFile(path.join(root, ".env.vercel.production")),
    ...parseEnvFile(path.join(root, ".env.vercel.prod")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };
}

function poolerDatabaseUrl(password) {
  const enc = encodeURIComponent(password);
  return `postgresql://postgres.${PROJECT_ID}:${enc}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require`;
}

function resolveDatabaseUrl(fileVals) {
  const direct = process.env.DATABASE_URL?.trim() || fileVals.DATABASE_URL?.trim();
  if (direct && /rds\.amazonaws\.com/i.test(direct)) {
    return direct;
  }
  if (direct && /\.supabase\.com|pooler\.supabase/i.test(direct)) {
    return direct;
  }
  const b64 = process.env.SUPABASE_DB_PW_B64?.trim();
  if (b64) {
    const pass = Buffer.from(b64, "base64").toString("utf8");
    return poolerDatabaseUrl(pass);
  }
  if (direct) return direct;
  throw new Error("Set DATABASE_URL or SUPABASE_DB_PW_B64 (or keep DATABASE_URL in .env.vercel.prod briefly)");
}

function pick(...keys) {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return "";
}

function upsert(key, value, environments) {
  for (const env of environments) {
    try {
      execSync(`npx vercel env rm "${key}" ${env} --yes --token "${TOKEN}"`, {
        stdio: "pipe",
        cwd: root,
      });
    } catch {
      /* missing */
    }
    execSync(
      `npx vercel env add "${key}" ${env} --token "${TOKEN}" --yes`,
      {
        input: value,
        stdio: ["pipe", "inherit", "inherit"],
        cwd: root,
      }
    );
    console.log(`  ✓ ${key} (${env})`);
  }
}

const fileVals = mergeLocalFiles();
const dbUrl = resolveDatabaseUrl(fileVals);

const jwtSecret =
  pick("LOCAL_JWT_SECRET", "JWT_SECRET") ||
  fileVals.LOCAL_JWT_SECRET?.trim() ||
  "apnaintern-vercel-jwt-" + PROJECT_ID.slice(0, 8);

/** @type {Record<string, string>} */
const STAGING_RDS_HOST =
  "ezyintern-staging-db.c5makww6eq8y.ap-south-1.rds.amazonaws.com";

const vars = {
  // ── Postgres (Vercel serverless → Supabase pooler or AWS RDS) ──
  DATABASE_URL: dbUrl,
  RDS_IAM_AUTH: "false",
  RDS_RPC_OPEN: "true",
  LOCAL_SUPABASE: "true",
  SUPABASE_URL: `https://${PROJECT_ID}.supabase.co`,
  RDS_ANON_KEY: "local-anon-key",

  // ── Local JWT auth shim (/auth/v1/token) ──
  LOCAL_JWT_SECRET: jwtSecret,

  // ── Vite build (browser) — same-origin portal ──
  VITE_SUPABASE_URL: SITE_ORIGIN.replace(/\/$/, ""),
  VITE_SUPABASE_PUBLISHABLE_KEY: "local-anon-key",
  VITE_SUPABASE_PROJECT_ID: PROJECT_ID,
  VITE_PUBLIC_APP_URL: SITE_ORIGIN.replace(/\/$/, ""),
  VITE_PUBLIC_SITE_ORIGIN: SITE_ORIGIN.replace(/\/$/, ""),

  // ── Site / mail metadata ──
  PUBLIC_SITE_URL: SITE_ORIGIN.replace(/\/$/, ""),
  SITE_URL: SITE_ORIGIN.replace(/\/$/, ""),

  // ── AWS (SES / S3 from serverless) ──
  AWS_DEFAULT_REGION: pick("AWS_DEFAULT_REGION", "AWS_REGION") || "ap-south-1",
  AWS_REGION: pick("AWS_REGION", "AWS_DEFAULT_REGION") || "ap-south-1",
  S3_BUCKET_LOGOS: pick("S3_BUCKET_LOGOS") || "ezyintern-staging-logos",
  S3_BUCKET_CONSENT_FORMS:
    pick("S3_BUCKET_CONSENT_FORMS") || "ezyintern-staging-consent-forms",
  S3_BUCKET_LEARNING_MATERIALS:
    pick("S3_BUCKET_LEARNING_MATERIALS") || "ezyintern-staging-learning-materials",
};

// Hyderabad production: S3 buckets live in ap-south-2 while AWS_REGION often stays ap-south-1 (SES/Lambda).
if (/ap-south-2|cpy4aaca6mfv/i.test(dbUrl)) {
  vars.S3_BUCKET_LOGOS_REGION = pick("S3_BUCKET_LOGOS_REGION") || "ap-south-2";
  vars.S3_BUCKET_CONSENT_FORMS_REGION = pick("S3_BUCKET_CONSENT_FORMS_REGION") || "ap-south-2";
  vars.S3_BUCKET_LEARNING_MATERIALS_REGION =
    pick("S3_BUCKET_LEARNING_MATERIALS_REGION") || "ap-south-2";
}

if (/ezyintern-staging-db/i.test(dbUrl) || pick("AWS_RDS_HOST") === STAGING_RDS_HOST) {
  vars.AWS_RDS_HOST = pick("AWS_RDS_HOST") || STAGING_RDS_HOST;
  vars.AWS_RDS_USER = pick("AWS_RDS_USER") || "ezyintern";
  vars.AWS_RDS_DATABASE = pick("AWS_RDS_DATABASE") || "ezyintern";
  vars.AWS_RDS_PORT = pick("AWS_RDS_PORT") || "5432";
  const rdsPass = pick("AWS_RDS_PASSWORD", "RDS_PASSWORD");
  if (rdsPass) vars.AWS_RDS_PASSWORD = rdsPass;
}

const optionalKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "HOSTINGER_SMTP_PASS",
  "MAIL_FROM",
  "MAIL_FROM_ADDRESS",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "VITE_RAZORPAY_KEY_ID",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "GEMINI_API_KEY",
  "VITE_GEMINI_API_KEY",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "RDS_APPLY_SECRET",
  "ADMIN_BOOTSTRAP_CODE",
];

for (const key of optionalKeys) {
  const v = pick(key) || fileVals[key]?.trim();
  if (v) vars[key] = v;
}

if (!vars.VITE_RAZORPAY_KEY_ID && vars.RAZORPAY_KEY_ID) {
  vars.VITE_RAZORPAY_KEY_ID = vars.RAZORPAY_KEY_ID;
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  vars.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
} else if (process.env.SUPABASE_SKEY_B64?.trim()) {
  try {
    const decoded = Buffer.from(process.env.SUPABASE_SKEY_B64, "base64").toString("utf8").trim();
    if (decoded.startsWith("eyJ")) vars.SUPABASE_SERVICE_ROLE_KEY = decoded;
  } catch {
    /* ignore truncated secret */
  }
}

const prodEnvs = ["production"];
const previewEnvs = ["preview", "production"];

console.log("Upserting Vercel env (production server + preview/build VITE_*)…\n");

for (const [key, value] of Object.entries(vars)) {
  if (!value) continue;
  const targets = key.startsWith("VITE_") ? previewEnvs : prodEnvs;
  upsert(key, value, targets);
}

// Remove legacy vars that break same-origin API routing
for (const legacy of ["VITE_SITE_API_ORIGIN", "LAMBDA_API_URL", "RDS_REST_URL"]) {
  for (const env of ["production", "preview"]) {
    try {
      execSync(`npx vercel env rm "${legacy}" ${env} --yes --token "${TOKEN}"`, {
        stdio: "pipe",
        cwd: root,
      });
      console.log(`  ✗ removed ${legacy} (${env})`);
    } catch {
      /* not set */
    }
  }
}

const deletePaths = [
  path.join(root, ".env.local"),
  path.join(root, ".env.vercel.prod"),
  path.join(root, ".env.vercel.production"),
];
for (const p of deletePaths) {
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Deleted local file ${path.basename(p)}`);
  }
}

console.log("\n✅ Vercel production env synced. Redeploy production for VITE_* build embeds.");
