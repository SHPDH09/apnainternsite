-- Drop auth.users FK on site_blog_posts.created_by (blocks admin saves when author row missing).

DO $$
DECLARE
  con text;
BEGIN
  IF to_regclass('public.site_blog_posts') IS NULL THEN
    RETURN;
  END IF;

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
    RAISE NOTICE 'Dropped FK % on site_blog_posts.created_by', con;
  END IF;
END $$;
