/**
 * POST /api/staff-office-rpc — staff office admin RPCs on RDS.
 * Vercel-safe: no top-level imports (jwt/pg/lib crash with FUNCTION_INVOCATION_FAILED).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const STAFF_OFFICE_RPCS = new Set([
  "admin_list_staff_attendance_offices",
  "admin_upsert_staff_attendance_office",
  "admin_delete_staff_attendance_office",
  "admin_assign_staff_office",
  "admin_remove_staff_office_assignment",
  "admin_list_staff_office_assignments",
]);

const LAMBDA_AUTH =
  process.env.LAMBDA_API_URL?.trim()?.replace(/\/$/, "") ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

async function verifySession(token: string): Promise<{ sub: string } | null> {
  try {
    const jwt = await import("jsonwebtoken");
    const secret =
      process.env.LOCAL_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "ezyintern-local-dev-secret-change-me";
    const payload = jwt.default.verify(token, secret, {
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

  if (!STAFF_OFFICE_RPCS.has(name)) {
    return res.status(400).json({ data: null, error: { message: `Unknown staff office RPC: ${name}` } });
  }

  try {
    const { handleStaffOfficeRpcAction } = await import("./lib/staffOfficeRpcVercel.js");
    const data = await handleStaffOfficeRpcAction({
      databaseUrl,
      userId: session.sub,
      name,
      args,
    });
    return res.status(200).json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-office-rpc]", name, message);
    return res.status(400).json({ data: null, error: { message } });
  }
}
