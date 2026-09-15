#!/usr/bin/env node
/**
 * Apply staff attendance office schema + admin RPCs to RDS.
 * Usage: DATABASE_URL='postgresql://...' node aws/scripts/apply-staff-attendance-offices-rds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = [
  "aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql",
  "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql",
  "aws/scripts/84-rds-staff-office-assignments-fix.sql",
  "aws/scripts/82-rds-staff-attendance-offices.sql",
];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, ""),
  ssl: /rds\.amazonaws\.com/i.test(url) ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
for (const rel of files) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn("skip (missing):", rel);
    continue;
  }
  const sql = fs.readFileSync(fp, "utf8");
  try {
    await client.query(sql);
    console.log("ok:", rel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate key|does not exist|cannot change return type|42P13|42710|42701/i.test(msg)) {
      console.warn("warn:", rel, msg.slice(0, 120));
    } else {
      console.error("fail:", rel, msg);
      await client.end();
      process.exit(1);
    }
  }
}
await client.end();
console.log("Done — staff attendance offices schema applied.");
