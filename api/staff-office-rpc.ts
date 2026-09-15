/**
 * POST /api/staff-office-rpc — staff office admin RPCs on RDS (Vercel-safe, no aws/* imports).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const STAFF_OFFICE_RPCS: Record<string, string[]> = {
  admin_list_staff_attendance_offices: ["p_active_only"],
  admin_upsert_staff_attendance_office: [
    "p_id",
    "p_name",
    "p_address",
    "p_latitude",
    "p_longitude",
    "p_radius_meters",
    "p_max_gps_accuracy_m",
    "p_require_face",
    "p_require_geo",
    "p_is_active",
  ],
  admin_delete_staff_attendance_office: ["p_id"],
  admin_assign_staff_office: ["p_employee_id", "p_office_id"],
  admin_remove_staff_office_assignment: ["p_employee_id"],
  admin_list_staff_office_assignments: [],
};

const REQUIRED_RPCS = Object.keys(STAFF_OFFICE_RPCS);
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
    const payload = jwt.verify(token, jwtSecret(), {
      issuer: "ezyintern-local",
    }) as jwt.JwtPayload;
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

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 15000,
  };
}

function readStaffOfficeSql(): string {
  const files = [
    "87-rds-staff-attendance-offices-all-admin-rpc-fix.sql",
    "85-rds-staff-attendance-offices-ensure-schema.sql",
    "83-rds-staff-attendance-offices-admin-rpc.sql",
  ];
  const chunks: string[] = [];
  for (const file of files) {
    const fp = path.join(process.cwd(), "aws/scripts", file);
    if (fs.existsSync(fp)) chunks.push(fs.readFileSync(fp, "utf8"));
  }
  if (!chunks.length) {
    throw new Error("Staff office SQL files missing from deployment bundle");
  }
  return chunks.join("\n\n");
}

async function applyStaffOfficeSql(databaseUrl: string): Promise<void> {
  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  try {
    await pool.query(readStaffOfficeSql());
    const checks = REQUIRED_RPCS.map(
      (name) => `EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${name}'
      ) AS "${name}"`
    );
    const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
    const missing = REQUIRED_RPCS.filter((n) => !rows[0]?.[n]);
    if (missing.length) {
      throw new Error(`Staff office RPCs still missing: ${missing.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
}

async function callStaffOfficeRpc(
  databaseUrl: string,
  fnName: string,
  argOrder: string[],
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  if (!STAFF_OFFICE_RPCS[fnName]) {
    throw new Error(`Invalid RPC: ${fnName}`);
  }

  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    const values = argOrder.map((k) => (k in args ? args[k] : null));
    const rpcSql =
      argOrder.length === 0
        ? `SELECT public.${fnName}() AS result`
        : `SELECT public.${fnName}(${argOrder.map((_, i) => `$${i + 1}`).join(", ")}) AS result`;
    const { rows } = await client.query<{ result: unknown }>(rpcSql, values);
    await client.query("COMMIT");
    return rows[0]?.result ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ data: null, error: { message: "Method not allowed" } });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      data: null,
      error: { message: "DATABASE_URL is not configured on this deployment" },
    });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ data: null, error: { message: "Authorization Bearer token required" } });
  }
  const session = await verifySession(token);
  if (!session) {
    return res.status(401).json({ data: null, error: { message: "Invalid or expired session" } });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
    name?: string;
    args?: Record<string, unknown>;
  };
  const name = String(body.name || "").trim();
  const args = body.args && typeof body.args === "object" ? body.args : {};

  if (!STAFF_OFFICE_RPCS[name]) {
    return res.status(400).json({ data: null, error: { message: `Unknown staff office RPC: ${name}` } });
  }

  try {
    await applyStaffOfficeSql(databaseUrl);
    const data = await callStaffOfficeRpc(
      databaseUrl,
      name,
      STAFF_OFFICE_RPCS[name],
      args,
      session.sub
    );
    return res.status(200).json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-office-rpc]", name, message);
    return res.status(400).json({ data: null, error: { message } });
  }
}
