-- Referral partner portal: load partner row for logged-in session (email or auth link heal).
-- Fixes dashboard "No referral profile is linked" when RLS blocks email-based table reads.

CREATE OR REPLACE FUNCTION public._referral_partner_row_for_session()
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_partner public.referral_partners%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT rp.*
  INTO v_partner
  FROM public.referral_partners rp
  WHERE rp.active = true
    AND (
      rp.auth_user_id = v_uid
      OR (v_email <> '' AND lower(trim(rp.email)) = v_email)
    )
  ORDER BY (rp.auth_user_id IS NOT DISTINCT FROM v_uid) DESC,
           rp.updated_at DESC NULLS LAST,
           rp.created_at DESC
  LIMIT 1;

  IF v_partner.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_partner.auth_user_id IS DISTINCT FROM v_uid THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN (
        'student'::public.app_role,
        'referral_partner'::public.app_role
      );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'referral_partner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.referral_partners
    SET auth_user_id = v_uid, updated_at = now()
    WHERE id = v_partner.id;

    v_partner.auth_user_id := v_uid;
  END IF;

  RETURN v_partner;
END;
$$;

REVOKE ALL ON FUNCTION public._referral_partner_row_for_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._referral_partner_row_for_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_partner_for_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.referral_partners%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  v_partner := public._referral_partner_row_for_session();

  IF v_partner.id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'no_partner');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'partner', json_build_object(
      'id', v_partner.id,
      'auth_user_id', v_partner.auth_user_id,
      'referral_code', v_partner.referral_code,
      'full_name', v_partner.full_name,
      'email', v_partner.email,
      'active', v_partner.active,
      'profile_image_url', v_partner.profile_image_url
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_partner_for_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_partner_for_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_referral_partner_portal_for_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.referral_partners%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_partner := public._referral_partner_row_for_session();

  IF v_partner.id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'no_partner');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'partner_id', v_partner.id,
    'referral_code', v_partner.referral_code,
    'partner', json_build_object(
      'id', v_partner.id,
      'auth_user_id', v_partner.auth_user_id,
      'referral_code', v_partner.referral_code,
      'full_name', v_partner.full_name,
      'email', v_partner.email,
      'active', v_partner.active,
      'profile_image_url', v_partner.profile_image_url
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_partner_portal_for_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_referral_partner_portal_for_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.referral_partner_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.referral_partners%ROWTYPE;
  v_code text;
  v_clicks bigint;
  v_total bigint;
  v_approved bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  v_partner := public._referral_partner_row_for_session();
  v_code := v_partner.referral_code;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'no_partner');
  END IF;

  SELECT count(*)::bigint INTO v_clicks
  FROM public.referral_clicks rc
  WHERE lower(trim(rc.referral_code)) = lower(trim(v_code));

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code));

  SELECT count(*)::bigint INTO v_approved
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND lower(coalesce(s.status, '')) IN ('active', 'approved');

  RETURN json_build_object(
    'referral_code', v_code,
    'total_clicks', coalesce(v_clicks, 0),
    'total_students', coalesce(v_total, 0),
    'approved_students', coalesce(v_approved, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referral_partner_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_partner_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.referral_partner_list_students(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.referral_partners%ROWTYPE;
  v_code text;
  v_limit int;
  v_offset int;
  v_search text;
  v_total bigint;
  v_rows json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_partner := public._referral_partner_row_for_session();
  v_code := v_partner.referral_code;

  IF v_code IS NULL THEN
    RETURN json_build_object('error', 'no_partner', 'rows', '[]'::json, 'total', 0);
  END IF;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(lower(trim(coalesce(p_search, ''))), '');

  SELECT count(*)::bigint INTO v_total
  FROM public.students s
  WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
    AND (
      v_search IS NULL
      OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.university_name, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(s.registration_id, '')) LIKE '%' || v_search || '%'
    );

  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.contact_number,
      s.college_name,
      s.university_name,
      s.course,
      s.degree,
      s.department,
      s.gender,
      s.class_semester,
      s.academic_session,
      s.roll_number,
      s.parent_name,
      s.registration_id,
      s.status,
      s.created_at
    FROM public.students s
    WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(v_code))
      AND (
        v_search IS NULL
        OR lower(coalesce(s.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.contact_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.college_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.university_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(s.registration_id, '')) LIKE '%' || v_search || '%'
      )
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', coalesce(v_rows, '[]'::json), 'total', coalesce(v_total, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.referral_partner_list_students(int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_partner_list_students(int, int, text) TO authenticated;
