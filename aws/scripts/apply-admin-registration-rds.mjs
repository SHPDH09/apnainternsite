#!/usr/bin/env node
/**
 * Apply admin Add Registration RPC + prerequisites on AWS RDS.
 *
 * Usage:
 *   npm run aws:rds:admin-registration
 *   DATABASE_URL='postgresql://...' node aws/scripts/apply-admin-registration-rds.mjs
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
  "aws/scripts/19-rds-fix-password-text-id.sql",
  "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql",
];

async function main() {
  const raw = loadAwsRdsDatabaseUrl();
  const client = new pg.Client(pgClientConfig(raw));

  await client.connect();
  const info = await client.query(
    "SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host"
  );
  console.log(`Connected: ${info.rows[0].usr}@${info.rows[0].db} (${info.rows[0].host})\n`);

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
      if (/already exists|duplicate key|does not exist|cannot drop/i.test(msg)) {
        console.log(`warn (${msg.slice(0, 120)})`);
      } else {
        console.error(`\nFAILED ${rel}: ${msg}`);
        throw err;
      }
    }
  }

  const checks = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'admin_create_minimal_student_registration'
        AND pg_get_function_identity_arguments(p.oid) LIKE '%p_registration_source%'
    ) AS has_full_rpc,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'caller_can_manage_student_directory'
    ) AS has_caller_check,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'safe_text_to_jsonb'
    ) AS has_safe_json
  `);
  const c = checks.rows[0];
  console.log("\n✅ Admin registration setup check:");
  console.log(`   admin_create_minimal_student_registration (13-param): ${c.has_full_rpc ? "yes" : "NO"}`);
  console.log(`   caller_can_manage_student_directory: ${c.has_caller_check ? "yes" : "NO"}`);
  console.log(`   safe_text_to_jsonb: ${c.has_safe_json ? "yes" : "NO"}`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
