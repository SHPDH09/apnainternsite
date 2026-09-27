/** Idempotent RDS bootstrap for blog views + reader leads. */

export const BLOG_ENGAGEMENT_BOOTSTRAP_SQL = `
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
`;
