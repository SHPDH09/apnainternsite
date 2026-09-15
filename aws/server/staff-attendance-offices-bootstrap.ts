import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const OFFICES_SQL = "aws/scripts/82-rds-staff-attendance-offices.sql";
const ADMIN_RPC_SQL = "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql";

const OFFICE_TABLES = new Set(["staff_attendance_offices", "staff_office_assignments"]);

let bootstrapped = false;

export function isStaffAttendanceOfficesTable(table: string): boolean {
  return OFFICE_TABLES.has(table);
}

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", rel);
}

async function officesTableExists(): Promise<boolean> {
  const { rows } = await query<{ reg: string | null }>(
    `SELECT to_regclass('public.staff_attendance_offices')::text AS reg`
  );
  return Boolean(rows[0]?.reg);
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) return;
  await query(fs.readFileSync(fp, "utf8"));
}

/** Idempotent RDS bootstrap for staff attendance office tables + admin RPCs. */
export async function ensureStaffAttendanceOfficesSchema(): Promise<{ ok: true }> {
  if (bootstrapped && (await officesTableExists())) return { ok: true };

  try {
    await runSqlFile(OFFICES_SQL);
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    if (!/already exists|duplicate key|does not exist|cannot change return type|42P13|42710|42701/i.test(msg)) {
      console.warn("[staff-attendance-offices-bootstrap] offices sql:", msg.slice(0, 240));
    }
  }

  try {
    await runSqlFile(ADMIN_RPC_SQL);
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    console.warn("[staff-attendance-offices-bootstrap] admin rpc sql:", msg.slice(0, 240));
  }

  if (!(await officesTableExists())) {
    throw new Error("staff_attendance_offices table could not be created");
  }

  bootstrapped = true;
  return { ok: true };
}
