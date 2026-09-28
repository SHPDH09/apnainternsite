/**
 * Blog RDS helpers for Vercel send-mail (lives outside api/ — not deployed as its own route).
 */
import type { QueryResultRow } from "pg";

const BLOG_ENGAGEMENT_BOOTSTRAP_SQL = `
ALTER TABLE public.site_blog_posts
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.site_blog_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.site_blog_posts (id) ON DELETE SET NULL,
  post_slug text,
  post_title text,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  college_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_blog_leads_created
  ON public.site_blog_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_blog_leads_phone
  ON public.site_blog_leads (phone);

CREATE INDEX IF NOT EXISTS idx_site_blog_leads_post
  ON public.site_blog_leads (post_id);

ALTER TABLE public.site_blog_leads
  ADD COLUMN IF NOT EXISTS device_id text;

ALTER TABLE public.site_blog_leads
  ADD COLUMN IF NOT EXISTS device_info jsonb;
`;

let pool: import("pg").Pool | null = null;
let engagementReady: Promise<void> | null = null;

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

async function getPool(): Promise<import("pg").Pool> {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured on this deployment");
  }
  const pg = await import("pg");
  pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  return pool;
}

export async function ensureBlogEngagementSchema(): Promise<void> {
  if (!engagementReady) {
    engagementReady = (async () => {
      const p = await getPool();
      await p.query(BLOG_ENGAGEMENT_BOOTSTRAP_SQL);
    })();
  }
  await engagementReady;
}

export async function blogEngagementQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  await ensureBlogEngagementSchema();
  const p = await getPool();
  return p.query<T>(text, params);
}
