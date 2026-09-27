-- Blog post view counts + reader lead capture (name, email, phone, college).
-- Applied via GitHub Actions [rds-apply] on production deploy (2026-09-27).

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

CREATE OR REPLACE FUNCTION public.normalize_india_phone(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(coalesce(p_raw, ''), '\D', '', 'g'), '')
$$;

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
  SET view_count = view_count + 1,
      updated_at = updated_at
  WHERE id = p_post_id
    AND is_active = true
    AND status IN ('published', 'scheduled')
  RETURNING view_count INTO v_count;
  RETURN coalesce(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_submit_site_blog_lead(
  p_post_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_college_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := public.normalize_india_phone(p_phone);
  v_college text := nullif(trim(coalesce(p_college_name, '')), '');
  v_slug text;
  v_title text;
  v_id uuid;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required';
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Valid phone number is required';
  END IF;
  IF length(v_phone) > 10 THEN
    v_phone := right(v_phone, 10);
  END IF;

  SELECT slug, title INTO v_slug, v_title
  FROM public.site_blog_posts
  WHERE id = p_post_id AND is_active = true
  LIMIT 1;

  INSERT INTO public.site_blog_leads (
    post_id, post_slug, post_title, full_name, email, phone, college_name
  )
  VALUES (p_post_id, v_slug, v_title, v_name, v_email, v_phone, v_college)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_lookup_blog_lead_autofill(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := public.normalize_india_phone(p_phone);
  v_row record;
  v_payload jsonb;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN '{}'::jsonb;
  END IF;
  IF length(v_phone) > 10 THEN
    v_phone := right(v_phone, 10);
  END IF;

  SELECT s.full_name, s.email, s.college_name
  INTO v_row
  FROM public.students s
  WHERE right(public.normalize_india_phone(s.contact_number), 10) = v_phone
  ORDER BY s.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND (v_row.full_name IS NOT NULL OR v_row.email IS NOT NULL) THEN
    RETURN jsonb_build_object(
      'full_name', coalesce(v_row.full_name, ''),
      'email', coalesce(v_row.email, ''),
      'college_name', coalesce(v_row.college_name, '')
    );
  END IF;

  SELECT rl.email, rl.phone, rl.payload
  INTO v_row
  FROM public.registration_leads rl
  WHERE right(public.normalize_india_phone(rl.phone), 10) = v_phone
  ORDER BY rl.updated_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_payload := coalesce(v_row.payload, '{}'::jsonb);
    RETURN jsonb_build_object(
      'full_name', coalesce(
        nullif(trim(v_payload->>'full_name'), ''),
        nullif(trim(v_payload->>'name'), ''),
        nullif(trim(v_payload->>'student_name'), ''),
        ''
      ),
      'email', coalesce(nullif(trim(v_row.email), ''), nullif(trim(v_payload->>'email'), ''), ''),
      'college_name', coalesce(
        nullif(trim(v_payload->>'college_name'), ''),
        nullif(trim(v_payload->>'college'), ''),
        ''
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_increment_blog_post_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_submit_site_blog_lead(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_lookup_blog_lead_autofill(text) TO anon, authenticated;

ALTER TABLE public.site_blog_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins read blog leads" ON public.site_blog_leads';
    EXECUTE $p$
      CREATE POLICY "Admins read blog leads"
        ON public.site_blog_leads
        FOR SELECT
        TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
    $p$;
    EXECUTE 'GRANT SELECT ON public.site_blog_leads TO authenticated';
  END IF;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  EXECUTE 'ALTER TABLE public.site_blog_leads DISABLE ROW LEVEL SECURITY';
  EXECUTE 'GRANT SELECT ON public.site_blog_leads TO authenticated';
END $$;
