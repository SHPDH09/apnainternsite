#!/usr/bin/env node
/**
 * Apply ALL AWS RDS SQL scripts in numeric order (+ key supabase gap-fill files).
 *
 * Usage:
 *   npm run aws:rds:apply-all
 *   DATABASE_URL='postgresql://...' node aws/scripts/apply-all-rds-sql.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = path.join(root, "aws/scripts");

const extraFiles = [
  "supabase/update_payment_schema.sql",
  "supabase/migrations/20260709100000_engineering_university_configs.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
  "supabase/migrations/20260605120000_notification_management.sql",
];

function listAwsSqlFiles() {
  return fs
    .readdirSync(scriptsDir)
    .filter((f) => /^\d{2}-.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join("aws/scripts", f));
}

async function main() {
  const raw = loadAwsRdsDatabaseUrl();
  const client = new pg.Client(pgClientConfig(raw));
  await client.connect();

  const info = await client.query(
    "SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host"
  );
  console.log(`Connected: ${info.rows[0].usr}@${info.rows[0].db} (${info.rows[0].host})\n`);

  const files = [...listAwsSqlFiles(), ...extraFiles];
  let ok = 0;
  let warn = 0;

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
      ok += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate key|does not exist|cannot drop|multiple primary keys/i.test(msg)) {
        console.log(`warn (${msg.slice(0, 100)})`);
        warn += 1;
      } else {
        console.error(`\nFAILED ${rel}: ${msg}`);
        throw err;
      }
    }
  }

  const checks = await client.query(`
    SELECT
      to_regclass('public.student_data_uploads') AS student_data_uploads,
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_student_data_upload_import'
      ) AS upload_import_rpc,
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_create_minimal_student_registration'
      ) AS add_registration_rpc
  `);
  console.log("\n✅ Apply-all complete:", { applied: ok, warnings: warn });
  console.log("Checks:", checks.rows[0]);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
