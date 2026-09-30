/**
 * GET /api/public/blog-media?id={uuid} — stream blog image bytes from RDS.
 * Runs on Vercel (whitelisted); also registered on Lambda Express for fallback.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MEDIA_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.site_blog_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  subfolder text NOT NULL DEFAULT 'content',
  file_name text,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_blog_media_post
  ON public.site_blog_media_assets (post_id);
`;

let mediaPool: import("pg").Pool | null = null;
let mediaReady: Promise<void> | null = null;

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 20000,
  };
}

async function getMediaPool(): Promise<import("pg").Pool> {
  if (mediaPool) return mediaPool;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  const pg = await import("pg");
  mediaPool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  return mediaPool;
}

async function ensureMediaSchema(): Promise<void> {
  if (!mediaReady) {
    mediaReady = (async () => {
      const p = await getMediaPool();
      await p.query(MEDIA_BOOTSTRAP_SQL);
    })();
  }
  await mediaReady;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const rawId = req.query.id;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId)?.trim() || "";
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ ok: false, message: "Invalid media id" });
  }

  try {
    await ensureMediaSchema();
    const p = await getMediaPool();
    const { rows } = await p.query<{ content_type: string; data: Buffer }>(
      `SELECT content_type, data FROM public.site_blog_media_assets WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row?.data?.length) {
      return res.status(404).json({ ok: false, message: "Image not found" });
    }

    const contentType = String(row.content_type || "application/octet-stream");
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", String(buf.length));
    return res.status(200).send(buf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[public/blog-media]", message);
    return res.status(503).json({ ok: false, message: "Image temporarily unavailable" });
  }
}
