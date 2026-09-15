-- Bug-fix document: attendance programme windows, directory unpaid filter, referral staff access.

-- ─── Attendance: BRABU window + stop counting all calendar days for unknown unis ───
CREATE OR REPLACE FUNCTION public.is_brabu_university_name(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(lower(trim(p_name)) ~ 'brabu|babasaheb\s*bhimrao\s*ambedkar', false);
$$;

CREATE OR REPLACE FUNCTION public.admin_get_attendance_counts()
RETURNS TABLE(student_id uuid, day_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN QUERY
  WITH att AS (
    SELECT
      a.student_id,
      (a.marked_at AT TIME ZONE 'Asia/Kolkata')::date AS ist_date,
      s.university_name
    FROM public.attendance a
    JOIN public.students s ON s.id = a.student_id
  ),
  windowed AS (
    SELECT
      att.student_id,
      att.ist_date,
      CASE
        WHEN public.is_bnmu_university_name(att.university_name)
          THEN att.ist_date BETWEEN DATE '2026-05-23' AND DATE '2026-06-21'
        WHEN public.is_lnmu_university_name(att.university_name)
          THEN att.ist_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-20'
        WHEN public.is_brabu_university_name(att.university_name)
          THEN att.ist_date BETWEEN DATE '2026-07-01' AND DATE '2026-07-30'
        ELSE att.ist_date BETWEEN DATE '2026-06-01' AND DATE '2026-06-20'
      END AS in_window
    FROM att
  )
  SELECT w.student_id, COUNT(DISTINCT w.ist_date)::bigint
  FROM windowed w
  WHERE w.in_window
  GROUP BY w.student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_attendance_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_attendance_counts() TO authenticated;

-- ─── Directory: exclude unpaid Student Data Upload rows (helper may already exist) ───
CREATE OR REPLACE FUNCTION public.student_is_pending_directory_payment(s public.students)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    lower(trim(COALESCE(public.safe_text_to_jsonb(s.metadata)->>'payment_required', 'false')))
      IN ('true', 't', '1'),
    false
  )
  OR COALESCE(
    lower(trim(COALESCE(public.safe_text_to_jsonb(s.metadata)->>'bulk_upload_paid', 'true')))
      IN ('false', 'f', '0'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_count_students_directory(
  p_search text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_university text DEFAULT NULL,
  p_college text DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL,
  p_mode text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
  v_mode text := NULLIF(trim(p_mode), '');
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN (
    SELECT count(*)::bigint
    FROM public.students s
    WHERE NOT public.student_is_pending_directory_payment(s)
    AND (
      v_search IS NULL
      OR s.full_name ILIKE '%' || v_search || '%'
      OR s.email ILIKE '%' || v_search || '%'
      OR s.registration_id ILIKE '%' || v_search || '%'
      OR s.contact_number ILIKE '%' || v_search || '%'
      OR s.roll_number ILIKE '%' || v_search || '%'
      OR s.college_name ILIKE '%' || v_search || '%'
      OR s.parent_name ILIKE '%' || v_search || '%'
    )
    AND (p_domain IS NULL OR p_domain = '' OR p_domain = 'all' OR s.internship_domain = p_domain)
    AND (p_university IS NULL OR p_university = '' OR p_university = 'all' OR s.university_name = p_university)
    AND (p_college IS NULL OR p_college = '' OR p_college = 'all' OR s.college_name = p_college)
    AND (v_mode IS NULL OR v_mode = 'all' OR public.student_record_internship_mode(s) = v_mode)
    AND (p_start IS NULL OR s.created_at >= p_start)
    AND (p_end IS NULL OR s.created_at <= p_end)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_students_directory(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_university text DEFAULT NULL,
  p_college text DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL,
  p_mode text DEFAULT NULL
)
RETURNS SETOF public.students
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
  v_mode text := NULLIF(trim(p_mode), '');
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
  v_offset integer := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  PERFORM public.assert_may_admin_list_students();

  RETURN QUERY
  SELECT s.*
  FROM public.students s
  WHERE NOT public.student_is_pending_directory_payment(s)
  AND (
    v_search IS NULL
    OR s.full_name ILIKE '%' || v_search || '%'
    OR s.email ILIKE '%' || v_search || '%'
    OR s.registration_id ILIKE '%' || v_search || '%'
    OR s.contact_number ILIKE '%' || v_search || '%'
    OR s.roll_number ILIKE '%' || v_search || '%'
    OR s.college_name ILIKE '%' || v_search || '%'
    OR s.parent_name ILIKE '%' || v_search || '%'
  )
  AND (p_domain IS NULL OR p_domain = '' OR p_domain = 'all' OR s.internship_domain = p_domain)
  AND (p_university IS NULL OR p_university = '' OR p_university = 'all' OR s.university_name = p_university)
  AND (p_college IS NULL OR p_college = '' OR p_college = 'all' OR s.college_name = p_college)
  AND (v_mode IS NULL OR v_mode = 'all' OR public.student_record_internship_mode(s) = v_mode)
  AND (p_start IS NULL OR s.created_at >= p_start)
  AND (p_end IS NULL OR s.created_at <= p_end)
  ORDER BY s.created_at DESC NULLS LAST, s.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_students_directory(text, text, text, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_students_directory(integer, integer, text, text, text, text, timestamptz, timestamptz, text) TO authenticated;

-- ─── Referrals: allow staff on admin_referral_overview ───
CREATE OR REPLACE FUNCTION public.admin_referral_overview()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_rows json;
BEGIN
  v_ok := public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role);
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.total_students DESC, t.full_name ASC), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      rp.id,
      rp.full_name,
      rp.email,
      rp.contact_number,
      rp.referral_code,
      rp.city,
      rp.college_name,
      rp.referral_type,
      rp.active,
      rp.created_at,
      rp.auth_user_id,
      (
        SELECT count(*)::bigint
        FROM public.referral_clicks rc
        WHERE lower(trim(rc.referral_code)) = lower(trim(rp.referral_code))
      ) AS total_clicks,
      (
        SELECT count(*)::bigint
        FROM public.students s
        WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(rp.referral_code))
      ) AS total_students,
      (
        SELECT count(*)::bigint
        FROM public.students s
        WHERE lower(trim(COALESCE(s.referral_code, ''))) = lower(trim(rp.referral_code))
          AND lower(coalesce(s.status, '')) IN ('active', 'approved')
      ) AS approved_students
    FROM public.referral_partners rp
  ) t;

  RETURN coalesce(v_rows, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;
