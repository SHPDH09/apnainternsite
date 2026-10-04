/**
 * GET /api/admin-blog-posts — list blog posts for Admin / Blog staff (single RDS query, no REST fan-out).
 * GET /api/admin-blog-posts?id=<uuid> — one post including content for the editor.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../aws/server/db.js";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";
import { assertBlogAdmin } from "./lib/assertBlogAdmin.js";

const LIST_COLUMNS =
  "id, title, slug, excerpt, cover_image_url, cover_image_path, author_name, post_type, status, published_at, scheduled_at, meta_title, meta_description, tags, is_active, is_featured, sort_order, created_by, created_at, updated_at";

const LIST_COLUMNS_WITH_VIEWS = `${LIST_COLUMNS}, view_count`;

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

function isMissingViewCount(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return code === "42703" && /view_count/i.test(msg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
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
    return res.status(503).json({ ok: false, message: "DATABASE_URL not configured" });
  }

  try {
    const allowed = await assertBlogAdmin(session.sub);
    if (!allowed) {
      return res.status(403).json({ ok: false, message: "Blog admin access required" });
    }

    const id = String(req.query.id || "").trim();
    if (id) {
      const sql = `SELECT * FROM public.site_blog_posts WHERE id = $1::uuid LIMIT 1`;
      const { rows } = await query<Record<string, unknown>>(sql, [id]);
      return res.status(200).json({ ok: true, data: rows[0] ?? null });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const runList = async (cols: string) => {
      const sql = `
        SELECT ${cols}
        FROM public.site_blog_posts
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT $1
      `;
      const { rows } = await query<Record<string, unknown>>(sql, [limit]);
      return rows;
    };

    try {
      const rows = await runList(LIST_COLUMNS_WITH_VIEWS);
      return res.status(200).json({ ok: true, data: rows });
    } catch (err) {
      if (!isMissingViewCount(err)) throw err;
      const rows = await runList(LIST_COLUMNS);
      return res.status(200).json({
        ok: true,
        data: rows.map((row) => ({ ...row, view_count: 0 })),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-blog-posts]", message);
    return res.status(500).json({ ok: false, message: "Could not load blog posts" });
  }
}
