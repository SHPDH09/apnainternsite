import { getVercelLitePool } from "./vercel-lite-pool.js";
import { STAFF_BLOCK_EMPLOYEE_ATTENDANCE_RPC_SQL } from "./staff-block-employee-rpc-sql.generated.js";

let applied = false;

/** Idempotent: staff block + employee attendance admin RPCs (aws/scripts/66). */
export async function ensureStaffBlockEmployeeAttendanceRpcs(): Promise<void> {
  if (applied) return;
  const pool = await getVercelLitePool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'admin_set_staff_blocked'
    ) AS ok`
  );
  if (rows[0]?.ok) {
    applied = true;
    return;
  }
  await pool.query(STAFF_BLOCK_EMPLOYEE_ATTENDANCE_RPC_SQL);
  applied = true;
}

export function isStaffEmployeeAdminRpc(name: string): boolean {
  return (
    name === "admin_set_staff_blocked" ||
    name === "admin_upsert_employee_attendance" ||
    name === "admin_delete_employee_attendance" ||
    name === "admin_list_employee_attendance" ||
    name === "admin_import_employee_attendance_rows"
  );
}
