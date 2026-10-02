#!/usr/bin/env node
/** Apply 97-rds-learning-materials.sql to AWS RDS (uses .env.awsrds.local / env secrets). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sqlPath = path.join(root, "aws/scripts/97-rds-learning-materials.sql");

async function main() {
  const url = loadAwsRdsDatabaseUrl();
  const sql = fs.readFileSync(sqlPath, "utf8");
  const pg = await import("pg");
  const pool = new pg.default.Pool(pgClientConfig(url));
  try {
    await pool.query(sql);
    const { rows } = await pool.query(
      `SELECT to_regclass('public.learning_materials') IS NOT NULL AS ok`
    );
    console.log("learning_materials ready:", Boolean(rows[0]?.ok));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
