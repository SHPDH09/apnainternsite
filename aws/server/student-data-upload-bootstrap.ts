import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const PREREQ_SQL = [
  "aws/scripts/12-rds-safe-metadata-json.sql",
  "aws/scripts/18-rds-fix-payment-enrollment.sql",
] as const;

const UPLOAD_SQL = [
  "aws/scripts/28-rds-student-data-upload.sql",
  "aws/scripts/33-rds-student-data-upload-dup-delete.sql",
  "aws/scripts/34-rds-student-data-upload-delete-harden.sql",
  "aws/scripts/35-rds-student-data-upload-history-recover.sql",
  "aws/scripts/36-rds-student-data-upload-id-type-fix.sql",
] as const;

/** Marker in schema-adaptive import (uuid vs text students.id). */
const ID_TYPE_FIX_MARKER = "v_student_id_is_text";

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
    throw new Error(`Student data upload bootstrap SQL missing: ${rel} (looked at ${fp})`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function uploadSchemaNeedsFix(): Promise<boolean> {
  const { rows: tableRows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.student_data_uploads') IS NOT NULL AS exists`
  );
  if (!tableRows[0]?.exists) return true;

  const { rows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'admin_student_data_upload_import'
     ORDER BY p.oid DESC
     LIMIT 1`
  );
  const def = String(rows[0]?.def || "");
  if (!def) return true;
  if (!def.includes(ID_TYPE_FIX_MARKER)) return true;
  if (/v_uid::text,\s*v_email/i.test(def) && !def.includes("IF v_student_id_is_text THEN")) {
    return true;
  }
  return false;
}

/**
 * Ensure student data upload tables + RPCs exist with uuid/text id compatibility.
 * Safe to call on every Lambda cold start (no-op when already applied).
 */
export async function ensureStudentDataUploadSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped) {
    return { ok: true, applied: false };
  }
  bootstrapped = true;

  const needsFix = await uploadSchemaNeedsFix();
  if (!needsFix) {
    return { ok: true, applied: false };
  }

  for (const rel of PREREQ_SQL) {
    try {
      await runSqlFile(rel);
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (!/already exists|duplicate key|does not exist|cannot drop/i.test(msg)) {
        console.warn(`[student-upload-bootstrap] prerequisite ${rel} warn:`, msg.slice(0, 160));
      }
    }
  }

  for (const rel of UPLOAD_SQL) {
    try {
      await runSqlFile(rel);
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (!/already exists|duplicate key|does not exist|cannot drop/i.test(msg)) {
        throw err;
      }
    }
  }

  console.log("[student-upload-bootstrap] student data upload schema ready");
  return { ok: true, applied: true };
}
