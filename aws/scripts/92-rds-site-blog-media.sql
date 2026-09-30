-- Blog CMS image blobs when Vercel IAM cannot PutObject to S3 (served via GET /api/public/blog-media).

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

CREATE INDEX IF NOT EXISTS idx_site_blog_media_created
  ON public.site_blog_media_assets (created_at DESC);
