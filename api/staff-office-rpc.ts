/**
 * POST /api/staff-office-rpc — staff attendance office admin RPCs on RDS (Vercel direct).
 * Applies missing schema/RPCs then executes the requested function.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { callRpc, type JwtClaims } from "../aws/server/db.js";
import { verifyToken } from "../aws/server/local-jwt.js";

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

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

function jwtFromToken(token: string | null): JwtClaims | null {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  return {
    sub: String(payload.sub),
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : "authenticated",
  };
}

function pgConfig(url: string) {
  const useSsl = /rds\.amazonaws\.com/i.test(url) || /sslmode=require/i.test(url);
  return {
    connectionString: url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, ""),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

async function applyStaffOfficeSql(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not configured");

  const files = [
    "87-rds-staff-attendance-offices-all-admin-rpc-fix.sql",
    "85-rds-staff-attendance-offices-ensure-schema.sql",
    "83-rds-staff-attendance-offices-admin-rpc.sql",
  ];

  const client = new pg.Client(pgConfig(url));
  await client.connect();
  try {
    for (const file of files) {
      const fp = path.join(process.cwd(), "aws/scripts", file);
      if (!fs.existsSync(fp)) continue;
      try {
        await client.query(fs.readFileSync(fp, "utf8"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already exists|duplicate key|does not exist|42P13|42710|42701/i.test(msg)) {
          throw err;
        }
      }
    }

    const checks = REQUIRED_RPCS.map(
      (name) => `EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${name}'
      ) AS "${name}"`
    );
    const { rows } = await client.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
    const missing = REQUIRED_RPCS.filter((n) => !rows[0]?.[n]);
    if (missing.length) {
      throw new Error(`Staff office RPCs still missing after apply: ${missing.join(", ")}`);
    }
  } finally {
    await client.end();
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

  if (!process.env.DATABASE_URL?.trim()) {
    return res.status(503).json({
      data: null,
      error: { message: "DATABASE_URL is not configured on this deployment" },
    });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ data: null, error: { message: "Authorization Bearer token required" } });
  }
  const jwt = jwtFromToken(token);
  if (!jwt) {
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
    await applyStaffOfficeSql();
    const data = await callRpc(name, STAFF_OFFICE_RPCS[name], args, jwt);
    return res.status(200).json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-office-rpc]", name, message);
    return res.status(400).json({ data: null, error: { message } });
  }
}
