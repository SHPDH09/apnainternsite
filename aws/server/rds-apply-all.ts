import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const extraFiles = [
  "supabase/update_payment_schema.sql",
  "supabase/migrations/20260709100000_engineering_university_configs.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
  "supabase/migrations/20260605120000_notification_management.sql",
] as const;

export type RdsApplyAllResult = {
  ok: true;
  applied: number;
  warnings: number;
  skipped: number;
  checks: Record<string, unknown>;
  files: Array<{ file: string; status: "ok" | "warn" | "skip" }>;
};

function repoRoot(): string {
  return path.resolve(moduleDir, "../..");
}

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.join(repoRoot(), rel);
}

function listAwsSqlFiles(): string[] {
  const scriptsDir = path.join(repoRoot(), "aws/scripts");
  return fs
    .readdirSync(scriptsDir)
    .filter((f) => /^\d{2}-.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join("aws/scripts", f));
}

const warnPattern = /already exists|duplicate key|does not exist|cannot drop|multiple primary keys/i;

/**
 * Apply all numbered aws/scripts/*.sql (+ key supabase gap-fill files) to RDS.
 * Uses DATABASE_URL from the running process (Lambda or local API).
 */
export async function applyAllRdsSql(): Promise<RdsApplyAllResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const files = [...listAwsSqlFiles(), ...extraFiles];
  const client = await getPool().connect();
  const results: RdsApplyAllResult["files"] = [];
  let applied = 0;
  let warnings = 0;
  let skipped = 0;

  try {
    for (const rel of files) {
      const fp = resolveSqlPath(rel);
      if (!fs.existsSync(fp)) {
        results.push({ file: rel, status: "skip" });
        skipped += 1;
        continue;
      }
      const sql = fs.readFileSync(fp, "utf8");
      try {
        await client.query(sql);
        results.push({ file: rel, status: "ok" });
        applied += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (warnPattern.test(msg)) {
          results.push({ file: rel, status: "warn" });
          warnings += 1;
        } else {
          throw new Error(`${rel}: ${msg}`);
        }
      }
    }

    const { rows } = await client.query(`
      SELECT
        to_regclass('public.student_data_uploads') AS student_data_uploads,
        EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admin_student_data_upload_import'
        ) AS upload_import_rpc,
        EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admin_create_minimal_student_registration'
        ) AS add_registration_rpc
    `);

    return {
      ok: true,
      applied,
      warnings,
      skipped,
      checks: rows[0] || {},
      files: results,
    };
  } finally {
    client.release();
  }
}
