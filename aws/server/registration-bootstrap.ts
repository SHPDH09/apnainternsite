import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const PREREQ_SQL = [
  "aws/scripts/12-rds-safe-metadata-json.sql",
  "aws/scripts/18-rds-fix-payment-enrollment.sql",
  "aws/scripts/19-rds-fix-password-text-id.sql",
] as const;

const MAIN_SQL = "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql";

/** Marker in the RDS-safe admin registration function (text student id). */
const RDS_FIX_MARKER = "WHERE s.id = v_uid::text";

let bootstrapped = false;

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  const root = path.resolve(moduleDir, "../..");
  return path.join(root, rel);
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    throw new Error(`Registration bootstrap SQL missing: ${rel} (looked at ${fp})`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function registrationRpcNeedsFix(): Promise<boolean> {
  const { rows } = await query<{ args: string; def: string }>(
    `SELECT
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'admin_create_minimal_student_registration'
     ORDER BY p.oid DESC
     LIMIT 1`
  );
  const row = rows[0];
  if (!row) return true;
  if (!String(row.args || "").includes("p_registration_source")) return true;
  if (!String(row.def || "").includes(RDS_FIX_MARKER)) return true;
  return false;
}

/**
 * Ensure admin_create_minimal_student_registration exists with RDS text-id/metadata fixes.
 * Safe to call on every Lambda cold start (no-op when already applied).
 */
export async function ensureAdminRegistrationRpc(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped) {
    return { ok: true, applied: false };
  }
  bootstrapped = true;

  const needsFix = await registrationRpcNeedsFix();
  if (!needsFix) {
    return { ok: true, applied: false };
  }

  for (const rel of PREREQ_SQL) {
    try {
      await runSqlFile(rel);
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (!/already exists|duplicate key|does not exist|cannot drop/i.test(msg)) {
        console.warn(`[registration-bootstrap] prerequisite ${rel} warn:`, msg.slice(0, 160));
      }
    }
  }

  await runSqlFile(MAIN_SQL);
  console.log("[registration-bootstrap] admin_create_minimal_student_registration ready");
  return { ok: true, applied: true };
}
