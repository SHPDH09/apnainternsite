/** Generated — run scripts/bundle-registration-bootstrap-sql.mjs */

export const SQL_12 = `-- Safe JSON parse for RDS students.metadata (often CSV-mangled / double-encoded text).
-- Fixes referral portal create: invalid input syntax for type json

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

  -- One layer of CSV quote-doubling repair: "" → "
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

REVOKE ALL ON FUNCTION public.safe_text_to_jsonb(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_text_to_jsonb(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_pass TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_meta jsonb;
  v_raw text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'staff'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = target_user_id;

  -- Best-effort directory password copy. Never fail (or wipe) on mangled metadata.
  BEGIN
    SELECT metadata::text INTO v_raw
    FROM public.students
    WHERE id::text = target_user_id::text
    LIMIT 1;

    IF FOUND THEN
      v_meta := public.safe_text_to_jsonb(v_raw);
      -- If metadata is non-empty garbage we cannot parse, leave it untouched.
      IF v_meta = '{}'::jsonb
         AND v_raw IS NOT NULL
         AND btrim(v_raw) <> ''
         AND btrim(v_raw) <> '{}'
         AND left(btrim(v_raw), 1) NOT IN ('{', '[') THEN
        NULL;
      ELSE
        UPDATE public.students
        SET metadata = (v_meta || jsonb_build_object('password', new_pass::text))
        WHERE id::text = target_user_id::text;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_student_directory_password(p_plain TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plain TEXT := trim(p_plain);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.students
  SET metadata = (
    public.safe_text_to_jsonb(metadata::text)
    || jsonb_build_object('password', v_plain)
  )
  WHERE id::text = auth.uid()::text;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_directory_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_student_directory_password(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_user_password(p_identifier text, p_otp text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_email text;
  v_otp text := trim(p_otp);
  v_pass text := trim(p_new_password);
BEGIN
  v_email := public.resolve_login_email(p_identifier);
  IF v_email IS NULL OR v_otp = '' OR v_pass IS NULL OR length(v_pass) < 6 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.password_resets
    WHERE lower(trim(email)) = v_email
      AND trim(otp) = v_otp
      AND expires_at > now()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(v_pass::text, extensions.gen_salt('bf'::text)),
    updated_at = now()
  WHERE id = v_user_id;

  BEGIN
    UPDATE public.students
    SET metadata = (
      public.safe_text_to_jsonb(metadata::text)
      || jsonb_build_object('password', v_pass)
    )
    WHERE id::text = v_user_id::text;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  DELETE FROM public.password_resets WHERE lower(trim(email)) = v_email;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(text, text, text) TO anon, authenticated;
`;

export const SQL_18 = `-- Fix post-payment enrollment on RDS (2026-07-22).
-- 1) payment_success.id had no DEFAULT → ensure_payment_success_log failed (23502)
-- 2) caller_can_manage_student_directory() missing → complete_student_registration
--    and apply_student_registration_password failed

BEGIN;

-- payment_success: restore uuid default + created_at default
ALTER TABLE public.payment_success
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.payment_success
  ALTER COLUMN created_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.ensure_payment_success_log(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payment_id text := NULLIF(trim(p_row->>'payment_id'), '');
  v_user_id uuid := NULLIF(trim(p_row->>'user_id'), '')::uuid;
  v_email text := lower(trim(COALESCE(p_row->>'email', '')));
  v_amount bigint;
  v_id uuid;
BEGIN
  IF v_payment_id IS NULL OR v_payment_id = '' THEN
    RAISE EXCEPTION 'payment_id required';
  END IF;
  IF v_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  IF v_user_id IS NULL THEN
    SELECT u.id INTO v_user_id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
    LIMIT 1;
  END IF;

  v_amount := COALESCE((p_row->>'amount_paise')::bigint, 0);
  IF v_amount < 0 THEN
    v_amount := 0;
  END IF;

  SELECT id INTO v_id
  FROM public.payment_success
  WHERE payment_id = v_payment_id
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.payment_success
    SET
      user_id = COALESCE(v_user_id, user_id),
      amount_paise = CASE WHEN v_amount > 0 THEN v_amount ELSE amount_paise END,
      email = v_email,
      full_name = COALESCE(NULLIF(trim(p_row->>'full_name'), ''), full_name),
      college_name = COALESCE(NULLIF(trim(p_row->>'college_name'), ''), college_name),
      status = COALESCE(NULLIF(trim(p_row->>'status'), ''), status, 'success'),
      cybercafe_shop_name = COALESCE(NULLIF(trim(p_row->>'cybercafe_shop_name'), ''), cybercafe_shop_name),
      cybercafe_email = COALESCE(NULLIF(trim(p_row->>'cybercafe_email'), ''), cybercafe_email)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.payment_success (
    id,
    user_id,
    payment_id,
    amount_paise,
    email,
    full_name,
    college_name,
    status,
    cybercafe_shop_name,
    cybercafe_email,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_payment_id,
    v_amount,
    v_email,
    COALESCE(NULLIF(trim(p_row->>'full_name'), ''), 'Student'),
    NULLIF(trim(p_row->>'college_name'), ''),
    COALESCE(NULLIF(trim(p_row->>'status'), ''), 'success'),
    NULLIF(trim(p_row->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_row->>'cybercafe_email'), ''),
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_payment_success_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_payment_success_log(jsonb) TO anon, authenticated, service_role;

-- Required by assert_can_write / apply_student_registration_password / complete_student_registration
CREATE OR REPLACE FUNCTION public.caller_can_manage_student_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  );
$$;

REVOKE ALL ON FUNCTION public.caller_can_manage_student_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_can_manage_student_directory() TO anon, authenticated, service_role;

-- RDS students.id/metadata are text (not uuid/jsonb) — rewrite enrollment RPC accordingly
CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_student jsonb,
  p_profile jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id text := NULLIF(trim(p_student->>'id'), '');
  v_email text := lower(trim(p_student->>'email'));
  v_reg text;
  v_requested_reg text := NULLIF(trim(p_student->>'registration_id'), '');
  v_meta jsonb := COALESCE(p_student->'metadata', '{}'::jsonb) - 'registration_id';
  v_meta_text text;
  v_legacy_reg text;
  v_year integer := extract(year FROM now())::integer;
BEGIN
  IF v_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Student id and email required';
  END IF;

  PERFORM public.assert_can_write_student_directory(v_id::uuid, v_email);

  SELECT NULLIF(trim(s.registration_id), '')
  INTO v_reg
  FROM public.students s
  WHERE s.id = v_id;

  IF v_reg IS NULL THEN
    IF v_requested_reg IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.registration_id = v_requested_reg AND s.id <> v_id
      ) THEN
      v_reg := v_requested_reg;
    ELSE
      SELECT NULLIF(trim(s.registration_id), '')
      INTO v_legacy_reg
      FROM public.students s
      WHERE lower(trim(s.email)) = v_email
        AND s.id <> v_id
      ORDER BY s.created_at DESC NULLS LAST
      LIMIT 1;

      IF v_legacy_reg IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.registration_id = v_legacy_reg AND s.id <> v_id
        ) THEN
        v_reg := v_legacy_reg;
      ELSE
        v_reg := public.allocate_next_registration_id(v_year);
        WHILE EXISTS (
          SELECT 1 FROM public.students s WHERE s.registration_id = v_reg AND s.id <> v_id
        ) LOOP
          v_reg := public.allocate_next_registration_id(v_year);
        END LOOP;
      END IF;
    END IF;
  END IF;

  v_meta_text := v_meta::text;

  INSERT INTO public.students (
    id, email, full_name, gender, parent_name, contact_number,
    university_name, college_name, course, internship_domain, degree,
    department, class_semester, academic_session, roll_number,
    emergency_name, emergency_contact, emergency_relation, status,
    cybercafe_shop_name, cybercafe_email, referral_code, registration_id,
    metadata, created_at
  )
  VALUES (
    v_id,
    v_email,
    NULLIF(trim(p_student->>'full_name'), ''),
    NULLIF(trim(p_student->>'gender'), ''),
    NULLIF(trim(p_student->>'parent_name'), ''),
    NULLIF(trim(p_student->>'contact_number'), ''),
    NULLIF(trim(p_student->>'university_name'), ''),
    NULLIF(trim(p_student->>'college_name'), ''),
    NULLIF(trim(p_student->>'course'), ''),
    NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
    NULLIF(trim(p_student->>'degree'), ''),
    NULLIF(trim(p_student->>'department'), ''),
    NULLIF(trim(p_student->>'class_semester'), ''),
    NULLIF(trim(p_student->>'academic_session'), ''),
    NULLIF(trim(p_student->>'roll_number'), ''),
    NULLIF(trim(p_student->>'emergency_name'), ''),
    NULLIF(trim(p_student->>'emergency_contact'), ''),
    NULLIF(trim(p_student->>'emergency_relation'), ''),
    COALESCE(NULLIF(trim(p_student->>'status'), ''), 'Active'),
    NULLIF(trim(p_student->>'cybercafe_shop_name'), ''),
    NULLIF(trim(p_student->>'cybercafe_email'), ''),
    NULLIF(trim(p_student->>'referral_code'), ''),
    v_reg,
    v_meta_text,
    now()::text
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.students.full_name),
    gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.students.gender),
    parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.students.parent_name),
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.students.contact_number),
    university_name = COALESCE(NULLIF(EXCLUDED.university_name, ''), public.students.university_name),
    college_name = COALESCE(NULLIF(EXCLUDED.college_name, ''), public.students.college_name),
    course = COALESCE(NULLIF(EXCLUDED.course, ''), public.students.course),
    internship_domain = COALESCE(NULLIF(EXCLUDED.internship_domain, ''), public.students.internship_domain),
    degree = COALESCE(NULLIF(EXCLUDED.degree, ''), public.students.degree),
    department = COALESCE(NULLIF(EXCLUDED.department, ''), public.students.department),
    class_semester = COALESCE(NULLIF(EXCLUDED.class_semester, ''), public.students.class_semester),
    academic_session = COALESCE(NULLIF(EXCLUDED.academic_session, ''), public.students.academic_session),
    roll_number = COALESCE(NULLIF(EXCLUDED.roll_number, ''), public.students.roll_number),
    emergency_name = COALESCE(NULLIF(EXCLUDED.emergency_name, ''), public.students.emergency_name),
    emergency_contact = COALESCE(NULLIF(EXCLUDED.emergency_contact, ''), public.students.emergency_contact),
    emergency_relation = COALESCE(NULLIF(EXCLUDED.emergency_relation, ''), public.students.emergency_relation),
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.students.status),
    cybercafe_shop_name = COALESCE(EXCLUDED.cybercafe_shop_name, public.students.cybercafe_shop_name),
    cybercafe_email = COALESCE(EXCLUDED.cybercafe_email, public.students.cybercafe_email),
    referral_code = COALESCE(EXCLUDED.referral_code, public.students.referral_code),
    registration_id = COALESCE(public.students.registration_id, EXCLUDED.registration_id),
    metadata = (
      COALESCE(public.safe_text_to_jsonb(public.students.metadata), '{}'::jsonb)
      || COALESCE(public.safe_text_to_jsonb(EXCLUDED.metadata), '{}'::jsonb)
    )::text;

  IF p_profile IS NOT NULL AND p_profile <> '{}'::jsonb THEN
    INSERT INTO public.profiles (
      id, full_name, email, contact_number, gender, parent_name
    )
    VALUES (
      COALESCE(NULLIF(trim(p_profile->>'id'), '')::uuid, v_id::uuid),
      COALESCE(NULLIF(trim(p_profile->>'full_name'), ''), 'Student'),
      lower(trim(COALESCE(p_profile->>'email', p_student->>'email'))),
      COALESCE(NULLIF(trim(p_profile->>'contact_number'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'gender'), ''), ''),
      COALESCE(NULLIF(trim(p_profile->>'parent_name'), ''), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      email = EXCLUDED.email,
      contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number),
      gender = COALESCE(NULLIF(EXCLUDED.gender, ''), public.profiles.gender),
      parent_name = COALESCE(NULLIF(EXCLUDED.parent_name, ''), public.profiles.parent_name);
  END IF;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
  RETURN v_reg;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%students_registration_id_key%' THEN
      UPDATE public.students
      SET
        email = v_email,
        full_name = COALESCE(NULLIF(trim(p_student->>'full_name'), ''), full_name),
        gender = COALESCE(NULLIF(trim(p_student->>'gender'), ''), gender),
        parent_name = COALESCE(NULLIF(trim(p_student->>'parent_name'), ''), parent_name),
        contact_number = COALESCE(NULLIF(trim(p_student->>'contact_number'), ''), contact_number),
        university_name = COALESCE(NULLIF(trim(p_student->>'university_name'), ''), university_name),
        college_name = COALESCE(NULLIF(trim(p_student->>'college_name'), ''), college_name),
        course = COALESCE(NULLIF(trim(p_student->>'course'), ''), course),
        internship_domain = COALESCE(
          NULLIF(trim(COALESCE(p_student->>'internship_domain', p_student->>'course')), ''),
          internship_domain
        ),
        degree = COALESCE(NULLIF(trim(p_student->>'degree'), ''), degree),
        department = COALESCE(NULLIF(trim(p_student->>'department'), ''), department),
        class_semester = COALESCE(NULLIF(trim(p_student->>'class_semester'), ''), class_semester),
        academic_session = COALESCE(NULLIF(trim(p_student->>'academic_session'), ''), academic_session),
        roll_number = COALESCE(NULLIF(trim(p_student->>'roll_number'), ''), roll_number),
        emergency_name = COALESCE(NULLIF(trim(p_student->>'emergency_name'), ''), emergency_name),
        emergency_contact = COALESCE(NULLIF(trim(p_student->>'emergency_contact'), ''), emergency_contact),
        emergency_relation = COALESCE(NULLIF(trim(p_student->>'emergency_relation'), ''), emergency_relation),
        status = COALESCE(NULLIF(trim(p_student->>'status'), ''), status, 'Active'),
        cybercafe_shop_name = COALESCE(NULLIF(trim(p_student->>'cybercafe_shop_name'), ''), cybercafe_shop_name),
        cybercafe_email = COALESCE(NULLIF(trim(p_student->>'cybercafe_email'), ''), cybercafe_email),
        referral_code = COALESCE(NULLIF(trim(p_student->>'referral_code'), ''), referral_code),
        metadata = (
          COALESCE(public.safe_text_to_jsonb(metadata), '{}'::jsonb) || v_meta
        )::text
      WHERE id = v_id;

      SELECT registration_id INTO v_reg FROM public.students WHERE id = v_id;
      RETURN v_reg;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_registration(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_student_registration(jsonb, jsonb) TO anon, authenticated, service_role;

COMMIT;
`;

export const SQL_19 = `-- Fix post-payment password apply on RDS (2026-07-22).
-- _set_auth_user_password_internal compared students.id (text) to uuid and
-- treated metadata as jsonb → "operator does not exist: text = uuid".
-- That error was also mislabeled as "password setup is missing" by the API adapter.

BEGIN;

CREATE OR REPLACE FUNCTION public._set_auth_user_password_internal(
  p_user_id uuid,
  p_email text,
  p_plain text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_plain text := trim(p_plain);
  v_email text := lower(trim(p_email));
  v_meta jsonb;
BEGIN
  IF p_user_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'User id and email required';
  END IF;
  IF v_plain IS NULL OR length(v_plain) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(v_plain::text, extensions.gen_salt('bf'::text)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.ensure_auth_email_identity(p_user_id, v_email);

  -- students.id and metadata are text on RDS (CSV import); never compare uuid to text.
  BEGIN
    SELECT public.safe_text_to_jsonb(s.metadata::text)
    INTO v_meta
    FROM public.students s
    WHERE s.id = p_user_id::text
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.students
      SET metadata = (COALESCE(v_meta, '{}'::jsonb) || jsonb_build_object('password', v_plain))::text
      WHERE id = p_user_id::text;
    END IF;
  EXCEPTION WHEN others THEN
    -- Auth password is already set; directory copy is best-effort.
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_student_registration_password(
  p_user_id uuid,
  p_email text,
  p_plain text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
BEGIN
  PERFORM public.assert_can_write_student_directory(p_user_id, p_email);
  PERFORM public._set_auth_user_password_internal(p_user_id, p_email, p_plain);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_student_auth_login(
  p_email text,
  p_plain text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_plain text := trim(p_plain);
  v_uid uuid;
  v_meta_pw text;
BEGIN
  IF v_email = '' OR v_plain = '' OR length(v_plain) < 5 THEN
    RETURN FALSE;
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email;

  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT NULLIF(trim(public.safe_text_to_jsonb(s.metadata::text)->>'password'), '')
  INTO v_meta_pw
  FROM public.students s
  WHERE lower(trim(s.email)) = v_email
    AND NULLIF(trim(public.safe_text_to_jsonb(s.metadata::text)->>'password'), '') = v_plain
  ORDER BY (s.id = v_uid::text) DESC, s.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_meta_pw IS NULL THEN
    SELECT NULLIF(trim(po.metadata->>'password'), '')
    INTO v_meta_pw
    FROM public.payment_orders po
    WHERE lower(trim(COALESCE(po.user_email, po.metadata->>'email', ''))) = v_email
      AND po.status = 'success'
      AND NULLIF(trim(po.metadata->>'password'), '') = v_plain
    ORDER BY po.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_meta_pw IS NULL OR v_meta_pw <> v_plain THEN
    RETURN FALSE;
  END IF;

  PERFORM public._set_auth_user_password_internal(v_uid, v_email, v_plain);
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public._set_auth_user_password_internal(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_student_registration_password(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_student_auth_login(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_student_registration_password(uuid, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_student_auth_login(text, text)
  TO anon, authenticated, service_role;

COMMIT;
`;

export const SQL_20 = `-- Fix admin_create_minimal_student_registration for RDS where students.id/metadata are text.
-- Error: COALESCE types text and jsonb cannot be matched

BEGIN;

DROP FUNCTION IF EXISTS public.admin_create_minimal_student_registration(text, text, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.admin_create_minimal_student_registration(text, text, text, text, text, bigint, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_minimal_student_registration(
  p_email               text,
  p_password            text,
  p_phone               text,
  p_full_name           text     DEFAULT NULL,
  p_payment_id          text     DEFAULT NULL,
  p_amount_paise        bigint   DEFAULT NULL,
  p_registration_source text     DEFAULT NULL,
  p_university_name     text     DEFAULT NULL,
  p_college_name        text     DEFAULT NULL,
  p_course              text     DEFAULT NULL,
  p_degree              text     DEFAULT NULL,
  p_department          text     DEFAULT NULL,
  p_subject             text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email     text   := lower(trim(p_email));
  v_password  text   := trim(p_password);
  v_phone     text   := nullif(trim(p_phone), '');
  v_name      text   := coalesce(nullif(trim(p_full_name), ''), 'Student');
  v_uni       text   := nullif(trim(coalesce(p_university_name, '')), '');
  v_college   text   := nullif(trim(coalesce(p_college_name,   '')), '');
  v_course    text   := nullif(trim(coalesce(p_course,         '')), '');
  v_degree    text   := nullif(trim(coalesce(p_degree,         '')), '');
  v_dept      text   := nullif(trim(coalesce(p_department,     '')), '');
  v_subject   text   := nullif(trim(coalesce(p_subject,        '')), '');
  v_src       text   := coalesce(nullif(trim(p_registration_source), ''), 'admin_add_registration');
  v_pay_id    text;
  v_amount    bigint;
  v_uid       uuid;
  v_auth_id   uuid;
  v_reg       text;
  v_meta      jsonb;
  v_meta_text text;
  v_po        record;
BEGIN
  IF NOT public.caller_can_manage_student_directory() THEN
    RAISE EXCEPTION 'Access denied: admin or staff only';
  END IF;

  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Valid email required';
  END IF;

  IF v_password IS NULL OR length(v_password) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number required';
  END IF;

  SELECT
    po.payment_id,
    greatest(coalesce(po.amount, 0), 100) AS amount,
    coalesce(po.metadata, '{}'::jsonb)    AS metadata
  INTO v_po
  FROM public.payment_orders po
  WHERE lower(trim(coalesce(po.metadata->>'email', po.user_email, ''))) = v_email
    AND (po.status = 'success' OR po.payment_id ~* '^pay_')
  ORDER BY po.created_at DESC
  LIMIT 1;

  v_pay_id := nullif(trim(p_payment_id), '');
  IF v_pay_id IS NULL AND v_po.payment_id IS NOT NULL AND trim(v_po.payment_id) ~* '^pay_' THEN
    v_pay_id := trim(v_po.payment_id);
  END IF;
  IF v_pay_id IS NULL THEN
    v_pay_id := 'pay_admin_manual_' || replace(gen_random_uuid()::text, '-', '');
  END IF;

  v_amount := coalesce(p_amount_paise, v_po.amount, 50000);
  v_amount := greatest(v_amount, 100);

  IF v_po.metadata IS NOT NULL THEN
    v_meta := v_po.metadata;
    v_name := coalesce(
      nullif(trim(v_meta->>'fullName'),   ''),
      nullif(trim(v_meta->>'full_name'),  ''),
      v_name
    );
    v_phone := coalesce(
      nullif(trim(v_meta->>'contact_number'), ''),
      nullif(trim(v_meta->>'contact'),        ''),
      v_phone
    );
  ELSE
    v_meta := '{}'::jsonb;
  END IF;

  SELECT NULLIF(trim(s.id::text), '')::uuid INTO v_uid
  FROM public.students s
  WHERE lower(trim(s.email)) = v_email
    AND NULLIF(trim(s.id::text), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT u.id INTO v_auth_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_uid IS NOT NULL AND v_auth_id IS NOT NULL AND v_uid <> v_auth_id THEN
    DELETE FROM auth.sessions      WHERE user_id = v_auth_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = v_auth_id;
    DELETE FROM auth.identities    WHERE user_id = v_auth_id;
    DELETE FROM public.user_roles ur1
    WHERE ur1.user_id = v_auth_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = v_uid AND ur2.role = ur1.role
      );
    UPDATE public.payment_success SET user_id = v_uid WHERE user_id = v_auth_id;
    DELETE FROM auth.users WHERE id = v_auth_id;
    v_auth_id := NULL;
  END IF;

  IF v_uid IS NULL THEN
    v_uid := coalesce(v_auth_id, gen_random_uuid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  ELSE
    PERFORM public._set_auth_user_password_internal(v_uid, v_email, v_password);
  END IF;

  BEGIN
    v_reg := public.allocate_next_registration_id(extract(year FROM now())::integer);
  EXCEPTION WHEN undefined_function THEN
    v_reg := 'EZY/' || extract(year FROM now())::text || '/INT/' || replace(substr(gen_random_uuid()::text, 1, 8), '-', '');
  END;

  v_meta := coalesce(v_meta, '{}'::jsonb) || jsonb_build_object(
    'password',              v_password,
    'source',                v_src,
    'created_by',            auth.uid()::text,
    'razorpay_payment_id',   v_pay_id,
    'department',            v_dept,
    'subject',               v_subject
  );
  v_meta_text := v_meta::text;

  INSERT INTO public.students (
    id, email, full_name, gender, contact_number,
    university_name, college_name, course, internship_domain,
    status, registration_id, metadata
  ) VALUES (
    v_uid::text, v_email, v_name, 'Other', v_phone,
    coalesce(v_uni,     ''),
    coalesce(v_college, ''),
    coalesce(v_course,  'Internship'),
    coalesce(v_degree,  'Internship'),
    'Active', v_reg,
    v_meta_text
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = excluded.email,
    full_name       = coalesce(nullif(excluded.full_name, ''), public.students.full_name),
    contact_number  = coalesce(nullif(excluded.contact_number, ''), public.students.contact_number),
    university_name = coalesce(nullif(excluded.university_name, ''), public.students.university_name),
    college_name    = coalesce(nullif(excluded.college_name, ''), public.students.college_name),
    course          = coalesce(nullif(excluded.course, ''), public.students.course),
    internship_domain = coalesce(nullif(excluded.internship_domain, ''), public.students.internship_domain),
    status          = 'Active',
    registration_id = CASE
      WHEN trim(coalesce(public.students.registration_id, '')) ~* '^EZY/PENDING/' THEN excluded.registration_id
      WHEN public.students.registration_id IS NULL OR trim(public.students.registration_id) = '' THEN excluded.registration_id
      ELSE public.students.registration_id
    END,
    metadata = (
      coalesce(public.safe_text_to_jsonb(public.students.metadata), '{}'::jsonb)
      || coalesce(public.safe_text_to_jsonb(excluded.metadata), '{}'::jsonb)
    )::text;

  INSERT INTO public.profiles (id, full_name, email, contact_number)
  VALUES (v_uid, v_name, v_email, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name      = excluded.full_name,
    email          = excluded.email,
    contact_number = excluded.contact_number;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'student')
  ON CONFLICT DO NOTHING;

  PERFORM public.ensure_payment_success_log(jsonb_build_object(
    'user_id',      v_uid::text,
    'payment_id',   v_pay_id,
    'amount_paise', v_amount,
    'email',        v_email,
    'full_name',    v_name,
    'status',       'success'
  ));

  UPDATE public.payment_success SET user_id = v_uid WHERE lower(trim(email)) = v_email;

  UPDATE public.payment_orders
  SET status     = 'success',
      payment_id = coalesce(nullif(trim(payment_id), ''), v_pay_id),
      updated_at = now()
  WHERE lower(trim(coalesce(metadata->>'email', user_email, ''))) = v_email;

  BEGIN
    PERFORM public.ensure_student_registration_id(v_uid);
  EXCEPTION
    WHEN undefined_function THEN NULL;
  END;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_uid::text;

  RETURN jsonb_build_object(
    'ok',              true,
    'user_id',         v_uid::text,
    'email',           v_email,
    'registration_id', v_reg,
    'payment_id',      v_pay_id,
    'paid',            public.student_has_paid_enrollment(v_uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_minimal_student_registration(
  text, text, text, text, text, bigint, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_minimal_student_registration(
  text, text, text, text, text, bigint, text, text, text, text, text, text, text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
`;

export const SQL_21 = `-- admin_create_minimal_student_registration for RDS where students.id is uuid (Mumbai staging / Supabase-shaped).
-- apna_admin_reg_uuid_v21

BEGIN;

DROP FUNCTION IF EXISTS public.admin_create_minimal_student_registration(text, text, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.admin_create_minimal_student_registration(text, text, text, text, text, bigint, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_minimal_student_registration(
  p_email               text,
  p_password            text,
  p_phone               text,
  p_full_name           text     DEFAULT NULL,
  p_payment_id          text     DEFAULT NULL,
  p_amount_paise        bigint   DEFAULT NULL,
  p_registration_source text     DEFAULT NULL,
  p_university_name     text     DEFAULT NULL,
  p_college_name        text     DEFAULT NULL,
  p_course              text     DEFAULT NULL,
  p_degree              text     DEFAULT NULL,
  p_department          text     DEFAULT NULL,
  p_subject             text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
-- apna_admin_reg_uuid_v21
DECLARE
  v_email     text   := lower(trim(p_email));
  v_password  text   := trim(p_password);
  v_phone     text   := nullif(trim(p_phone), '');
  v_name      text   := coalesce(nullif(trim(p_full_name), ''), 'Student');
  v_uni       text   := nullif(trim(coalesce(p_university_name, '')), '');
  v_college   text   := nullif(trim(coalesce(p_college_name,   '')), '');
  v_course    text   := nullif(trim(coalesce(p_course,         '')), '');
  v_degree    text   := nullif(trim(coalesce(p_degree,         '')), '');
  v_dept      text   := nullif(trim(coalesce(p_department,     '')), '');
  v_subject   text   := nullif(trim(coalesce(p_subject,        '')), '');
  v_src       text   := coalesce(nullif(trim(p_registration_source), ''), 'admin_add_registration');
  v_pay_id    text;
  v_amount    bigint;
  v_uid       uuid;
  v_auth_id   uuid;
  v_reg       text;
  v_meta      jsonb;
  v_po        record;
BEGIN
  IF NOT public.caller_can_manage_student_directory() THEN
    RAISE EXCEPTION 'Access denied: admin or staff only';
  END IF;

  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Valid email required';
  END IF;

  IF v_password IS NULL OR length(v_password) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number required';
  END IF;

  SELECT
    po.payment_id,
    greatest(coalesce(po.amount, 0), 100) AS amount,
    coalesce(po.metadata, '{}'::jsonb)    AS metadata
  INTO v_po
  FROM public.payment_orders po
  WHERE lower(trim(coalesce(po.metadata->>'email', po.user_email, ''))) = v_email
    AND (po.status = 'success' OR po.payment_id ~* '^pay_')
  ORDER BY po.created_at DESC
  LIMIT 1;

  v_pay_id := nullif(trim(p_payment_id), '');
  IF v_pay_id IS NULL AND v_po.payment_id IS NOT NULL AND trim(v_po.payment_id) ~* '^pay_' THEN
    v_pay_id := trim(v_po.payment_id);
  END IF;
  IF v_pay_id IS NULL THEN
    v_pay_id := 'pay_admin_manual_' || replace(gen_random_uuid()::text, '-', '');
  END IF;

  v_amount := coalesce(p_amount_paise, v_po.amount, 50000);
  v_amount := greatest(v_amount, 100);

  IF v_po.metadata IS NOT NULL THEN
    v_meta := v_po.metadata;
    v_name := coalesce(
      nullif(trim(v_meta->>'fullName'),   ''),
      nullif(trim(v_meta->>'full_name'),  ''),
      v_name
    );
    v_phone := coalesce(
      nullif(trim(v_meta->>'contact_number'), ''),
      nullif(trim(v_meta->>'contact'),        ''),
      v_phone
    );
  ELSE
    v_meta := '{}'::jsonb;
  END IF;

  SELECT s.id INTO v_uid
  FROM public.students s
  WHERE lower(trim(s.email)) = v_email
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT u.id INTO v_auth_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_uid IS NOT NULL AND v_auth_id IS NOT NULL AND v_uid <> v_auth_id THEN
    DELETE FROM auth.sessions      WHERE user_id = v_auth_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = v_auth_id;
    DELETE FROM auth.identities    WHERE user_id = v_auth_id;
    DELETE FROM public.user_roles ur1
    WHERE ur1.user_id = v_auth_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = v_uid AND ur2.role = ur1.role
      );
    UPDATE public.payment_success SET user_id = v_uid WHERE user_id = v_auth_id;
    DELETE FROM auth.users WHERE id = v_auth_id;
    v_auth_id := NULL;
  END IF;

  IF v_uid IS NULL THEN
    v_uid := coalesce(v_auth_id, gen_random_uuid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  ELSE
    PERFORM public._set_auth_user_password_internal(v_uid, v_email, v_password);
  END IF;

  BEGIN
    v_reg := public.allocate_next_registration_id(extract(year FROM now())::integer);
  EXCEPTION WHEN undefined_function THEN
    v_reg := 'EZY/' || extract(year FROM now())::text || '/INT/' || replace(substr(gen_random_uuid()::text, 1, 8), '-', '');
  END;

  v_meta := coalesce(v_meta, '{}'::jsonb) || jsonb_build_object(
    'password',              v_password,
    'source',                v_src,
    'created_by',            auth.uid()::text,
    'razorpay_payment_id',   v_pay_id,
    'department',            v_dept,
    'subject',               v_subject
  );

  INSERT INTO public.students (
    id, email, full_name, gender, contact_number,
    university_name, college_name, course, internship_domain,
    status, registration_id, metadata
  ) VALUES (
    v_uid, v_email, v_name, 'Other', v_phone,
    coalesce(v_uni,     ''),
    coalesce(v_college, ''),
    coalesce(v_course,  'Internship'),
    coalesce(v_degree,  'Internship'),
    'Active', v_reg,
    v_meta
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = excluded.email,
    full_name       = coalesce(nullif(excluded.full_name, ''), public.students.full_name),
    contact_number  = coalesce(nullif(excluded.contact_number, ''), public.students.contact_number),
    university_name = coalesce(nullif(excluded.university_name, ''), public.students.university_name),
    college_name    = coalesce(nullif(excluded.college_name, ''), public.students.college_name),
    course          = coalesce(nullif(excluded.course, ''), public.students.course),
    internship_domain = coalesce(nullif(excluded.internship_domain, ''), public.students.internship_domain),
    status          = 'Active',
    registration_id = CASE
      WHEN trim(coalesce(public.students.registration_id, '')) ~* '^EZY/PENDING/' THEN excluded.registration_id
      WHEN public.students.registration_id IS NULL OR trim(public.students.registration_id) = '' THEN excluded.registration_id
      ELSE public.students.registration_id
    END,
    metadata = coalesce(public.students.metadata, '{}'::jsonb) || excluded.metadata;

  INSERT INTO public.profiles (id, full_name, email, contact_number)
  VALUES (v_uid, v_name, v_email, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name      = excluded.full_name,
    email          = excluded.email,
    contact_number = excluded.contact_number;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'student')
  ON CONFLICT DO NOTHING;

  PERFORM public.ensure_payment_success_log(jsonb_build_object(
    'user_id',      v_uid::text,
    'payment_id',   v_pay_id,
    'amount_paise', v_amount,
    'email',        v_email,
    'full_name',    v_name,
    'status',       'success'
  ));

  UPDATE public.payment_success SET user_id = v_uid WHERE lower(trim(email)) = v_email;

  UPDATE public.payment_orders
  SET status     = 'success',
      payment_id = coalesce(nullif(trim(payment_id), ''), v_pay_id),
      updated_at = now()
  WHERE lower(trim(coalesce(metadata->>'email', user_email, ''))) = v_email;

  BEGIN
    PERFORM public.ensure_student_registration_id(v_uid);
  EXCEPTION
    WHEN undefined_function THEN NULL;
  END;

  SELECT registration_id INTO v_reg FROM public.students WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok',              true,
    'user_id',         v_uid::text,
    'email',           v_email,
    'registration_id', v_reg,
    'payment_id',      v_pay_id,
    'paid',            public.student_has_paid_enrollment(v_uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_minimal_student_registration(
  text, text, text, text, text, bigint, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_minimal_student_registration(
  text, text, text, text, text, bigint, text, text, text, text, text, text, text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
`;

export const REGISTRATION_BOOTSTRAP_SQL_BY_BASENAME: Record<string, string> = {
  "12-rds-safe-metadata-json.sql": SQL_12,
  "18-rds-fix-payment-enrollment.sql": SQL_18,
  "19-rds-fix-password-text-id.sql": SQL_19,
  "20-rds-fix-admin-create-registration-text-meta.sql": SQL_20,
  "21-rds-admin-create-registration-uuid-id.sql": SQL_21,
};
