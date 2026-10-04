import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const ATTENDANCE_SQL = "aws/scripts/25-rds-fix-student-attendance-mark.sql";

/** Fixed student lookup / dedupe (works when students.id is uuid or text). */
const ATTENDANCE_FIX_MARKER = "s.id::text = v_uid::text";

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  const root = path.resolve(moduleDir, "../..");
  return path.join(root, rel);
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    throw new Error(`Attendance bootstrap SQL missing: ${rel} (looked at ${fp})`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function studentMarkAttendanceNeedsFix(): Promise<boolean> {
  const { rows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'student_mark_attendance'
     ORDER BY p.oid DESC
     LIMIT 1`
  );
  const def = String(rows[0]?.def || "");
  if (!def) return true;
  if (!def.includes(ATTENDANCE_FIX_MARKER)) return true;
  if (def.includes("WHERE s.id = v_uid::text")) return true;
  return false;
}

/**
 * Ensure student_mark_attendance RPC matches RDS schema (uuid/text student ids).
 */
export async function ensureStudentAttendanceMarkRpc(): Promise<{ ok: true; applied: boolean }> {
  const needsFix = await studentMarkAttendanceNeedsFix();
  if (!needsFix) {
    return { ok: true, applied: false };
  }
  await runSqlFile(ATTENDANCE_SQL);
  console.log("[attendance-bootstrap] student_mark_attendance ready");
  return { ok: true, applied: true };
}
