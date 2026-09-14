#!/usr/bin/env node
/**
 * Apply site CMS tables (popups, contacts, WhatsApp) to RDS.
 * Usage:
 *   DATABASE_URL='postgresql://user:pass@host:5432/db?sslmode=require' node aws/scripts/apply-site-cms-rds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const files = [
  "aws/scripts/50-rds-site-popups.sql",
  "aws/scripts/51-rds-site-contacts.sql",
];

async function main() {
  const raw = loadAwsRdsDatabaseUrl();
  const client = new pg.Client(pgClientConfig(raw));

  await client.connect();
  const info = await client.query("SELECT current_database() AS db, current_user AS usr");
  console.log(`Connected: db=${info.rows[0].db} user=${info.rows[0].usr}\n`);

  for (const rel of files) {
    const fp = path.join(root, rel);
    const sql = fs.readFileSync(fp, "utf8");
    process.stdout.write(`→ ${rel} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate key/i.test(msg)) {
        console.log(`warn (${msg.slice(0, 100)})`);
      } else {
        console.error(`\nFAILED: ${msg}`);
        throw err;
      }
    }
  }

  const check = await client.query("SELECT to_regclass('public.site_popups') AS t");
  console.log(`\n✅ site_popups: ${check.rows[0].t || "MISSING"}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
