/**
 * POST /api/ensure-partner-applications — create partner_applications (+ coupon tables) on RDS.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../aws/server/local-jwt.js";
import { ensurePartnerApplicationsTables } from "../aws/server/partner-applications-bootstrap.js";

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
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  try {
    await ensurePartnerApplicationsTables();
    return res.status(200).json({ ok: true, table: "partner_applications" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensure-partner-applications] bootstrap failed:", message);
    return res.status(503).json({
      ok: false,
      message: "Partner applications storage could not be initialized. Retry in a moment.",
    });
  }
}
