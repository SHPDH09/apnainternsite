/**
 * Server-side public blog posts — merges RDS site_blog_posts with S3 cms-posts.json fallback.
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { query } from "../../aws/server/db.js";

const FALLBACK_MARKER = "__apna_site_blog_v1__";
const FALLBACK_OBJECT_KEY = "blog/cms-posts.json";
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";

function blogBucketCandidates(): string[] {
  const fromEnv = process.env.S3_BUCKET_LOGOS?.trim();
  const defaults = [
    "apnaintern-308946946129-staging-logos",
    "ezyintern-staging-logos",
  ];
  return [...new Set([fromEnv, ...defaults].filter(Boolean))] as string[];
}

export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  author_name?: string | null;
  post_type: "blog" | "vlog";
  status: "draft" | "scheduled" | "published";
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FetchOpts = {
  featuredOnly?: boolean;
  limit?: number;
  postType?: "blog" | "vlog";
  slug?: string;
};

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return [];
}

function normalizePost(raw: PublicBlogPost): PublicBlogPost {
  return {
    ...raw,
    post_type: raw.post_type === "vlog" ? "vlog" : "blog",
    status:
      raw.status === "published" || raw.status === "scheduled" ? raw.status : "draft",
    tags: normalizeTags(raw.tags),
    is_active: raw.is_active !== false,
    is_featured: raw.is_featured === true,
    sort_order: Number(raw.sort_order) || 0,
  };
}

export function isPublicBlogPost(post: PublicBlogPost, now = new Date()): boolean {
  if (!post.is_active) return false;
  if (post.status === "draft") return false;
  const ts = now.getTime();
  if (post.status === "scheduled") {
    if (!post.scheduled_at) return false;
    return new Date(post.scheduled_at).getTime() <= ts;
  }
  if (post.status === "published") {
    if (post.published_at && new Date(post.published_at).getTime() > ts) return false;
    return true;
  }
  return false;
}

function sortPosts(rows: PublicBlogPost[]): PublicBlogPost[] {
  return [...rows].sort((a, b) => {
    const featured = Number(b.is_featured) - Number(a.is_featured);
    if (featured !== 0) return featured;
    const sort = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sort !== 0) return sort;
    const pub = String(b.published_at || b.scheduled_at || b.created_at || "").localeCompare(
      String(a.published_at || a.scheduled_at || a.created_at || "")
    );
    if (pub !== 0) return pub;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

function mergeById(...groups: PublicBlogPost[][]): PublicBlogPost[] {
  const byId = new Map<string, PublicBlogPost>();
  for (const group of groups) {
    for (const row of group) {
      const existing = byId.get(row.id);
      if (!existing) {
        byId.set(row.id, row);
        continue;
      }
      const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const nextTs = new Date(row.updated_at || row.created_at || 0).getTime();
      if (nextTs >= existingTs) byId.set(row.id, row);
    }
  }
  return sortPosts([...byId.values()]);
}

function parseFallbackEnvelope(text: string): PublicBlogPost[] {
  const raw = text.trim();
  if (!raw.startsWith("{")) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rows = parsed[FALLBACK_MARKER];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => normalizePost(row as PublicBlogPost));
  } catch {
    return [];
  }
}

let s3: S3Client | null = null;

function getS3(): S3Client {
  if (!s3) s3 = new S3Client({ region: REGION });
  return s3;
}

async function fetchFallbackPostsFromS3(): Promise<PublicBlogPost[]> {
  for (const bucket of blogBucketCandidates()) {
    try {
      const result = await getS3().send(
        new GetObjectCommand({ Bucket: bucket, Key: FALLBACK_OBJECT_KEY })
      );
      const body = result.Body;
      if (!body) continue;
      const text = await body.transformToString("utf-8");
      const rows = parseFallbackEnvelope(text);
      if (rows.length) return rows;
    } catch {
      /* try next bucket */
    }
  }
  return [];
}

async function fetchRdsPosts(): Promise<PublicBlogPost[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];
  try {
    const { rows } = await query<PublicBlogPost>(
      `SELECT id, title, slug, excerpt, content, cover_image_url, cover_image_path,
              author_name, post_type, status, published_at, scheduled_at,
              meta_title, meta_description, tags, is_active, is_featured, sort_order,
              created_by, created_at, updated_at
       FROM public.site_blog_posts
       WHERE is_active = true`
    );
    return rows.map((row) =>
      normalizePost({
        ...row,
        tags: normalizeTags(row.tags),
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/42P01|undefined_table|site_blog_posts.*does not exist/i.test(msg)) return [];
    throw err;
  }
}

export async function fetchPublicBlogPostsServer(opts?: FetchOpts): Promise<PublicBlogPost[]> {
  const [fallbackRows, rdsRows] = await Promise.all([
    fetchFallbackPostsFromS3(),
    fetchRdsPosts(),
  ]);

  let rows = mergeById(fallbackRows, rdsRows).filter(isPublicBlogPost);

  if (opts?.slug) {
    const normalized = opts.slug.trim().toLowerCase();
    rows = rows.filter((p) => p.slug.toLowerCase() === normalized);
  }
  if (opts?.featuredOnly) rows = rows.filter((p) => p.is_featured);
  if (opts?.postType) rows = rows.filter((p) => p.post_type === opts.postType);
  if (opts?.limit && opts.limit > 0) rows = rows.slice(0, opts.limit);

  return rows;
}
