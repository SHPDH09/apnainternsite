import { getVercelLitePool } from "./vercel-lite-pool.js";
import { applyStaffSalaryBootstrap } from "./staff-office-apply.js";
import { STAFF_SALARY_REQUIRED_RPCS } from "./staff-office-sql-chunks.js";

export function isStaffSalaryRpc(name: string): boolean {
  return (STAFF_SALARY_REQUIRED_RPCS as readonly string[]).includes(name);
}

export function isStaffSalaryRpcMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42883" ||
    /could not find the function/i.test(msg) ||
    /admin_ungenerate_staff_salary does not exist/i.test(msg) ||
    /admin_generate_staff_salary does not exist/i.test(msg) ||
    /admin_mark_staff_salary_paid does not exist/i.test(msg) ||
    /admin_list_staff_salary_holidays does not exist/i.test(msg) ||
    /staff_list_my_paid_salary_slips does not exist/i.test(msg) ||
    (/does not exist/i.test(msg) && isStaffSalaryRpc(extractRpcNameFromPgError(msg) || ""))
  );
}

function extractRpcNameFromPgError(msg: string): string | null {
  const m = msg.match(/function public\.([a-z_][a-z0-9_]*)/i);
  return m?.[1] ?? null;
}

/** Install missing staff salary RPCs on Vercel RDS (fast path for admin_ungenerate_staff_salary). */
export async function ensureStaffSalaryRpcsVercel(): Promise<void> {
  const pool = await getVercelLitePool();
  await applyStaffSalaryBootstrap(pool);
}
