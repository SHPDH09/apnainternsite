#!/usr/bin/env node
/**
 * Copy RDS bootstrap SQL into aws/server/sql for Vercel rds-portal (class-link, certs, etc.).
 * Registration SQL is embedded in registration-bootstrap-sql.ts — not required here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "aws/scripts");
const outDir = path.join(root, "aws/server/sql");

/** Basenames referenced by rds-portal bootstrap retries (keep bundle small for cold start). */
const VERCEL_RDS_BOOTSTRAP_SQL = [
  "12-rds-safe-metadata-json.sql",
  "18-rds-fix-payment-enrollment.sql",
  "19-rds-fix-password-text-id.sql",
  "20-rds-fix-admin-create-registration-text-meta.sql",
  "21-rds-admin-create-registration-uuid-id.sql",
  "27-rds-certificates-issue-and-directory-fix.sql",
  "29-rds-admin-class-link-rpc.sql",
  "38-rds-verify-certificate-public.sql",
  "47-rds-verify-course-certificate-public.sql",
];

fs.mkdirSync(outDir, { recursive: true });

let count = 0;
for (const name of VERCEL_RDS_BOOTSTRAP_SQL) {
  const src = path.join(scriptsDir, name);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ skip missing bootstrap SQL: ${name}`);
    continue;
  }
  fs.copyFileSync(src, path.join(outDir, name));
  count += 1;
}

console.log(`✅ Vercel bootstrap SQL → aws/server/sql (${count} files)`);
