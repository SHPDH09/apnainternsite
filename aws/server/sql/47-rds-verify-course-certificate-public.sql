-- Public verification for paid/free course completion certificates (CRS-* codes).
-- apna_course_cert_verify_v47

BEGIN;

CREATE OR REPLACE FUNCTION public.verify_course_certificate_public(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := nullif(trim(p_code), '');
  v_cert public.course_certificates%ROWTYPE;
  v_enrollment public.course_enrollments%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_student public.students%ROWTYPE;
BEGIN
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT cc.*
  INTO v_cert
  FROM public.course_certificates cc
  WHERE lower(trim(cc.certificate_code)) = lower(v_code)
  LIMIT 1;

  IF v_cert.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT e.*
  INTO v_enrollment
  FROM public.course_enrollments e
  WHERE e.id = v_cert.enrollment_id
  LIMIT 1;

  IF v_enrollment.id IS NULL OR v_enrollment.status <> 'completed' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT c.*
  INTO v_course
  FROM public.courses c
  WHERE c.id = v_enrollment.course_id
  LIMIT 1;

  SELECT s.*
  INTO v_student
  FROM public.students s
  WHERE s.id = v_enrollment.student_id::text
  LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'kind', 'course',
    'certificate_code', v_cert.certificate_code,
    'issued_at', v_cert.issued_at,
    'course', CASE
      WHEN v_course.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_course.id,
        'title', v_course.title,
        'slug', v_course.slug,
        'duration_text', v_course.duration_text,
        'instructor_name', v_course.instructor_name
      )
    END,
    'student', CASE
      WHEN v_student.id IS NULL THEN jsonb_build_object(
        'full_name', coalesce(v_enrollment.student_id::text, ''),
        'email', null,
        'college_name', null,
        'university_name', null
      )
      ELSE jsonb_build_object(
        'id', v_student.id,
        'full_name', v_student.full_name,
        'email', v_student.email,
        'college_name', v_student.college_name,
        'university_name', v_student.university_name
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_course_certificate_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_course_certificate_public(text) TO anon, authenticated;

COMMIT;
