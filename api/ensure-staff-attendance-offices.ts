/**
 * POST /api/ensure-staff-attendance-offices — create staff office tables + admin RPCs on RDS.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

function pgConfig(url: string) {
  const useSsl = /rds\.amazonaws\.com/i.test(url) || /sslmode=require/i.test(url);
  return {
    connectionString: url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, ""),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

async function applyStaffOfficeSql(): Promise<void> {
  const url = process.env.DATABASE_URL!.trim();
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
    await applyStaffOfficeSql();
    return res.status(200).json({ ok: true, schema: "staff_attendance_offices" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensure-staff-attendance-offices]", message);
    return res.status(500).json({ ok: false, message });
  }
}
