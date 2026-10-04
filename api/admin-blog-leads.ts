/**
 * GET /api/admin-blog-leads — paginated blog reader leads (direct RDS; bypasses REST/RLS 504/empty).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../aws/server/db.js";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";
import { assertBlogAdmin } from "./lib/assertBlogAdmin.js";
import { BLOG_ENGAGEMENT_BOOTSTRAP_SQL } from "./lib/blogEngagementBootstrap.js";

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

let leadsSchemaReady: boolean | null = null;

async function ensureLeadsSchema(): Promise<void> {
  if (leadsSchemaReady) return;
  await query(BLOG_ENGAGEMENT_BOOTSTRAP_SQL);
  leadsSchemaReady = true;
}

function buildLeadFilters(req: VercelRequest): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts: string[] = [];
  let idx = 1;

  const dateFrom = String(req.query.dateFrom || "").trim();
  const dateTo = String(req.query.dateTo || "").trim();
  const phoneSearch = String(req.query.phoneSearch || "").replace(/\D/g, "");
  const textSearch = String(req.query.textSearch || "").trim();

  if (dateFrom) {
    parts.push(`created_at >= $${idx++}::timestamptz`);
    params.push(`${dateFrom}T00:00:00+00:00`);
  }
  if (dateTo) {
    parts.push(`created_at <= $${idx++}::timestamptz`);
    params.push(`${dateTo}T23:59:59.999+00:00`);
  }
  if (phoneSearch) {
    parts.push(`regexp_replace(phone, '[^0-9]', '', 'g') LIKE $${idx++}`);
    params.push(`%${phoneSearch}%`);
  }
  if (textSearch) {
    const like = `%${textSearch.replace(/%/g, "\\%")}%`;
    parts.push(
      `(full_name ILIKE $${idx} OR email ILIKE $${idx} OR college_name ILIKE $${idx} OR post_title ILIKE $${idx} OR post_slug ILIKE $${idx})`
    );
    params.push(like);
    idx += 1;
  }

  const where = parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
  return { where, params };
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

    await ensureLeadsSchema();

    const page = Math.max(0, Number(req.query.page) || 0);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 200);
    const exportAll = String(req.query.export || "") === "1";
    const limit = exportAll ? Math.min(Number(req.query.limit) || 15_000, 15_000) : pageSize;
    const offset = exportAll ? 0 : page * pageSize;

    const { where, params } = buildLeadFilters(req);

    const countSql = `SELECT count(*)::int AS c FROM public.site_blog_leads${where}`;
    const { rows: countRows } = await query<{ c: number }>(countSql, params);
    const total = Number(countRows[0]?.c ?? 0);

    const listParams = [...params, limit, offset];
    const listSql = `
      SELECT id, post_id, post_slug, post_title, full_name, email, phone, college_name, created_at
      FROM public.site_blog_leads
      ${where}
      ORDER BY created_at DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await query<Record<string, unknown>>(listSql, listParams);

    return res.status(200).json({ ok: true, data: rows, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-blog-leads]", message);
    return res.status(500).json({ ok: false, message: "Could not load blog leads" });
  }
}
