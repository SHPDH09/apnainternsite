/** Apply staff office schema + admin RPCs to RDS (ensure tables exist before %ROWTYPE RPCs). */
import {
  STAFF_OFFICE_REQUIRED_RPCS,
  staffOfficeAdminRpcSql,
  staffOfficeEnsureSchemaSql,
  staffOfficeSelfAttendanceRpcSql,
} from "./staffOfficeSqlChunks.js";

const STAFF_SELF_OFFICE_REQUIRED_RPCS = [
  "_staff_office_for_employee",
  "staff_self_attendance_status",
  "staff_self_check_in",
  "staff_self_check_out",
];

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, boolean>[] }> };

export async function applyStaffOfficeBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
  await pool.query(staffOfficeAdminRpcSql());
  await pool.query(staffOfficeSelfAttendanceRpcSql());

  const checks = [...STAFF_OFFICE_REQUIRED_RPCS, ...STAFF_SELF_OFFICE_REQUIRED_RPCS].map(
    (name) => `EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${name}'
    ) AS "${name}"`
  );
  const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
  const missing = [...STAFF_OFFICE_REQUIRED_RPCS, ...STAFF_SELF_OFFICE_REQUIRED_RPCS].filter(
    (n) => !rows[0]?.[n]
  );
  if (missing.length) {
    throw new Error(`Staff office RPCs still missing: ${missing.join(", ")}`);
  }
}
