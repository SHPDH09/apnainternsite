#!/usr/bin/env node
/** Apply missing Supabase migrations to RDS (gap-fill after CSV import). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadDatabaseUrl() {
  for (const file of [".env.awsrds.local", ".env.awsrds"]) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL not found in .env.awsrds.local");
}

const files = [
  "supabase/update_payment_schema.sql",
  "supabase/migrations/20260709100000_engineering_university_configs.sql",
  "aws/scripts/04-rds-auth-helpers.sql",
  "aws/scripts/05-rds-directory-rpcs.sql",
  "aws/scripts/06-rds-admin-performance-rpcs.sql",
  "aws/scripts/07-rds-text-id-fixes.sql",
  "aws/scripts/08-rds-fees-and-leads.sql",
  "aws/scripts/09-rds-admin-data-fixes.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
  "supabase/migrations/20260605120000_notification_management.sql",
  "aws/scripts/50-rds-site-popups.sql",
  "aws/scripts/51-rds-site-contacts.sql",
  "aws/scripts/12-rds-safe-metadata-json.sql",
  "aws/scripts/18-rds-fix-payment-enrollment.sql",
  "aws/scripts/19-rds-fix-password-text-id.sql",
  "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql",
  "aws/scripts/28-rds-student-data-upload.sql",
  "aws/scripts/33-rds-student-data-upload-dup-delete.sql",
  "aws/scripts/34-rds-student-data-upload-delete-harden.sql",
  "aws/scripts/35-rds-student-data-upload-history-recover.sql",
  "aws/scripts/36-rds-student-data-upload-id-type-fix.sql",
];

async function main() {
  const raw = loadDatabaseUrl();
  const client = new pg.Client({
    connectionString: raw.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(raw) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log("Connected to RDS — applying gap-fill migrations…\n");

  for (const rel of files) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) {
      console.warn(`Skip missing: ${rel}`);
      continue;
    }
    const sql = fs.readFileSync(fp, "utf8");
    process.stdout.write(`→ ${rel} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate key|does not exist/i.test(msg)) {
        console.log(`warn (${msg.slice(0, 80)})`);
      } else {
        console.error(`\nFAILED ${rel}:`, msg);
        throw err;
      }
    }
  }

  await client.end();
  console.log("\n✅ RDS gap-fill complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
