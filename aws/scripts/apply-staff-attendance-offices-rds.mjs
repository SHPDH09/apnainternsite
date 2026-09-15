#!/usr/bin/env node
/**
 * Apply staff attendance office schema + admin RPCs to RDS.
 * Usage: DATABASE_URL='postgresql://ezyintern:PASSWORD@ezyintern-staging-db.c5makww6eq8y.ap-south-1.rds.amazonaws.com:5432/ezyintern?sslmode=require' node aws/scripts/apply-staff-attendance-offices-rds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  STAFF_OFFICE_REQUIRED_RPCS,
  staffOfficeRpcCheckSql,
  staffOfficeRpcsReady,
} from "./rds-sql-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const files = [
  "aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql",
  "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql",
  "aws/scripts/84-rds-staff-office-assignments-fix.sql",
  "aws/scripts/82-rds-staff-attendance-offices.sql",
  "aws/scripts/87-rds-staff-attendance-offices-all-admin-rpc-fix.sql",
  "aws/scripts/88-rds-staff-office-self-attendance-rpc.sql",
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

const { rows } = await client.query(staffOfficeRpcCheckSql());
await client.end();

if (!staffOfficeRpcsReady(rows[0])) {
  const missing = STAFF_OFFICE_REQUIRED_RPCS.filter((name) => !rows[0]?.[name]);
  console.error("FAIL: staff office admin RPCs still missing:", missing.join(", "));
  process.exit(1);
}

console.log("Done — all staff attendance office admin RPCs applied.");
