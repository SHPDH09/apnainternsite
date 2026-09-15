import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const BASE_SQL = "aws/scripts/81-rds-staff-salary-account.sql";
const ADVANCED_SQL = "aws/scripts/86-rds-staff-salary-advanced.sql";

const SALARY_RPCS = [
  "admin_list_staff_salary_holidays",
  "admin_upsert_staff_salary_holiday",
  "admin_delete_staff_salary_holiday",
  "admin_list_staff_paid_leave_grants",
  "admin_upsert_staff_paid_leave_grant",
  "admin_generate_staff_salary",
  "admin_mark_staff_salary_paid",
] as const;

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", rel);
}

async function functionExists(fn: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1
     ) AS ok`,
    [fn]
  );
  return Boolean(rows[0]?.ok);
}

async function rpcsReady(): Promise<boolean> {
  for (const fn of SALARY_RPCS) {
    if (!(await functionExists(fn))) return false;
  }
  return true;
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    console.warn("[staff-salary-bootstrap] sql file missing:", rel);
    return;
  }
  await query(fs.readFileSync(fp, "utf8"));
}

export function isStaffSalaryRpc(name: string): boolean {
  return (
    name === "admin_list_staff_salary_holidays" ||
    name === "admin_upsert_staff_salary_holiday" ||
    name === "admin_delete_staff_salary_holiday" ||
    name === "admin_list_staff_paid_leave_grants" ||
    name === "admin_upsert_staff_paid_leave_grant" ||
    name === "admin_generate_staff_salary" ||
    name === "admin_mark_staff_salary_paid"
  );
}

export function isStaffSalaryRpcMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42883" ||
    /could not find the function/i.test(msg) ||
    /admin_list_staff_salary_holidays does not exist/i.test(msg) ||
    /admin_(upsert|delete)_staff_salary_holiday does not exist/i.test(msg) ||
    /admin_(list|upsert)_staff_paid_leave_grant does not exist/i.test(msg) ||
    /admin_generate_staff_salary does not exist/i.test(msg) ||
    /admin_mark_staff_salary_paid does not exist/i.test(msg) ||
    /relation .*staff_salary_holidays.* does not exist/i.test(msg) ||
    /relation .*staff_paid_leave_grants.* does not exist/i.test(msg)
  );
}

/** Idempotent RDS bootstrap for staff salary tables + RPCs (81 then 86). */
export async function ensureStaffSalarySchema(): Promise<{ ok: true }> {
  if (await rpcsReady()) return { ok: true };

  for (const rel of [BASE_SQL, ADVANCED_SQL]) {
    try {
      await runSqlFile(rel);
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err || "");
      if (!/already exists|duplicate key|does not exist|42P13|42710|42701/i.test(msg)) {
        console.warn("[staff-salary-bootstrap] sql:", rel, msg.slice(0, 240));
      }
    }
    if (await rpcsReady()) return { ok: true };
  }

  if (!(await rpcsReady())) {
    const missing = [];
    for (const fn of SALARY_RPCS) {
      if (!(await functionExists(fn))) missing.push(fn);
    }
    throw new Error(`staff salary bootstrap incomplete — missing on RDS: ${missing.join(", ")}`);
  }

  return { ok: true };
}
