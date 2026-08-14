#!/usr/bin/env node
/**
 * Apply notification tables + RPCs on RDS (safe for AWS RDS without Supabase auth schema).
 *
 * Usage:
 *   DATABASE_URL='postgresql://user:pass@database-1-instance-1....rds.amazonaws.com:5432/postgres?sslmode=require' \
 *     node aws/scripts/apply-notifications-rds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const files = [
  "aws/scripts/54-rds-notifications-columns.sql",
  "aws/scripts/53-rds-notifications-setup.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
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
    SELECT
      to_regclass('public.notifications') AS notifications,
      to_regclass('public.notification_deliveries') AS deliveries,
      EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_publish_notification'
      ) AS publish_rpc
  `);
  const c = checks.rows[0];
  console.log("\n✅ Notification setup check:");
  console.log(`   notifications table: ${c.notifications || "MISSING"}`);
  console.log(`   notification_deliveries: ${c.deliveries || "MISSING"}`);
  console.log(`   admin_publish_notification RPC: ${c.publish_rpc ? "yes" : "NO"}`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
