#!/usr/bin/env node
/**
 * Apply all portal SQL to Supabase Postgres (migrations + aws/rds scripts + supabase hotfixes).
 *
 * Usage:
 *   DATABASE_URL='postgresql://postgres.[ref]:...@...pooler...:5432/postgres' node scripts/apply-all-supabase-sql.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { compareAwsSqlFilenames } from "../aws/scripts/rds-sql-order.mjs";
import { loadAwsRdsDatabaseUrl } from "../aws/scripts/aws-rds-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const warnPattern =
  /already exists|duplicate key|does not exist|cannot drop|multiple primary keys|cannot change return type|42P13|42710|42701|operator does not exist|25P02|skipping|must be owner|permission denied for schema auth|role memberships are reserved|supabase_auth_admin|supabase_storage_admin/i;

const SKIP_ON_HOSTED_SUPABASE = new Set([
  "aws/scripts/00-supabase-bootstrap.sql",
]);

const SKIP_ROOT = /^(check_|seed_|report_|mock_)/i;

function listMigrationFiles() {
  const dir = path.join(root, "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join("supabase/migrations", f));
}

function listAwsSqlFiles() {
  const dir = path.join(root, "aws/scripts");
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{2}-.*\.sql$/i.test(f))
    .sort(compareAwsSqlFilenames)
    .map((f) => path.join("aws/scripts", f));
}

function listSupabaseRootSql() {
  const dir = path.join(root, "supabase");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !SKIP_ROOT.test(f))
    .sort()
    .map((f) => path.join("supabase", f));
}

function listHotfixSql() {
  const dir = path.join(root, "supabase");
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("hotfix_") && f.endsWith(".sql"))
    .sort()
    .map((f) => path.join("supabase", f));
}

function collectAllSqlFiles() {
  const seen = new Set();
  const out = [];
  const add = (rel) => {
    const norm = rel.replace(/\\/g, "/");
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push(norm);
  };
  add("scripts/supabase-hosted-base-schema.sql");
  for (const rel of listMigrationFiles()) add(rel);
  for (const rel of listAwsSqlFiles()) add(rel);
  for (const rel of listHotfixSql()) add(rel);
  for (const rel of listSupabaseRootSql()) add(rel);
  return out;
}

function isHostedSupabaseUrl(url) {
  return /supabase\.co|pooler\.supabase\.com/i.test(url);
}

function applySqlFilePsql(databaseUrl, rel) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn(`Skip missing: ${rel}`);
    return "skip";
  }
  const sql = fs.readFileSync(fp, "utf8");
  if (!sql.trim()) {
    console.log(`→ ${rel} … empty, skip`);
    return "skip";
  }
  if (isHostedSupabaseUrl(databaseUrl) && SKIP_ON_HOSTED_SUPABASE.has(rel.replace(/\\/g, "/"))) {
    console.log(`→ ${rel} … skip (hosted Supabase)`);
    return "skip";
  }

  process.stdout.write(`→ ${rel} … `);
  const run = spawnSync("psql", [databaseUrl, "-f", fp], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout || ""}\n${run.stderr || ""}`.trim();
  if (run.status === 0) {
    console.log("ok");
    return "ok";
  }
  if (warnPattern.test(out)) {
    console.log(`warn (${out.slice(0, 120).replace(/\s+/g, " ")})`);
    return "warn";
  }
  console.error(`\nFAILED ${rel}:\n${out.slice(0, 2000)}`);
  throw new Error(`psql failed on ${rel}`);
}

async function main() {
  const raw = loadAwsRdsDatabaseUrl();
  console.log(`Target: ${/@[^/]+/.exec(raw)?.[0] || "database"}\n`);

  const files = collectAllSqlFiles();
  console.log(`Applying ${files.length} SQL files via psql…\n`);

  let ok = 0;
  let warn = 0;
  let skip = 0;
  let i = 0;

  for (const rel of files) {
    i += 1;
    if (i % 25 === 0) {
      console.log(`--- progress ${i}/${files.length} ---`);
    }
    const status = applySqlFilePsql(raw, rel);
    if (status === "ok") ok += 1;
    if (status === "warn") warn += 1;
    if (status === "skip") skip += 1;
  }

  const check = spawnSync(
    "psql",
    [
      raw,
      "-c",
      `SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables,
        to_regclass('public.students') IS NOT NULL AS has_students,
        to_regclass('public.universities') IS NOT NULL AS has_universities,
        to_regclass('public.cybercafe_profiles') IS NOT NULL AS has_cybercafe,
        to_regclass('public.site_popups') IS NOT NULL AS has_site_popups`,
    ],
    { encoding: "utf8" }
  );

  console.log("\n✅ Apply-all Supabase SQL complete:", { ok, warn, skip, total: files.length });
  console.log(check.stdout?.trim() || check.stderr?.trim());

  if (check.status !== 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
