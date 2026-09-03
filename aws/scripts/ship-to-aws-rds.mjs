#!/usr/bin/env node
/**
 * Ship site CMS + notifications schema to AWS RDS (PostgreSQL engine).
 *
 *   npm run aws:rds:ship
 *
 * Requires DATABASE_URL or AWS_RDS_* secrets (see .env.awsrds.example).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

async function verify() {
  const url = loadAwsRdsDatabaseUrl();
  const host = url.split("@")[1]?.split("/")[0] || "?";
  console.log(`\n→ Verifying AWS RDS: ${host}`);
  const client = new pg.Client({ ...pgClientConfig(url), connectionTimeoutMillis: 20000 });
  await client.connect();
  const { rows } = await client.query(`
    SELECT
      to_regclass('public.notifications') AS notifications,
      to_regclass('public.notification_deliveries') AS deliveries,
      to_regclass('public.site_popups') AS site_popups,
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'admin_publish_notification'
      ) AS publish_rpc
  `);
  console.log("✅ RDS check:", rows[0]);
  await client.end();
}

async function main() {
  const url = loadAwsRdsDatabaseUrl();
  process.env.DATABASE_URL = url;
  console.log("🚀 Shipping schema to AWS RDS…\n");
  await runNode(path.join(root, "aws/scripts/apply-notifications-rds.mjs"));
  await runNode(path.join(root, "aws/scripts/apply-site-cms-rds.mjs"));
  await runNode(path.join(root, "aws/scripts/apply-admin-registration-rds.mjs"));
  await verify();
  console.log("\n✅ AWS RDS ship complete (notifications + popups + contacts + admin registration).");
  console.log("Next: npm run aws:lambda:deploy  (point Lambda DATABASE_URL to this RDS)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
