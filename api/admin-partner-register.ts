/**
 * POST /api/admin-partner-register — admin creates and auto-approves a partner (cyber cafe / referral / coupon).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServerDb } from "./lib/getServerDb.js";
import { adminRegisterPartner } from "./lib/adminPartnerRegister.js";

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

  let db;
  try {
    db = getServerDb();
  } catch (cfgErr: unknown) {
    const msg = cfgErr instanceof Error ? cfgErr.message : String(cfgErr);
    return res.status(503).json({ ok: false, message: msg });
  }

  try {
    const { data: userData, error: authError } = await db.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user?.id) {
      return res.status(401).json({ ok: false, message: "Invalid or expired session" });
    }

    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.id);
    const roleRows = (roles || []) as Array<{ role: string }>;
    const isAdmin = roleRows.some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return res.status(403).json({ ok: false, message: "Admin privileges required." });
    }

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};

    const result = await adminRegisterPartner(db, user.id, {
      partner_kind: String(body.partner_kind || ""),
      full_name: String(body.full_name || ""),
      email: String(body.email || ""),
      password: String(body.password || ""),
      contact_number: String(body.contact_number || ""),
      payload,
    });

    return res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-partner-register]", message);
    const status = /already exists|required|Invalid|at least/i.test(message) ? 400 : 503;
    return res.status(status).json({
      ok: false,
      message,
      detail: process.env.NODE_ENV === "production" ? undefined : message,
    });
  }
}
