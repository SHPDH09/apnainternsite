#!/usr/bin/env node
/**
 * Apply Student Data Upload schema + RPCs on AWS RDS.
 *
 * Usage:
 *   npm run aws:rds:student-data-upload
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const files = [
  "aws/scripts/12-rds-safe-metadata-json.sql",
  "aws/scripts/18-rds-fix-payment-enrollment.sql",
  "aws/scripts/28-rds-student-data-upload.sql",
  "aws/scripts/33-rds-student-data-upload-dup-delete.sql",
  "aws/scripts/34-rds-student-data-upload-delete-harden.sql",
  "aws/scripts/35-rds-student-data-upload-history-recover.sql",
  "aws/scripts/36-rds-student-data-upload-id-type-fix.sql",
];

async function main() {
  const raw = loadAwsRdsDatabaseUrl();
  const client = new pg.Client(pgClientConfig(raw));
  await client.connect();
  console.log("Applying Student Data Upload SQL…\n");

  for (const rel of files) {
    const fp = path.join(root, rel);
    const sql = fs.readFileSync(fp, "utf8");
    process.stdout.write(`→ ${rel} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate key|does not exist|cannot drop/i.test(msg)) {
        console.log(`warn (${msg.slice(0, 100)})`);
      } else {
        console.error(`\nFAILED ${rel}: ${msg}`);
        throw err;
      }
    }
  }

  const check = await client.query(`
    SELECT
      to_regclass('public.student_data_uploads') AS t,
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_student_data_upload_save_history'
      ) AS save_history
  `);
  console.log("\n✅ Student Data Upload check:", check.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
