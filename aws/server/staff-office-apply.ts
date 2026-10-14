/** Apply staff office schema + admin RPCs to RDS (ensure tables exist before %ROWTYPE RPCs). */
import {
  STAFF_FACE_REGISTER_REQUIRED_RPCS,
  STAFF_OFFICE_REQUIRED_RPCS,
  STAFF_SALARY_REQUIRED_RPCS,
  STAFF_SELF_OFFICE_REQUIRED_RPCS,
  STAFF_HALF_DAY_CHUNKS,
  staffFaceRegisterRpcSql,
  staffOfficeAdminRpcSql,
  staffOfficeEnsureSchemaSql,
  staffOfficeSelfAttendanceRpcSql,
  staffSalaryAdvancedSql,
  staffSalaryBaseSql,
  staffSalaryResolveSql,
  staffProfileImageRpcSql,
  staffBlockEmployeeAttendanceRpcSql,
  STAFF_EMPLOYEE_ADMIN_REQUIRED_RPCS,
} from "./staff-office-sql-chunks.js";
import { ADMIN_UNGENERATE_STAFF_SALARY_RPC_SQL } from "./staff-salary-ungenerate-rpc.generated.js";

type Queryable = {
  query: (
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: Record<string, boolean>[] }>;
};

const STAFF_FACE_REGISTER_RPC_NAMES = new Set(["staff_register_face"]);

const STAFF_PROFILE_IMAGE_RPC_NAMES = new Set(["staff_update_profile_image"]);

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
  "admin_reset_staff_face",
]);

const STAFF_EMPLOYEE_ADMIN_RPC_NAMES = new Set([
  "admin_set_staff_blocked",
  "admin_upsert_employee_attendance",
  "admin_delete_employee_attendance",
  "admin_list_employee_attendance",
  "admin_import_employee_attendance_rows",
]);

const STAFF_SALARY_RPC_NAMES = new Set<string>(STAFF_SALARY_REQUIRED_RPCS);

async function rpcExists(pool: Queryable, name: string): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    ) AS ok`,
    [name]
  );
  return Boolean(rows[0]?.ok);
}

/** Schema + RPC updates for half-day leave (idempotent CREATE OR REPLACE). */
export async function applyStaffHalfDayAttendanceBootstrap(pool: Queryable): Promise<void> {
  if (!Array.isArray(STAFF_HALF_DAY_CHUNKS) || STAFF_HALF_DAY_CHUNKS.length === 0) return;
  await pool.query(STAFF_HALF_DAY_CHUNKS.join(""));
}

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
  const ready =
    (await rpcExists(pool, "staff_self_attendance_status")) &&
    (await rpcExists(pool, "staff_self_check_in")) &&
    (await rpcExists(pool, "_staff_attendance_employee_id"));
  if (!ready) {
    await pool.query(staffOfficeEnsureSchemaSql());
    await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
    await pool.query(staffOfficeSelfAttendanceRpcSql());
    await assertRpcs(pool, STAFF_SELF_OFFICE_REQUIRED_RPCS);
  }
  await applyStaffHalfDayAttendanceBootstrap(pool);
}

/** Lightweight bootstrap for one-time face registration (script 90). */
export async function applyStaffFaceRegisterBootstrap(pool: Queryable): Promise<void> {
  const ready =
    (await rpcExists(pool, "staff_register_face")) &&
    (await rpcExists(pool, "_staff_attendance_employee_id"));
  if (ready) return;

  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");

  if (!(await rpcExists(pool, "_staff_attendance_employee_id"))) {
    await pool.query(staffOfficeSelfAttendanceRpcSql());
  }

  await pool.query(staffFaceRegisterRpcSql());
  await applyStaffHalfDayAttendanceBootstrap(pool);
  await assertRpcs(pool, STAFF_FACE_REGISTER_REQUIRED_RPCS);
}

/** Idempotent patches for new admin RPCs on deployments that already had office CRUD. */
export async function applyStaffAdminRpcPatches(pool: Queryable): Promise<void> {
  if (!(await rpcExists(pool, "admin_reset_staff_face"))) {
    await pool.query(staffOfficeAdminRpcSql());
  }
}

/** Staff profile photo RPC (resolve staff row by user_id). */
export async function applyStaffProfileImageBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffProfileImageRpcSql());
}

/** Staff block + employee attendance admin RPCs (script 66). */
export async function applyStaffEmployeeAdminBootstrap(pool: Queryable): Promise<void> {
  if (await rpcExists(pool, "admin_set_staff_blocked")) return;
  await pool.query(staffBlockEmployeeAttendanceRpcSql());
  await assertRpcs(pool, [...STAFF_EMPLOYEE_ADMIN_REQUIRED_RPCS]);
}

/** Admin office CRUD + assignments — no salary SQL. */
export async function applyStaffOfficeAdminBootstrap(pool: Queryable): Promise<void> {
  const ready = (await rpcExists(pool, "admin_list_staff_attendance_offices")) &&
    (await rpcExists(pool, "admin_assign_staff_office"));
  if (!ready) {
    await pool.query(staffOfficeEnsureSchemaSql());
    await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
    await pool.query(staffOfficeAdminRpcSql());
    await assertRpcs(pool, [...STAFF_OFFICE_REQUIRED_RPCS]);
  } else {
    await applyStaffAdminRpcPatches(pool);
  }
}

/** Staff salary tables + RPCs (81 → 96 → 86); fast path when only ungenerate is new. */
export async function applyStaffSalaryBootstrap(pool: Queryable): Promise<void> {
  const exists: Record<string, boolean> = {};
  for (const name of STAFF_SALARY_REQUIRED_RPCS) {
    exists[name] = await rpcExists(pool, name);
  }
  if (STAFF_SALARY_REQUIRED_RPCS.every((name) => exists[name])) return;

  const missing = STAFF_SALARY_REQUIRED_RPCS.filter((name) => !exists[name]);
  if (missing.length === 1 && missing[0] === "admin_ungenerate_staff_salary") {
    await pool.query(ADMIN_UNGENERATE_STAFF_SALARY_RPC_SQL);
    await assertRpcs(pool, ["admin_ungenerate_staff_salary"]);
    return;
  }

  await pool.query(staffSalaryBaseSql());
  await pool.query(staffSalaryResolveSql());
  await pool.query(staffSalaryAdvancedSql());
  await assertRpcs(pool, [...STAFF_SALARY_REQUIRED_RPCS]);
}

/** Full bootstrap for rds-apply-all (office + salary). */
export async function applyStaffOfficeBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffOfficeEnsureSchemaSql());
  await pool.query("SELECT public._ensure_staff_attendance_office_schema()");
  await pool.query(staffOfficeAdminRpcSql());
  await pool.query(staffOfficeSelfAttendanceRpcSql());
  await pool.query(staffFaceRegisterRpcSql());
  await applyStaffHalfDayAttendanceBootstrap(pool);
  await applyStaffSalaryBootstrap(pool);
  await applyStaffEmployeeAdminBootstrap(pool);

  await assertRpcs(pool, [
    ...STAFF_OFFICE_REQUIRED_RPCS,
    ...STAFF_SELF_OFFICE_REQUIRED_RPCS,
    ...STAFF_FACE_REGISTER_REQUIRED_RPCS,
    ...STAFF_SALARY_REQUIRED_RPCS,
  ]);
}

export function staffOfficeBootstrapForRpc(
  rpcName: string
): "self" | "face_register" | "profile_image" | "admin" | "employee_admin" | "salary" | "full" {
  if (STAFF_FACE_REGISTER_RPC_NAMES.has(rpcName)) return "face_register";
  if (STAFF_PROFILE_IMAGE_RPC_NAMES.has(rpcName)) return "profile_image";
  if (STAFF_SELF_RPC_NAMES.has(rpcName)) return "self";
  if (STAFF_EMPLOYEE_ADMIN_RPC_NAMES.has(rpcName)) return "employee_admin";
  if (STAFF_OFFICE_ADMIN_RPC_NAMES.has(rpcName)) return "admin";
  if (STAFF_SALARY_RPC_NAMES.has(rpcName)) return "salary";
  return "full";
}

export async function applyStaffOfficeBootstrapForRpc(pool: Queryable, rpcName: string): Promise<void> {
  switch (staffOfficeBootstrapForRpc(rpcName)) {
    case "face_register":
      await applyStaffFaceRegisterBootstrap(pool);
      return applyStaffProfileImageBootstrap(pool);
    case "profile_image":
      await applyStaffSelfOfficeBootstrap(pool);
      return applyStaffProfileImageBootstrap(pool);
    case "self":
      return applyStaffSelfOfficeBootstrap(pool);
    case "admin":
      return applyStaffOfficeAdminBootstrap(pool);
    case "employee_admin":
      return applyStaffEmployeeAdminBootstrap(pool);
    case "salary":
      return applyStaffSalaryBootstrap(pool);
    default:
      return applyStaffOfficeBootstrap(pool);
  }
}
