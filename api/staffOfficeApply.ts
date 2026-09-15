/** Apply staff office schema + admin RPCs to RDS (ensure tables exist before %ROWTYPE RPCs). */
import {
  STAFF_OFFICE_REQUIRED_RPCS,
  STAFF_SALARY_REQUIRED_RPCS,
  STAFF_SELF_OFFICE_REQUIRED_RPCS,
  staffOfficeAdminRpcSql,
  staffOfficeEnsureSchemaSql,
  staffOfficeSelfAttendanceRpcSql,
  staffSalaryAdvancedSql,
  staffSalaryBaseSql,
} from "./staffOfficeSqlChunks.js";

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, boolean>[] }> };

const STAFF_SELF_RPC_NAMES = new Set([
  "staff_self_attendance_status",
  "staff_self_check_in",
  "staff_self_check_out",
]);

const STAFF_OFFICE_ADMIN_RPC_NAMES = new Set([
  "admin_list_staff_attendance_offices",
  "admin_upsert_staff_attendance_office",
  "admin_delete_staff_attendance_office",
  "admin_assign_staff_office",
  "admin_remove_staff_office_assignment",
  "admin_list_staff_office_assignments",
]);

async function assertRpcs(pool: Queryable, names: string[]): Promise<void> {
  if (!names.length) return;
  const checks = names.map(
    (name) => `EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${name}'
    ) AS "${name}"`
  );
  const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
  const missing = names.filter((n) => !rows[0]?.[n]);
  if (missing.length) {
    throw new Error(`Staff office/salary RPCs still missing: ${missing.join(", ")}`);
  }
}

/** Fast path for staff self attendance — no salary SQL on every status poll. */
export async function applyStaffSelfOfficeBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
  await pool.query(staffOfficeSelfAttendanceRpcSql());
  await assertRpcs(pool, STAFF_SELF_OFFICE_REQUIRED_RPCS);
}

/** Admin office CRUD + assignments — no salary SQL. */
export async function applyStaffOfficeAdminBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
  await pool.query(staffOfficeAdminRpcSql());
  await assertRpcs(pool, [...STAFF_OFFICE_REQUIRED_RPCS]);
}

/** Full bootstrap for rds-apply-all (office + salary). */
export async function applyStaffOfficeBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
  await pool.query(staffOfficeAdminRpcSql());
  await pool.query(staffOfficeSelfAttendanceRpcSql());
  await pool.query(staffSalaryBaseSql());
  await pool.query(staffSalaryAdvancedSql());

  await assertRpcs(pool, [
    ...STAFF_OFFICE_REQUIRED_RPCS,
    ...STAFF_SELF_OFFICE_REQUIRED_RPCS,
    ...STAFF_SALARY_REQUIRED_RPCS,
  ]);
}

export function staffOfficeBootstrapForRpc(rpcName: string): "self" | "admin" | "full" {
  if (STAFF_SELF_RPC_NAMES.has(rpcName)) return "self";
  if (STAFF_OFFICE_ADMIN_RPC_NAMES.has(rpcName)) return "admin";
  return "full";
}

export async function applyStaffOfficeBootstrapForRpc(pool: Queryable, rpcName: string): Promise<void> {
  switch (staffOfficeBootstrapForRpc(rpcName)) {
    case "self":
      return applyStaffSelfOfficeBootstrap(pool);
    case "admin":
      return applyStaffOfficeAdminBootstrap(pool);
    default:
      return applyStaffOfficeBootstrap(pool);
  }
}
