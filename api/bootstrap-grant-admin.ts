import type { VercelRequest, VercelResponse } from "@vercel/node";
import { grantAdminByEmail, type GrantAdminRole } from "./lib/grantAdminByEmail.js";

/** One-time owner emails allowed when bootstrap code matches (remove after setup). */
const ALLOWED_EMAILS = new Set(["apnaintern.in@gmail.com"]);

const BOOTSTRAP_CODE =
  process.env.ADMIN_BOOTSTRAP_CODE?.trim() || "apnaintern-owner-setup-v1";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = (req.body || {}) as {
    email?: string;
    password?: string;
    role?: string;
    code?: string;
  };

  if (body.code !== BOOTSTRAP_CODE) {
    return res.status(403).json({ ok: false, message: "Invalid bootstrap code" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!ALLOWED_EMAILS.has(email)) {
    return res.status(403).json({ ok: false, message: "Email not allowed for bootstrap" });
  }

  const role = (body.role || "admin") as GrantAdminRole;
  if (!["admin", "super_admin", "staff"].includes(role)) {
    return res.status(400).json({ ok: false, message: "Invalid role" });
  }

  try {
    const result = await grantAdminByEmail(email, password, role);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap-grant-admin]", message);
    return res.status(500).json({ ok: false, message });
  }
}
