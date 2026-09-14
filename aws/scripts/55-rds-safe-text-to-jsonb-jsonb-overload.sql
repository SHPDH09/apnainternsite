-- Fix student login: resolve_login_email and directory RPCs call safe_text_to_jsonb(jsonb).
-- Run on RDS if login fails with: function public.safe_text_to_jsonb(jsonb) does not exist

CREATE OR REPLACE FUNCTION public.safe_text_to_jsonb(p_raw text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  j jsonb;
BEGIN
  IF p_raw IS NULL OR btrim(p_raw) = '' OR lower(btrim(p_raw)) IN ('null', 'undefined') THEN
    RETURN '{}'::jsonb;
  END IF;

  BEGIN
    RETURN p_raw::jsonb;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  v := replace(btrim(p_raw), '""', '"');
  BEGIN
    j := v::jsonb;
    IF jsonb_typeof(j) = 'string' THEN
      BEGIN
        RETURN (j #>> '{}')::jsonb;
      EXCEPTION WHEN others THEN
        RETURN '{}'::jsonb;
      END;
    END IF;
    RETURN j;
  EXCEPTION WHEN others THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_text_to_jsonb(p_raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(p_raw, '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.safe_text_to_jsonb(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_text_to_jsonb(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_text_to_jsonb(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_text_to_jsonb(jsonb) TO anon, authenticated;
