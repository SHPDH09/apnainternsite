/**
 * POST /api/ensure-staff-attendance-offices — create staff office tables + admin RPCs on RDS.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authorization Bearer token required" });
  }
  const session = await verifyBearerSession(token);
  if (!session?.sub) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return res.status(503).json({
      ok: false,
      message: "DATABASE_URL is not configured on this deployment",
    });
  }

  try {
    const { ensureStaffAttendanceOfficesSchema } = await import(
      "../aws/server/staff-attendance-offices-bootstrap.js"
    );
    await ensureStaffAttendanceOfficesSchema();
    return res.status(200).json({ ok: true, schema: "staff_attendance_offices" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensure-staff-attendance-offices]", message);
    return res.status(500).json({ ok: false, message });
  }
}
