import { getVercelLitePool } from "./vercel-lite-pool.js";

const COLUMN_PATCH_SQL = `
ALTER TABLE public.staff_salary_setup
  ADD COLUMN IF NOT EXISTS paid_leaves_per_month integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS standard_hours_per_day numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS overtime_multiplier numeric NOT NULL DEFAULT 1.5;

ALTER TABLE public.staff_salary_setup
  ADD COLUMN IF NOT EXISTS food_allowance numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accommodation_allowance numeric(12, 2) NOT NULL DEFAULT 0;
`;

let columnsPatched = false;

export function resetStaffSalarySetupColumnCache(): void {
  columnsPatched = false;
}

export function isStaffSalarySetupTable(table: string): boolean {
  return table === "staff_salary_setup";
}

/** Fast idempotent column ensure before REST upsert (full schema via rds-apply-all / salary RPCs). */
export async function ensureStaffSalarySetupColumns(): Promise<void> {
  if (columnsPatched) return;
  const pool = await getVercelLitePool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.staff_salary_setup') IS NOT NULL AS ok`
  );
  if (!rows[0]?.ok) {
    throw new Error(
      "staff_salary_setup table is missing. Run /api/rds-apply-all or npm run aws:rds:apply-all on RDS."
    );
  }
  await pool.query(COLUMN_PATCH_SQL);
  columnsPatched = true;
}
