#!/usr/bin/env node
/**
 * Delete generated/draft staff_salary_slips for given months on RDS.
 *
 *   npm run aws:rds:bulk-ungenerate-salary
 *   MONTHS=2026-06,2026-07,2026-08,2026-09 npm run aws:rds:bulk-ungenerate-salary
 */
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";
import {
  bulkUngenerateStaffSalaryMonths,
  DEFAULT_BULK_UNGENERATE_MONTHS,
  normalizeSalaryMonthKey,
} from "../server/staff-salary-bulk-ungenerate.ts";

const monthsRaw = process.env.MONTHS?.trim();
const months = monthsRaw
  ? monthsRaw.split(/[,;\s]+/).filter(Boolean)
  : DEFAULT_BULK_UNGENERATE_MONTHS;
const includePaid = /^(1|true|yes)$/i.test(String(process.env.INCLUDE_PAID || ""));

const url = loadAwsRdsDatabaseUrl();
const pool = new pg.Pool(pgClientConfig(url));

try {
  const result = await bulkUngenerateStaffSalaryMonths(pool, months, includePaid);
  console.log(
    JSON.stringify(
      {
        ok: true,
        months: months.map(normalizeSalaryMonthKey),
        deleted: result.deleted,
        skippedPaidSlips: result.skippedPaid,
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}
