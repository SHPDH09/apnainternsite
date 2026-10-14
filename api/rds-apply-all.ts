/**
 * POST /api/rds-apply-all — apply staff office + salary SQL to RDS (Vercel-safe, self-contained).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { refreshVercelRdsIamPassword } from "./lib/rdsIamPg.js";
import {
  applyStaffOfficeBootstrap,
  applyStaffSalaryBootstrap,
} from "../aws/server/staff-office-apply.js";

const APPLY_CODE =
  process.env.RDS_APPLY_SECRET?.trim() ||
  process.env.ADMIN_BOOTSTRAP_CODE?.trim() ||
  "apnaintern-owner-setup-v1";

type RdsApplyBody = {
  code?: string;
  scope?: string;
  action?: string;
  /** YYYY-MM or YYYY-MM-01 */
  months?: string[];
  /** When true, also removes paid slips (use with care). Default: generated + draft only. */
  includePaid?: boolean;
};

const DEFAULT_BULK_UNGENERATE_MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];

function normalizeSalaryMonthKey(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t.slice(0, 7)}-01`;
  throw new Error(`Invalid month: ${raw}`);
}

type PgQueryable = {
  query: <T = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

async function bulkUngenerateStaffSalaryMonths(
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

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 20000,
  };
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body: RdsApplyBody =
    req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? (req.body as RdsApplyBody)
      : (() => {
          try {
            return JSON.parse(String(req.body || "{}")) as RdsApplyBody;
          } catch {
            return {};
          }
        })();

  if (body.code !== APPLY_CODE) {
    return res.status(403).json({ ok: false, message: "Invalid apply code" });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      ok: false,
      message: "DATABASE_URL is not configured on this deployment",
    });
  }

  try {
    await refreshVercelRdsIamPassword();
    const pg = await import("pg");
    const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
    try {
      if (body.action === "bulk_ungenerate_staff_salary") {
        const months =
          Array.isArray(body.months) && body.months.length
            ? body.months
            : DEFAULT_BULK_UNGENERATE_MONTHS;
        const result = await bulkUngenerateStaffSalaryMonths(
          pool,
          months,
          Boolean(body.includePaid)
        );
        return res.status(200).json({
          ok: true,
          action: "bulk_ungenerate_staff_salary",
          months: months.map(normalizeSalaryMonthKey),
          deleted: result.deleted,
          skippedPaidSlips: result.skippedPaid,
          samples: result.rows.slice(0, 20),
        });
      }
      if (body.scope === "salary") {
        await applyStaffSalaryBootstrap(pool);
        return res.status(200).json({ ok: true, scope: "staff_salary" });
      }
      await applyStaffOfficeBootstrap(pool);
      return res.status(200).json({
        ok: true,
        scope: "staff_attendance_offices,staff_salary",
      });
    } finally {
      await pool.end();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[rds-apply-all]", message);
    return res.status(500).json({ ok: false, message });
  }
}
