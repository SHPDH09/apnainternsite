import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) {
    res.status(503).json({ ok: false, error: "DATABASE_URL missing" });
    return;
  }

  const connectionString = raw
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 12_000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const started = Date.now();
    const { rows } = await pool.query<{ ok: number }>("select 1 as ok");
    res.status(200).json({
      ok: rows[0]?.ok === 1,
      ms: Date.now() - started,
      pooler: /pooler\.supabase\.com/i.test(raw),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      pooler: /pooler\.supabase\.com/i.test(raw),
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export const config = {
  maxDuration: 30,
};
