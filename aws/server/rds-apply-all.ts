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

/** 85 ensure-schema must run after 82 and before 83 admin RPCs. */
function awsSqlSortKey(filename: string): number {
  if (filename.includes("85-rds-staff-attendance-offices-ensure-schema")) return 829;
  if (filename.includes("83-rds-staff-attendance-offices-admin-rpc")) return 831;
  const m = filename.match(/^(\d+)-/);
  return m ? Number(m[1]) * 10 : 99999;
}

function compareAwsSqlFilenames(a: string, b: string): number {
  const oa = awsSqlSortKey(path.basename(a));
  const ob = awsSqlSortKey(path.basename(b));
  if (oa !== ob) return oa - ob;
  return path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
}

const STAFF_OFFICE_ADMIN_RPC_FILES = [
  "aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql",
  "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql",
] as const;

function listAwsSqlFiles(): string[] {
  const scriptsDir = path.join(repoRoot(), "aws/scripts");
  return fs
    .readdirSync(scriptsDir)
    .filter((f) => /^\d{2}-.*\.sql$/i.test(f))
    .sort(compareAwsSqlFilenames)
    .map((f) => path.join("aws/scripts", f));
}

async function ensureStaffOfficeAdminRpcs(
  client: import("pg").PoolClient,
  applyFile: (rel: string) => Promise<"ok" | "warn" | "skip">
): Promise<void> {
  const { rows } = await client.query<{ ok: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_staff_attendance_office'
    ) AS ok
  `);
  if (rows[0]?.ok) return;

  for (const rel of STAFF_OFFICE_ADMIN_RPC_FILES) {
    await applyFile(rel);
  }
}

const warnPattern = /already exists|duplicate key|does not exist|cannot drop|multiple primary keys|cannot change return type|42P13|42710|42701|operator does not exist|25P02/i;

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
    const applyFile = async (rel: string): Promise<"ok" | "warn" | "skip"> => {
      const fp = resolveSqlPath(rel);
      if (!fs.existsSync(fp)) {
        results.push({ file: rel, status: "skip" });
        skipped += 1;
        return "skip";
      }
      const sql = fs.readFileSync(fp, "utf8");
      try {
        await client.query(sql);
        results.push({ file: rel, status: "ok" });
        applied += 1;
        return "ok";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        if (warnPattern.test(msg)) {
          results.push({ file: rel, status: "warn" });
          warnings += 1;
          return "warn";
        }
        throw new Error(`${rel}: ${msg}`);
      }
    };

    for (const rel of files) {
      await applyFile(rel);
    }

    await ensureStaffOfficeAdminRpcs(client, applyFile);

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
        ) AS add_registration_rpc,
        EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_staff_attendance_office'
        ) AS staff_office_upsert_rpc
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
