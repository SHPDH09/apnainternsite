/** Apply staff salary schema + RPCs to RDS (81 base, then 86 advanced). */
import {
  STAFF_SALARY_REQUIRED_RPCS,
  staffSalaryAdvancedSql,
  staffSalaryBaseSql,
} from "./staffSalarySqlChunks.js";

type Queryable = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, boolean>[] }> };

export async function applyStaffSalaryBootstrap(pool: Queryable): Promise<void> {
  await pool.query(staffSalaryBaseSql());
  await pool.query(staffSalaryAdvancedSql());

  const checks = STAFF_SALARY_REQUIRED_RPCS.map(
    (name) => `EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${name}'
    ) AS "${name}"`
  );
  const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
  const missing = STAFF_SALARY_REQUIRED_RPCS.filter((n) => !rows[0]?.[n]);
  if (missing.length) {
    throw new Error(`Staff salary RPCs still missing: ${missing.join(", ")}`);
  }
}
