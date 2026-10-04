-- Certificate generation + directory fixes for RDS (students.id text, certificates.user_id uuid).
-- apna_cert_issue_v27

BEGIN;

ALTER TABLE public.certificates
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS display_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.admin_bulk_issue_certificates(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row jsonb;
  v_uid uuid;
  v_cert_id text;
  v_student_name text;
  v_internship text;
  v_duration text;
  v_status text;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  v_issued integer := 0;
  v_rec public.certificates%ROWTYPE;
BEGIN
  PERFORM public.assert_may_admin_list_students();

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'issued', 0, 'skipped', 0, 'rows', '[]'::jsonb);
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    BEGIN
    v_uid := NULLIF(trim(v_row->>'user_id'), '')::uuid;

    IF v_uid IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.certificates c WHERE c.user_id::text = v_uid::text
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_student_name := coalesce(nullif(trim(v_row->>'student_name'), ''), 'Student');
    v_internship := coalesce(nullif(trim(v_row->>'internship_name'), ''), 'Internship');
    v_duration := coalesce(nullif(trim(v_row->>'duration'), ''), '30 Days');
    v_status := coalesce(nullif(trim(v_row->>'status'), ''), 'Active');
    v_cert_id := nullif(trim(v_row->>'certificate_id'), '');

    IF v_cert_id IS NULL THEN
      v_cert_id := 'API/INT/' || extract(year FROM now())::text || '/'
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;

    WHILE EXISTS (SELECT 1 FROM public.certificates c WHERE c.certificate_id = v_cert_id) LOOP
      v_cert_id := 'API/INT/' || extract(year FROM now())::text || '/'
        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    END LOOP;

    INSERT INTO public.certificates (
      user_id, student_name, internship_name, duration, certificate_id, status
    )
    VALUES (v_uid, v_student_name, v_internship, v_duration, v_cert_id, v_status)
    RETURNING * INTO v_rec;

    v_inserted := v_inserted || jsonb_build_array(to_jsonb(v_rec));
    v_issued := v_issued + 1;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_skipped := v_skipped + 1;
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'issued', v_issued,
    'skipped', v_skipped,
    'rows', v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_issue_certificates(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_issue_certificates(jsonb) TO authenticated;

-- Directory RPCs: join students on text ids
DROP FUNCTION IF EXISTS public.admin_count_certificates_directory(text, text[], text[], text, text);
DROP FUNCTION IF EXISTS public.admin_list_certificates_directory(integer, integer, text, text[], text[], text, text);
DROP FUNCTION IF EXISTS public.admin_count_certificates_directory(text, text[], text[], text, text, text[], text[]);
DROP FUNCTION IF EXISTS public.admin_list_certificates_directory(integer, integer, text, text[], text[], text, text, text[], text[]);

CREATE OR REPLACE FUNCTION public.admin_count_certificates_directory(
  p_search text DEFAULT NULL,
  p_universities text[] DEFAULT NULL,
  p_colleges text[] DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_mode text DEFAULT NULL,
  p_departments text[] DEFAULT NULL,
  p_subjects text[] DEFAULT NULL
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
    FROM public.certificates c
    LEFT JOIN public.students s ON s.id::text = c.user_id::text
    WHERE (
      v_search IS NULL
      OR c.student_name ILIKE '%' || v_search || '%'
      OR c.certificate_id ILIKE '%' || v_search || '%'
      OR s.full_name ILIKE '%' || v_search || '%'
      OR s.email ILIKE '%' || v_search || '%'
      OR s.registration_id ILIKE '%' || v_search || '%'
      OR s.roll_number ILIKE '%' || v_search || '%'
    )
    AND (
      p_universities IS NULL OR cardinality(p_universities) = 0
      OR s.university_name = ANY (p_universities)
    )
    AND (
      p_colleges IS NULL OR cardinality(p_colleges) = 0
      OR s.college_name = ANY (p_colleges)
    )
    AND (
      p_departments IS NULL OR cardinality(p_departments) = 0
      OR trim(coalesce(s.department, public.safe_text_to_jsonb(s.metadata)->>'department', '')) = ANY (p_departments)
    )
    AND (
      p_subjects IS NULL OR cardinality(p_subjects) = 0
      OR trim(coalesce(s.subject, public.safe_text_to_jsonb(s.metadata)->>'subject', '')) = ANY (p_subjects)
    )
    AND (
      p_domain IS NULL OR p_domain = '' OR p_domain = 'all'
      OR s.internship_domain = p_domain OR s.course = p_domain
    )
    AND (
      v_mode IS NULL OR v_mode = 'all' OR s.id IS NULL
      OR public.student_record_internship_mode(s) = v_mode
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_certificates_directory(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_universities text[] DEFAULT NULL,
  p_colleges text[] DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_mode text DEFAULT NULL,
  p_departments text[] DEFAULT NULL,
  p_subjects text[] DEFAULT NULL
)
RETURNS SETOF public.certificates
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
  SELECT c.*
  FROM public.certificates c
  LEFT JOIN public.students s ON s.id::text = c.user_id::text
  WHERE (
    v_search IS NULL
    OR c.student_name ILIKE '%' || v_search || '%'
    OR c.certificate_id ILIKE '%' || v_search || '%'
    OR s.full_name ILIKE '%' || v_search || '%'
    OR s.email ILIKE '%' || v_search || '%'
    OR s.registration_id ILIKE '%' || v_search || '%'
    OR s.roll_number ILIKE '%' || v_search || '%'
  )
  AND (
    p_universities IS NULL OR cardinality(p_universities) = 0
    OR s.university_name = ANY (p_universities)
  )
  AND (
    p_colleges IS NULL OR cardinality(p_colleges) = 0
    OR s.college_name = ANY (p_colleges)
  )
  AND (
    p_departments IS NULL OR cardinality(p_departments) = 0
    OR trim(coalesce(s.department, public.safe_text_to_jsonb(s.metadata)->>'department', '')) = ANY (p_departments)
  )
  AND (
    p_subjects IS NULL OR cardinality(p_subjects) = 0
    OR trim(coalesce(s.subject, public.safe_text_to_jsonb(s.metadata)->>'subject', '')) = ANY (p_subjects)
  )
  AND (
    p_domain IS NULL OR p_domain = '' OR p_domain = 'all'
    OR s.internship_domain = p_domain OR s.course = p_domain
  )
  AND (
    v_mode IS NULL OR v_mode = 'all' OR s.id IS NULL
    OR public.student_record_internship_mode(s) = v_mode
  )
  ORDER BY c.created_at DESC NULLS LAST, c.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_certificates_directory(
  text, text[], text[], text, text, text[], text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_certificates_directory(
  integer, integer, text, text[], text[], text, text, text[], text[]
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
