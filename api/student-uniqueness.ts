/**
 * POST /api/student-uniqueness — validate student fields on RDS (applies uniqueness SQL if missing).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";

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

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

async function verifySession(token: string): Promise<{ sub: string; email?: string } | null> {
  try {
    const jwt = await import("jsonwebtoken");
    const secret =
      process.env.LOCAL_JWT_SECRET ||
      process.env.SUPABASE_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "";
    if (!secret) return null;
    const decoded = jwt.default.verify(token, secret) as { sub?: string; email?: string };
    if (!decoded?.sub) return null;
    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

async function uniquenessRpcExists(pool: import("pg").Pool): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'validate_student_uniqueness'
    ) AS ok`
  );
  return Boolean(rows[0]?.ok);
}

async function applyGlobalStudentUniquenessSql(pool: import("pg").Pool): Promise<void> {
  const candidates = [
    path.join(process.cwd(), "aws/scripts/77-rds-global-student-uniqueness.sql"),
    path.join(process.cwd(), "supabase/migrations/20260726120000_global_student_uniqueness.sql"),
  ];
  const fp = candidates.find((p) => fs.existsSync(p));
  if (!fp) {
    throw new Error("global_student_uniqueness.sql bundle not found in deployment.");
  }
  const sql = fs.readFileSync(fp, "utf8");
  await pool.query(sql);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, message: "Method not allowed" });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      valid: false,
      message: "DATABASE_URL is not configured on this deployment",
    });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ valid: false, message: "Authorization Bearer token required" });
  }
  const session = await verifySession(token);
  if (!session) {
    return res.status(401).json({ valid: false, message: "Invalid or expired session" });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));

  try {
    if (!(await uniquenessRpcExists(pool))) {
      await applyGlobalStudentUniquenessSql(pool);
    }

    const { rows } = await pool.query<{ result: unknown }>(
      `SELECT public.validate_student_uniqueness(
        $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::uuid
      ) AS result`,
      [
        body.email ?? null,
        body.phone ?? null,
        body.rollNumber ?? body.p_roll_number ?? null,
        body.registrationNumber ?? body.p_registration_number ?? null,
        body.universityName ?? body.p_university_name ?? null,
        body.universityRollNumber ?? body.p_university_roll_number ?? null,
        body.excludeUserId ?? body.p_exclude_user_id ?? session.sub,
      ]
    );

    const row = rows[0]?.result;
    return res.status(200).json(row ?? { valid: false, message: "Empty validation result" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[student-uniqueness]", message);
    return res.status(400).json({ valid: false, message });
  } finally {
    await pool.end();
  }
}
