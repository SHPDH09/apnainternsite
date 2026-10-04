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

ALTER TABLE public.site_blog_leads
  ADD COLUMN IF NOT EXISTS device_id text;

ALTER TABLE public.site_blog_leads
  ADD COLUMN IF NOT EXISTS device_info jsonb;

CREATE OR REPLACE FUNCTION public.public_increment_blog_post_view(p_post_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF p_post_id IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.site_blog_posts
  SET view_count = view_count + 1
  WHERE id = p_post_id
    AND is_active = true
    AND (
      status IS NULL
      OR btrim(coalesce(status, '')) = ''
      OR lower(btrim(status)) IN ('published', 'scheduled')
    )
  RETURNING view_count INTO v_count;
  RETURN coalesce(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_increment_blog_post_view(uuid) TO anon, authenticated;
`;
