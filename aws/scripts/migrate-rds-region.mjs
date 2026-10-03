#!/usr/bin/env node
/**
 * Mumbai (ap-south-1) → Hyderabad (ap-south-2) RDS full data clone.
 *
 *   npm run aws:rds:migrate-region
 *
 * Secrets (Cursor Environment or .env.awsrds.local — never commit):
 *   SOURCE — current DB: DATABASE_URL or AWS_RDS_* (defaults to Mumbai staging host)
 *   TARGET — new cluster:
 *     TARGET_DATABASE_URL=postgresql://postgres:PASSWORD@database-1.cluster-cpy4aaca6mfv.ap-south-2.rds.amazonaws.com:5432/ezyintern?sslmode=require
 *     or AWS_RDS_TARGET_HOST / USER / PASSWORD / DATABASE
 *
 * IAM auth URLs from the AWS console are NOT postgres URLs. Use the master password or
 * `aws rds generate-db-auth-token` with AWS CLI credentials instead.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAwsRdsDatabaseUrl, loadAwsRdsTargetDatabaseUrl } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.awsrds.local"));

const restoreOnly = args.includes("--restore");
let sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
let targetUrl = process.env.TARGET_DATABASE_URL?.trim();

if (!restoreOnly) {
  try {
    sourceUrl = sourceUrl || loadAwsRdsDatabaseUrl();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error("\nSet SOURCE_DATABASE_URL or Mumbai AWS_RDS_PASSWORD in Environment secrets.");
    process.exit(1);
  }
}

try {
  targetUrl = targetUrl || loadAwsRdsTargetDatabaseUrl();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  console.error(
    "\nSet TARGET_DATABASE_URL or AWS_RDS_TARGET_PASSWORD (+ HOST) for Hyderabad cluster."
  );
  process.exit(1);
}

process.env.SOURCE_DATABASE_URL = sourceUrl || "";
process.env.TARGET_DATABASE_URL = targetUrl;

const script = path.join(root, "aws/scripts/migrate-rds-region.sh");
const r = spawnSync("bash", [script, ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
