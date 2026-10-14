/**
 * POST /api/staff-salary-bulk-ungenerate — owner code bulk reset (generated/draft slips).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  bulkUngenerateStaffSalaryMonths,
  DEFAULT_BULK_UNGENERATE_MONTHS,
  normalizeSalaryMonthKey,
} from "../aws/server/staff-salary-bulk-ungenerate.js";

const APPLY_CODE =
  process.env.RDS_APPLY_SECRET?.trim() ||
  process.env.ADMIN_BOOTSTRAP_CODE?.trim() ||
  "apnaintern-owner-setup-v1";

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

type Body = {
  code?: string;
  months?: string[];
  includePaid?: boolean;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body: Body =
    req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? (req.body as Body)
      : (() => {
          try {
            return JSON.parse(String(req.body || "{}")) as Body;
          } catch {
            return {};
          }
        })();

  if (body.code !== APPLY_CODE) {
    return res.status(403).json({ ok: false, message: "Invalid apply code" });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({ ok: false, message: "DATABASE_URL is not configured" });
  }

  const months =
    Array.isArray(body.months) && body.months.length ? body.months : DEFAULT_BULK_UNGENERATE_MONTHS;

  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
    try {
      const result = await bulkUngenerateStaffSalaryMonths(
        pool,
        months,
        Boolean(body.includePaid)
      );
      return res.status(200).json({
        ok: true,
        months: months.map(normalizeSalaryMonthKey),
        deleted: result.deleted,
        skippedPaidSlips: result.skippedPaid,
        samples: result.rows.slice(0, 30),
      });
    } finally {
      await pool.end();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-salary-bulk-ungenerate]", message);
    return res.status(500).json({ ok: false, message });
  }
}
