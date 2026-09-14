-- Include logo_url in public university list for home page partner logos.

CREATE OR REPLACE FUNCTION public.list_public_universities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'logo_url', u.logo_url
      )
      ORDER BY u.name
    ),
    '[]'::jsonb
  )
  FROM public.universities u;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_universities() TO anon, authenticated;
