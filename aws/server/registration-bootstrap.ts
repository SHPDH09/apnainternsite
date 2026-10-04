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

const SQL_TEXT_ID = "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql";
const SQL_UUID_ID = "aws/scripts/21-rds-admin-create-registration-uuid-id.sql";

/** Marker in the RDS-safe admin registration function (text student id). */
const TEXT_ID_MARKER = "WHERE s.id = v_uid::text";
/** Marker in uuid-id admin registration function (script 21). */
const UUID_ID_MARKER = "apna_admin_reg_uuid_v21";

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

async function studentsIdColumnType(): Promise<string> {
  const { rows } = await query<{ data_type: string }>(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'students'
       AND column_name = 'id'
     LIMIT 1`
  );
  return String(rows[0]?.data_type || "uuid").toLowerCase();
}

async function registrationRpcNeedsFix(): Promise<boolean> {
  const idType = await studentsIdColumnType();
  const wantsUuid = idType === "uuid";

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

  const def = String(row.def || "");
  const hasTextBody = def.includes(TEXT_ID_MARKER) || def.includes("v_uid::text, v_email, v_name");
  const hasUuidBody = def.includes(UUID_ID_MARKER);

  if (wantsUuid) {
    return !hasUuidBody || hasTextBody;
  }
  return !hasTextBody;
}

async function pickMainSqlFile(): Promise<string> {
  const idType = await studentsIdColumnType();
  return idType === "uuid" ? SQL_UUID_ID : SQL_TEXT_ID;
}

/**
 * Ensure admin_create_minimal_student_registration matches students.id column type.
 * Safe to call on every Lambda cold start (no-op when already applied).
 */
export async function ensureAdminRegistrationRpc(): Promise<{ ok: true; applied: boolean }> {
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

  const mainSql = await pickMainSqlFile();
  await runSqlFile(mainSql);
  console.log(
    `[registration-bootstrap] admin_create_minimal_student_registration ready (${path.basename(mainSql)})`
  );
  return { ok: true, applied: true };
}
