/**
 * POST /api/rds-apply-all — apply staff office SQL to RDS (Vercel-safe, self-contained).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body =
    req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? (req.body as { code?: string; scope?: string })
      : (() => {
          try {
            return JSON.parse(String(req.body || "{}")) as { code?: string; scope?: string };
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
    const { staffOfficeBootstrapSql, STAFF_OFFICE_REQUIRED_RPCS } = await import(
      "./staffOfficeSqlChunks.js"
    );
    const pg = await import("pg");
    const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
    try {
      await pool.query(staffOfficeBootstrapSql());
      const checks = STAFF_OFFICE_REQUIRED_RPCS.map(
        (name) => `EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = '${name}'
        ) AS "${name}"`
      );
      const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
      const missing = STAFF_OFFICE_REQUIRED_RPCS.filter((n) => !rows[0]?.[n]);
      if (missing.length) {
        throw new Error(`Staff office RPCs still missing: ${missing.join(", ")}`);
      }
      return res.status(200).json({
        ok: true,
        scope: "staff_attendance_offices",
        checks: rows[0],
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
