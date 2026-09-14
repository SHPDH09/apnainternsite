/**
 * POST /api/partner-application-submit — save partner application on RDS (bootstrap + insert).
 * Uses service connection; auth_user_id is always the JWT subject.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../aws/server/local-jwt.js";
import { query } from "../aws/server/db.js";
import { ensurePartnerApplicationsTables } from "../aws/server/partner-applications-bootstrap.js";

const ALLOWED_KINDS = new Set(["cyber_cafe", "referral", "coupon"]);

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
  const jwt = verifyToken(token);
  if (!jwt?.sub) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const partnerKind = String(body.partner_kind || "").trim();
  if (!ALLOWED_KINDS.has(partnerKind)) {
    return res.status(400).json({ ok: false, message: "Invalid partner_kind" });
  }

  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const contactNumber = String(body.contact_number || "").trim();
  if (!fullName || !email || !contactNumber) {
    return res.status(400).json({ ok: false, message: "full_name, email, and contact_number are required" });
  }

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload
      : {};

  try {
    await ensurePartnerApplicationsTables();

    const { rows } = await query<{ id: string }>(
      `INSERT INTO public.partner_applications (
         auth_user_id, partner_kind, status, full_name, email, contact_number, payload
       ) VALUES ($1::uuid, $2, 'pending', $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [jwt.sub, partnerKind, fullName, email, contactNumber, JSON.stringify(payload)]
    );

    const id = rows[0]?.id;
    if (!id) {
      return res.status(500).json({ ok: false, message: "Insert did not return an id" });
    }

    return res.status(201).json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[partner-application-submit]", message);
    return res.status(503).json({
      ok: false,
      message: "Partner application could not be saved. Please try again in a moment.",
      detail: process.env.NODE_ENV === "production" ? undefined : message,
    });
  }
}
