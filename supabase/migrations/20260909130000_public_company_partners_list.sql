-- Public homepage list of approved company collaboration partners

CREATE OR REPLACE FUNCTION public.list_public_company_partners()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', cp.id,
        'company_name', cp.company_name,
        'contact_name', cp.contact_name,
        'designation', cp.designation,
        'company_address', cp.company_address
      )
      ORDER BY cp.company_name ASC
    ),
    '[]'::json
  )
  FROM public.company_profiles cp
  WHERE cp.status = 'approved';
$$;

REVOKE ALL ON FUNCTION public.list_public_company_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_company_partners() TO anon, authenticated;
