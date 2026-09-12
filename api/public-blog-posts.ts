/**
 * GET /api/public-blog-posts — published blog posts (RDS + S3 fallback, no auth).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchPublicBlogPostsServer } from "./lib/publicBlogPosts.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const q = req.query || {};
  const featuredOnly = String(q.featured || q.featuredOnly || "").toLowerCase() === "true";
  const postTypeRaw = String(q.postType || q.type || "").trim().toLowerCase();
  const postType = postTypeRaw === "vlog" || postTypeRaw === "blog" ? postTypeRaw : undefined;
  const limitRaw = Number(q.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined;
  const slug = String(q.slug || "").trim() || undefined;

  try {
    const posts = await fetchPublicBlogPostsServer({ featuredOnly, limit, postType, slug });
    return res.status(200).json({ ok: true, posts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[public-blog-posts]", message);
    return res.status(503).json({ ok: false, message: "Could not load blog posts.", posts: [] });
  }
}
