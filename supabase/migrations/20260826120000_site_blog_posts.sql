-- Site blog posts — see aws/scripts/55-rds-site-blog-posts.sql (same schema for Supabase hosted).

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

ALTER TABLE public.site_blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active blog posts" ON public.site_blog_posts;
CREATE POLICY "Public read active blog posts"
  ON public.site_blog_posts FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage blog posts" ON public.site_blog_posts;
CREATE POLICY "Admins manage blog posts"
  ON public.site_blog_posts FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

GRANT SELECT ON public.site_blog_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_blog_posts TO authenticated;
