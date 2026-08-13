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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/^["']|["']$/g, "");
  for (const file of [".env.awsrds.local", ".env.awsrds", ".env"]) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("Set DATABASE_URL or add it to .env.awsrds.local");
}

const files = [
  "aws/scripts/50-rds-site-popups.sql",
  "aws/scripts/51-rds-site-contacts.sql",
];

async function main() {
  const raw = loadDatabaseUrl();
  const useSsl = /sslmode=require/i.test(raw) || /rds\.amazonaws\.com/i.test(raw);
  const client = new pg.Client({
    connectionString: raw.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, ""),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

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
