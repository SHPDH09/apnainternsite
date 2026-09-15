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
import {
  STAFF_OFFICE_ADMIN_RPC_FILES,
  compareAwsSqlFilenames,
} from "./rds-sql-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = path.join(root, "aws/scripts");

const extraFiles = [
  "supabase/update_payment_schema.sql",
  "supabase/migrations/20260709100000_engineering_university_configs.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
  "supabase/migrations/20260605120000_notification_management.sql",
];

const warnPattern =
  /already exists|duplicate key|does not exist|cannot drop|multiple primary keys|cannot change return type|42P13|42710|42701|operator does not exist|25P02/i;

function listAwsSqlFiles() {
  return fs
    .readdirSync(scriptsDir)
    .filter((f) => /^\d{2}-.*\.sql$/i.test(f))
    .sort(compareAwsSqlFilenames)
    .map((f) => path.join("aws/scripts", f));
}

async function applySqlFile(client, rel) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn(`Skip missing: ${rel}`);
    return "skip";
  }
  const sql = fs.readFileSync(fp, "utf8");
  process.stdout.write(`→ ${rel} … `);
  try {
    await client.query(sql);
    console.log("ok");
    return "ok";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may not be in a transaction */
    }
    if (warnPattern.test(msg)) {
      console.log(`warn (${msg.slice(0, 100)})`);
      return "warn";
    }
    console.error(`\nFAILED ${rel}: ${msg}`);
    throw err;
  }
}

/** Re-apply ensure + admin RPC SQL when apply-all ran 83 before 85 on a prior deploy. */
async function ensureStaffOfficeAdminRpcs(client) {
  const { rows } = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_staff_attendance_office'
    ) AS ok
  `);
  if (rows[0]?.ok) return;

  console.log("\n→ staff office admin RPC hotfix (85 + 83) …");
  for (const rel of STAFF_OFFICE_ADMIN_RPC_FILES) {
    await applySqlFile(client, rel);
  }
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
    const status = await applySqlFile(client, rel);
    if (status === "ok") ok += 1;
    if (status === "warn") warn += 1;
  }

  await ensureStaffOfficeAdminRpcs(client);

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
      ) AS add_registration_rpc,
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_staff_attendance_office'
      ) AS staff_office_upsert_rpc
  `);
  console.log("\n✅ Apply-all complete:", { applied: ok, warnings: warn });
  console.log("Checks:", checks.rows[0]);

  if (!checks.rows[0]?.staff_office_upsert_rpc) {
    console.error("FAIL: admin_upsert_staff_attendance_office still missing after apply-all");
    await client.end();
    process.exit(1);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
