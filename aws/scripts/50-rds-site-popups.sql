-- Admin-managed site popups (image or text, scheduled, per-page).
-- Also rename founder “Raushan Kumar” → “Ajeet Kumar” in stored CMS/document text.

CREATE TABLE IF NOT EXISTS public.site_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  popup_type text NOT NULL DEFAULT 'text' CHECK (popup_type IN ('text', 'image')),
  message text,
  image_url text,
  image_path text,
  cta_label text,
  cta_url text,
  pages jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_popups_active_sort
  ON public.site_popups (is_active, sort_order ASC, created_at DESC);

ALTER TABLE public.site_popups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read active site_popups" ON public.site_popups';
    EXECUTE $p$
      CREATE POLICY "Public read active site_popups"
        ON public.site_popups
        FOR SELECT
        TO anon, authenticated
        USING (is_active = true)
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage site_popups" ON public.site_popups';
    EXECUTE $p$
      CREATE POLICY "Admins manage site_popups"
        ON public.site_popups
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
    EXECUTE 'GRANT SELECT ON public.site_popups TO anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_popups TO authenticated';
  END IF;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'Skipping site_popups RLS (auth roles/has_role not available)';
END $$;


-- Founder name on stored CMS / expert-team rows (templates already use Ajeet Kumar in code).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'site_expert_team'
  ) THEN
    UPDATE public.site_expert_team
    SET full_name = replace(full_name, 'Raushan Kumar', 'Ajeet Kumar'),
        designation = replace(coalesce(designation, ''), 'Raushan Kumar', 'Ajeet Kumar'),
        title = replace(coalesce(title, ''), 'Raushan Kumar', 'Ajeet Kumar'),
        bio = replace(coalesce(bio, ''), 'Raushan Kumar', 'Ajeet Kumar'),
        updated_at = now()
    WHERE concat_ws(' ', full_name, designation, title, bio) ILIKE '%Raushan Kumar%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'site_testimonials'
  ) THEN
    UPDATE public.site_testimonials
    SET full_name = replace(full_name, 'Raushan Kumar', 'Ajeet Kumar'),
        designation = replace(coalesce(designation, ''), 'Raushan Kumar', 'Ajeet Kumar'),
        review = replace(coalesce(review, ''), 'Raushan Kumar', 'Ajeet Kumar'),
        updated_at = now()
    WHERE concat_ws(' ', full_name, designation, review) ILIKE '%Raushan Kumar%';
  END IF;
END $$;
