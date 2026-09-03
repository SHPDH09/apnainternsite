import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyAllRdsSql } from "../aws/server/rds-apply-all.js";

const APPLY_CODE =
  process.env.RDS_APPLY_SECRET?.trim() ||
  process.env.ADMIN_BOOTSTRAP_CODE?.trim() ||
  "apnaintern-owner-setup-v1";

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

  const body = (req.body || {}) as { code?: string };
  if (body.code !== APPLY_CODE) {
    return res.status(403).json({ ok: false, message: "Invalid apply code" });
  }

  try {
    const result = await applyAllRdsSql();
    console.log("[rds-apply-all] complete", {
      applied: result.applied,
      warnings: result.warnings,
      skipped: result.skipped,
    });
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[rds-apply-all]", message);
    return res.status(500).json({ ok: false, message });
  }
}
