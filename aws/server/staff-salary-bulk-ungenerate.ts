/** Bulk remove generated/draft staff salary slips for given months (admin owner ops). */

export const DEFAULT_BULK_UNGENERATE_MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];

export function normalizeSalaryMonthKey(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t.slice(0, 7)}-01`;
  throw new Error(`Invalid month: ${raw}`);
}

export type PgQueryable = {
  query: <T = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

export async function bulkUngenerateStaffSalaryMonths(
  pool: PgQueryable,
  months: string[],
  includePaid: boolean
): Promise<{ deleted: number; rows: Record<string, unknown>[]; skippedPaid: number }> {
  const monthDates = [...new Set(months.map(normalizeSalaryMonthKey))];
  const placeholders = monthDates.map((_, i) => `$${i + 1}::date`).join(", ");

  let skippedPaid = 0;
  if (!includePaid) {
    const kept = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.staff_salary_slips
       WHERE date_trunc('month', salary_month)::date IN (${placeholders})
         AND status = 'paid'`,
      monthDates
    );
    skippedPaid = Number(kept.rows[0]?.c || 0);
  }

  const statusSql = includePaid ? "" : `AND status IN ('generated', 'draft')`;
  const { rows, rowCount } = await pool.query(
    `DELETE FROM public.staff_salary_slips
     WHERE date_trunc('month', salary_month)::date IN (${placeholders})
     ${statusSql}
     RETURNING id, employee_id, salary_month, status, net_amount`,
    monthDates
  );

  return {
    deleted: rowCount ?? rows.length,
    rows,
    skippedPaid: includePaid ? 0 : skippedPaid,
  };
}
