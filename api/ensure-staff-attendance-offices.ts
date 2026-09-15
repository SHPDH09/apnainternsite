/**
 * POST /api/ensure-staff-attendance-offices — create staff office tables + admin RPCs on RDS.
 * Vercel-safe (no aws/* imports).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const LAMBDA_AUTH =
  process.env.LAMBDA_API_URL?.trim()?.replace(/\/$/, "") ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function jwtSecret(): string {
  return (
    process.env.LOCAL_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "ezyintern-local-dev-secret-change-me"
  );
}

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

async function verifySession(token: string): Promise<{ sub: string } | null> {
  try {
    const payload = jwt.verify(token, jwtSecret(), { issuer: "ezyintern-local" }) as jwt.JwtPayload;
    if (payload?.sub) return { sub: String(payload.sub) };
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(`${LAMBDA_AUTH}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json().catch(() => null)) as { id?: string; sub?: string } | null;
    const sub = user?.id || user?.sub;
    return sub ? { sub: String(sub) } : null;
  } catch {
    return null;
  }
}

async function applyStaffOfficeSql(databaseUrl: string): Promise<void> {
  const files = [
    "87-rds-staff-attendance-offices-all-admin-rpc-fix.sql",
    "85-rds-staff-attendance-offices-ensure-schema.sql",
    "83-rds-staff-attendance-offices-admin-rpc.sql",
  ];
  const sql = files
    .map((file) => {
      const fp = path.join(process.cwd(), "aws/scripts", file);
      return fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : "";
    })
    .filter(Boolean)
    .join("\n\n");

  if (!sql.trim()) throw new Error("Staff office SQL files missing from deployment bundle");

  const pg = await import("pg");
  const pool = new pg.default.Pool({
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authorization Bearer token required" });
  }
  if (!(await verifySession(token))) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      ok: false,
      message: "DATABASE_URL is not configured on this deployment",
    });
  }

  try {
    await applyStaffOfficeSql(databaseUrl);
    return res.status(200).json({ ok: true, schema: "staff_attendance_offices" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensure-staff-attendance-offices]", message);
    return res.status(500).json({ ok: false, message });
  }
}
