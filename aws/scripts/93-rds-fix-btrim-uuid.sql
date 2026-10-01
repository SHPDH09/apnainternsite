-- Hotfix: function pg_catalog.btrim(uuid) does not exist
-- Usually trim/btrim on students.id when the column is uuid (not text).

CREATE OR REPLACE FUNCTION public.safe_text_to_jsonb(p_raw uuid)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.safe_text_to_jsonb(p_raw::text);
$$;

REVOKE ALL ON FUNCTION public.safe_text_to_jsonb(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_text_to_jsonb(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._staff_leave_auth_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT x), ARRAY[]::uuid[])
  FROM (
    SELECT p_user_id AS x
    UNION
    SELECT s.user_id
    FROM public.admin_staff s
    WHERE s.user_id IS NOT NULL
      AND (s.id = p_user_id OR s.user_id = p_user_id)
    UNION
    SELECT s.id
    FROM public.admin_staff s
    WHERE s.id = p_user_id OR s.user_id = p_user_id
  ) t
  WHERE x IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public._staff_leave_auth_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._staff_half_day_approval(p_user_id uuid, p_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'leave_request_id', lr.id,
    'check_in_from_minutes', public._ist_minutes_from_time(lr.half_day_check_in_from),
    'check_in_until_minutes', public._ist_minutes_from_time(lr.half_day_check_in_until),
    'check_in_from', to_char(lr.half_day_check_in_from, 'HH24:MI'),
    'check_in_until', to_char(lr.half_day_check_in_until, 'HH24:MI')
  )
  FROM public.staff_leave_requests lr
  WHERE lr.staff_id = ANY(public._staff_leave_auth_ids(p_user_id))
    AND lr.leave_type = 'half_day'
    AND lr.status = 'approved'
    AND p_date BETWEEN lr.from_date AND lr.to_date
    AND lr.half_day_check_in_from IS NOT NULL
    AND lr.half_day_check_in_until IS NOT NULL
  ORDER BY lr.reviewed_at DESC NULLS LAST, lr.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._staff_on_full_day_approved_leave(p_user_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_leave_requests lr
    WHERE lr.staff_id = ANY(public._staff_leave_auth_ids(p_user_id))
      AND lr.status = 'approved'
      AND lr.leave_type <> 'half_day'
      AND p_date BETWEEN lr.from_date AND lr.to_date
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_raw text := trim(COALESCE(p_identifier, ''));
  v_email text;
  v_digits text;
  v_tail text;
  v_emails text[];
  v_auth_email text;
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in v_raw) > 0 THEN
    v_email := lower(v_raw);

    SELECT lower(trim(u.email))
    INTO v_auth_email
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
    ORDER BY u.created_at DESC
    LIMIT 1;
    IF v_auth_email IS NOT NULL THEN
      RETURN v_auth_email;
    END IF;

    SELECT lower(trim(u.email))
    INTO v_auth_email
    FROM public.students s
    JOIN auth.users u ON u.id::text = NULLIF(trim(s.id::text), '')
    WHERE lower(trim(s.email)) = v_email
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT 1;
    IF v_auth_email IS NOT NULL THEN
      RETURN v_auth_email;
    END IF;

    RETURN v_email;
  END IF;

  SELECT array_agg(DISTINCT e ORDER BY e)
  INTO v_emails
  FROM (
    SELECT lower(trim(s.email)) AS e
    FROM public.students s
    WHERE s.email IS NOT NULL
      AND trim(s.email) <> ''
      AND (
        lower(trim(coalesce(s.registration_id, ''))) = lower(v_raw)
        OR trim(coalesce(s.roll_number, '')) = v_raw
        OR lower(trim(coalesce(
             public.safe_text_to_jsonb(s.metadata::text)->>'registration_id', ''
           ))) = lower(v_raw)
        OR trim(coalesce(
             public.safe_text_to_jsonb(s.metadata::text)->>'roll_number', ''
           )) = v_raw
        OR trim(coalesce(
             public.safe_text_to_jsonb(s.metadata::text)->>'rollNo', ''
           )) = v_raw
      )
  ) reg_matches;

  IF v_emails IS NOT NULL AND array_length(v_emails, 1) = 1 THEN
    SELECT lower(trim(u.email))
    INTO v_auth_email
    FROM public.students s
    JOIN auth.users u ON u.id::text = NULLIF(trim(s.id::text), '')
    WHERE lower(trim(s.email)) = v_emails[1]
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT 1;
    RETURN coalesce(v_auth_email, v_emails[1]);
  END IF;

  IF v_emails IS NOT NULL AND array_length(v_emails, 1) > 1 THEN
    RAISE EXCEPTION 'Multiple accounts match this registration or roll number. Contact support.'
      USING ERRCODE = 'P0001';
  END IF;

  v_digits := regexp_replace(v_raw, '\D', '', 'g');
  IF length(v_digits) = 10
     OR (length(v_digits) = 11 AND left(v_digits, 1) = '0')
     OR (length(v_digits) = 12 AND left(v_digits, 2) = '91') THEN
    v_tail := public.normalize_phone_tail(v_raw);
    IF v_tail IS NOT NULL THEN
      SELECT array_agg(DISTINCT e ORDER BY e)
      INTO v_emails
      FROM (
        SELECT lower(trim(s.email)) AS e
        FROM public.students s
        WHERE s.email IS NOT NULL
          AND trim(s.email) <> ''
          AND public.normalize_phone_tail(s.contact_number) = v_tail
        UNION
        SELECT lower(trim(p.email)) AS e
        FROM public.profiles p
        WHERE p.email IS NOT NULL
          AND trim(p.email) <> ''
          AND public.normalize_phone_tail(p.contact_number) = v_tail
      ) phone_matches;

      IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
        RETURN NULL;
      END IF;

      IF array_length(v_emails, 1) > 1 THEN
        RAISE EXCEPTION 'Multiple accounts are linked to this phone number. Please sign in with your email or registration number instead.'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT lower(trim(u.email))
      INTO v_auth_email
      FROM public.students s
      JOIN auth.users u ON u.id::text = NULLIF(trim(s.id::text), '')
      WHERE lower(trim(s.email)) = v_emails[1]
      ORDER BY s.created_at DESC NULLS LAST
      LIMIT 1;
      RETURN coalesce(v_auth_email, v_emails[1]);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
