/** Idempotent RDS bootstrap for site_blog_posts (Vercel + Lambda). */

export const BLOG_CMS_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.site_blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  cover_image_path text,
  author_name text,
  post_type text NOT NULL DEFAULT 'blog' CHECK (post_type IN ('blog', 'vlog')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  published_at timestamptz,
  scheduled_at timestamptz,
  meta_title text,
  meta_description text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_blog_posts_public
  ON public.site_blog_posts (is_active, status, is_featured DESC, sort_order ASC, published_at DESC NULLS LAST, scheduled_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_blog_posts_slug
  ON public.site_blog_posts (lower(slug));

DO $$
DECLARE
  con text;
BEGIN
  SELECT c.conname INTO con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'site_blog_posts'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%created_by%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.site_blog_posts DROP CONSTRAINT %I', con);
  END IF;
END $$;

ALTER TABLE public.site_blog_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read active blog posts" ON public.site_blog_posts';
    EXECUTE $p$
      CREATE POLICY "Public read active blog posts"
        ON public.site_blog_posts
        FOR SELECT
        TO anon, authenticated
        USING (is_active = true)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage blog posts" ON public.site_blog_posts';
    EXECUTE $p$
      CREATE POLICY "Admins manage blog posts"
        ON public.site_blog_posts
        FOR ALL
        TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
    $p$;
    EXECUTE 'GRANT SELECT ON public.site_blog_posts TO anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_blog_posts TO authenticated';
  END IF;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  EXECUTE 'ALTER TABLE public.site_blog_posts DISABLE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT ON public.site_blog_posts TO anon, authenticated';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_blog_posts TO authenticated';
END $$;
`;

const LAMBDA_API_ORIGIN =
  process.env.LAMBDA_API_ORIGIN?.trim() ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

export async function runBlogCmsBootstrap(): Promise<{ ok: true; via: "direct" | "lambda" }> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: databaseUrl,
      ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 1,
      connectionTimeoutMillis: 20_000,
    });
    try {
      await pool.query(BLOG_CMS_BOOTSTRAP_SQL);
      return { ok: true, via: "direct" };
    } finally {
      await pool.end();
    }
  }

  throw new Error("DATABASE_URL not configured on this host");
}

/** Direct RDS bootstrap, then Lambda fallback (Vercel send-mail / local API). */
export async function ensureBlogCmsWithFallback(
  authHeader: string
): Promise<{ ok: true; via: "direct" | "lambda" }> {
  try {
    return await runBlogCmsBootstrap();
  } catch (directErr) {
    const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
    if (!/DATABASE_URL not configured/i.test(directMsg)) {
      throw directErr;
    }
  }

  const upstream = await proxyBlogCmsBootstrapToLambda(authHeader);
  const body = (await upstream.json().catch(() => ({}))) as { ok?: boolean; message?: string; via?: string };
  if (!upstream.ok) {
    throw new Error(body.message || `Lambda blog bootstrap failed (HTTP ${upstream.status})`);
  }
  return { ok: true, via: (body.via as "lambda") || "lambda" };
}

export async function proxyBlogCmsBootstrapToLambda(authHeader: string): Promise<Response> {
  return fetch(`${LAMBDA_API_ORIGIN.replace(/\/$/, "")}/api/ensure-blog-cms`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });
}
