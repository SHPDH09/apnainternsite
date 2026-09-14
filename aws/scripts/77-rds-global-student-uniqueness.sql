-- Global student field normalization, validation, duplicate prevention, and safe unique indexes.
-- Applies to every insert/update on public.students (trigger) plus RPC helpers for pre-checks.

-- ---------------------------------------------------------------------------
-- Normalization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_student_email(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(lower(trim(coalesce(p_raw, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_student_roll_number(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v = '' OR v IN ('—', '-', 'na', 'n/a', 'none', 'null') THEN NULL
    ELSE v
  END
  FROM (
    SELECT lower(regexp_replace(trim(coalesce(p_raw, '')), '\s+', ' ', 'g')) AS v
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.normalize_student_registration_number(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v = '' OR v IN ('—', '-', 'na', 'n/a', 'none', 'null') THEN NULL
    ELSE v
  END
  FROM (
    SELECT lower(regexp_replace(trim(coalesce(p_raw, '')), '\s+', ' ', 'g')) AS v
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.is_portal_registration_id(p_raw text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(trim(coalesce(p_raw, '')), '') ~* '^EZY/';
$$;

CREATE OR REPLACE FUNCTION public.normalize_university_key(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(lower(regexp_replace(trim(coalesce(p_raw, '')), '\s+', ' ', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.student_university_roll_from_meta(p_meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_student_roll_number(
    coalesce(p_meta->>'university_roll_number', p_meta->>'universityRollNumber')
  );
$$;

CREATE OR REPLACE FUNCTION public.student_university_roll_from_meta_text(p_meta text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.student_university_roll_from_meta(
    CASE
      WHEN p_meta IS NULL OR trim(p_meta) = '' THEN '{}'::jsonb
      WHEN p_meta ~ '^\s*\{' THEN p_meta::jsonb
      ELSE public.safe_text_to_jsonb(p_meta)
    END
  );
$$;

GRANT EXECUTE ON FUNCTION public.normalize_student_email(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_student_roll_number(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_student_registration_number(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_portal_registration_id(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_university_key(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Duplicate report (run before applying unique indexes in production)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_student_field_duplicates()
RETURNS TABLE (
  field_name text,
  field_value text,
  conflict_count bigint,
  sample_student_ids text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'email'::text, d.v, d.cnt, d.ids
  FROM (
    SELECT public.normalize_student_email(s.email) AS v,
           count(*) AS cnt,
           array_agg(s.id::text ORDER BY s.created_at NULLS LAST) AS ids
    FROM public.students s
    WHERE public.normalize_student_email(s.email) IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) d
  UNION ALL
  SELECT 'phone', d.v, d.cnt, d.ids
  FROM (
    SELECT public.normalize_phone_tail(s.contact_number) AS v,
           count(*) AS cnt,
           array_agg(s.id::text ORDER BY s.created_at NULLS LAST) AS ids
    FROM public.students s
    WHERE public.normalize_phone_tail(s.contact_number) IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) d
  UNION ALL
  SELECT 'university_roll_number', d.v, d.cnt, d.ids
  FROM (
    SELECT public.normalize_university_key(s.university_name) || '|' ||
           public.normalize_student_roll_number(s.roll_number) AS v,
           count(*) AS cnt,
           array_agg(s.id::text ORDER BY s.created_at NULLS LAST) AS ids
    FROM public.students s
    WHERE public.normalize_university_key(s.university_name) IS NOT NULL
      AND public.normalize_student_roll_number(s.roll_number) IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) d
  UNION ALL
  SELECT 'university_registration_number', d.v, d.cnt, d.ids
  FROM (
    SELECT public.normalize_university_key(s.university_name) || '|' ||
           public.normalize_student_registration_number(s.registration_id) AS v,
           count(*) AS cnt,
           array_agg(s.id::text ORDER BY s.created_at NULLS LAST) AS ids
    FROM public.students s
    WHERE public.normalize_university_key(s.university_name) IS NOT NULL
      AND public.normalize_student_registration_number(s.registration_id) IS NOT NULL
      AND NOT public.is_portal_registration_id(s.registration_id)
    GROUP BY 1
    HAVING count(*) > 1
  ) d
  UNION ALL
  SELECT 'registration_id_global', d.v, d.cnt, d.ids
  FROM (
    SELECT public.normalize_student_registration_number(s.registration_id) AS v,
           count(*) AS cnt,
           array_agg(s.id::text ORDER BY s.created_at NULLS LAST) AS ids
    FROM public.students s
    WHERE public.normalize_student_registration_number(s.registration_id) IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  ) d;
$$;

GRANT EXECUTE ON FUNCTION public.report_student_field_duplicates() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Central validation RPC (pre-insert/update checks from app layer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_student_uniqueness(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_roll_number text DEFAULT NULL,
  p_registration_number text DEFAULT NULL,
  p_university_name text DEFAULT NULL,
  p_university_roll_number text DEFAULT NULL,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := public.normalize_student_email(p_email);
  v_phone text := public.normalize_phone_tail(p_phone);
  v_roll text := public.normalize_student_roll_number(p_roll_number);
  v_reg text := public.normalize_student_registration_number(p_registration_number);
  v_uni text := public.normalize_university_key(p_university_name);
  v_uni_roll text := public.normalize_student_roll_number(p_university_roll_number);
  v_email_taken boolean := false;
  v_phone_taken boolean := false;
  v_roll_taken boolean := false;
  v_reg_taken boolean := false;
  v_uni_roll_taken boolean := false;
  v_messages text[] := ARRAY[]::text[];
BEGIN
  IF v_email IS NOT NULL AND v_email !~ '@' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Enter a valid email address.',
      'email_taken', false,
      'phone_taken', false,
      'roll_number_taken', false,
      'registration_number_taken', false,
      'university_roll_number_taken', false
    );
  END IF;

  IF p_phone IS NOT NULL AND trim(p_phone) <> '' AND v_phone IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Enter a valid 10-digit mobile number.',
      'email_taken', false,
      'phone_taken', false,
      'roll_number_taken', false,
      'registration_number_taken', false,
      'university_roll_number_taken', false
    );
  END IF;

  IF v_email IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE public.normalize_student_email(s.email) = v_email
        AND (p_exclude_user_id IS NULL OR s.id::uuid <> p_exclude_user_id)
    ) THEN
      v_email_taken := true;
    ELSIF EXISTS (
      SELECT 1 FROM auth.users u
      WHERE public.normalize_student_email(u.email) = v_email
        AND (p_exclude_user_id IS NULL OR u.id <> p_exclude_user_id)
    ) THEN
      v_email_taken := true;
    END IF;
  END IF;

  IF v_phone IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE public.normalize_phone_tail(s.contact_number) = v_phone
        AND (p_exclude_user_id IS NULL OR s.id::uuid <> p_exclude_user_id)
    ) THEN
      v_phone_taken := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE public.normalize_phone_tail(p.contact_number) = v_phone
        AND (p_exclude_user_id IS NULL OR p.id <> p_exclude_user_id)
        AND (
          v_email IS NULL
          OR public.normalize_student_email(p.email) IS DISTINCT FROM v_email
        )
    ) THEN
      v_phone_taken := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.referral_partners rp
      WHERE public.normalize_phone_tail(rp.contact_number) = v_phone
        AND (
          v_email IS NULL
          OR public.normalize_student_email(rp.email) IS DISTINCT FROM v_email
        )
    ) THEN
      v_phone_taken := true;
    END IF;
  END IF;

  IF v_roll IS NOT NULL AND v_uni IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE public.normalize_university_key(s.university_name) = v_uni
        AND public.normalize_student_roll_number(s.roll_number) = v_roll
        AND (p_exclude_user_id IS NULL OR s.id::uuid <> p_exclude_user_id)
    ) THEN
      v_roll_taken := true;
    END IF;
  END IF;

  IF v_reg IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE public.normalize_student_registration_number(s.registration_id) = v_reg
        AND (p_exclude_user_id IS NULL OR s.id::uuid <> p_exclude_user_id)
    ) THEN
      v_reg_taken := true;
    END IF;
  END IF;

  IF v_uni_roll IS NOT NULL AND v_uni IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.students s
      WHERE public.normalize_university_key(s.university_name) = v_uni
        AND public.student_university_roll_from_meta_text(s.metadata::text) = v_uni_roll
        AND (p_exclude_user_id IS NULL OR s.id::uuid <> p_exclude_user_id)
    ) THEN
      v_uni_roll_taken := true;
    END IF;
  END IF;

  IF v_email_taken THEN
    v_messages := array_append(v_messages, 'This email address is already registered.');
  END IF;
  IF v_phone_taken THEN
    v_messages := array_append(v_messages, 'This phone number is already registered.');
  END IF;
  IF v_roll_taken THEN
    v_messages := array_append(v_messages, 'This university roll number is already registered.');
  END IF;
  IF v_reg_taken THEN
    v_messages := array_append(v_messages, 'This university registration number is already registered.');
  END IF;
  IF v_uni_roll_taken THEN
    v_messages := array_append(v_messages, 'This university roll number is already registered.');
  END IF;

  IF array_length(v_messages, 1) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', array_to_string(v_messages, ' '),
      'email_taken', v_email_taken,
      'phone_taken', v_phone_taken,
      'roll_number_taken', v_roll_taken,
      'registration_number_taken', v_reg_taken,
      'university_roll_number_taken', v_uni_roll_taken
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'message', '',
    'email_taken', false,
    'phone_taken', false,
    'roll_number_taken', false,
    'registration_number_taken', false,
    'university_roll_number_taken', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_student_uniqueness(
  text, text, text, text, text, text, uuid
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_student_field_uniqueness(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_roll_number text DEFAULT NULL,
  p_registration_number text DEFAULT NULL,
  p_university_name text DEFAULT NULL,
  p_university_roll_number text DEFAULT NULL,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.validate_student_uniqueness(
    p_email, p_phone, p_roll_number, p_registration_number,
    p_university_name, p_university_roll_number, p_exclude_user_id
  );
  IF coalesce(v_result->>'valid', 'false') <> 'true' THEN
    RAISE EXCEPTION '%', coalesce(v_result->>'message', 'Duplicate student data')
      USING ERRCODE = '23505';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_student_field_uniqueness(
  text, text, text, text, text, text, uuid
) TO anon, authenticated, service_role;

-- Extend existing registration availability RPC to delegate to central validator
CREATE OR REPLACE FUNCTION public.check_student_registration_available(
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.validate_student_uniqueness(p_email, p_phone, NULL, NULL, NULL, NULL, NULL);
  IF coalesce(v_result->>'valid', 'false') <> 'true' THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', CASE
        WHEN (v_result->>'email_taken')::boolean AND (v_result->>'phone_taken')::boolean THEN 'both'
        WHEN (v_result->>'email_taken')::boolean THEN 'email'
        WHEN (v_result->>'phone_taken')::boolean THEN 'phone'
        ELSE 'invalid'
      END,
      'email_taken', coalesce((v_result->>'email_taken')::boolean, false),
      'phone_taken', coalesce((v_result->>'phone_taken')::boolean, false),
      'message', coalesce(v_result->>'message', 'Registration not available.')
    );
  END IF;
  RETURN jsonb_build_object(
    'available', true,
    'email_taken', false,
    'phone_taken', false,
    'message', ''
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: normalize on write + enforce uniqueness at database layer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_students_normalize_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := public.normalize_student_email(NEW.email);
  END IF;
  IF NEW.contact_number IS NOT NULL AND trim(NEW.contact_number) <> '' THEN
    NEW.contact_number := public.normalize_phone_tail(NEW.contact_number);
  END IF;
  IF NEW.roll_number IS NOT NULL THEN
    NEW.roll_number := trim(NEW.roll_number);
  END IF;
  IF NEW.registration_id IS NOT NULL THEN
    NEW.registration_id := trim(NEW.registration_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_students_enforce_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_meta_roll text;
BEGIN
  v_meta_roll := public.student_university_roll_from_meta_text(NEW.metadata::text);
  PERFORM public.assert_student_field_uniqueness(
    NEW.email,
    NEW.contact_number,
    NEW.roll_number,
    NEW.registration_id,
    NEW.university_name,
    v_meta_roll,
    NEW.id::uuid
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_normalize_fields ON public.students;
CREATE TRIGGER students_normalize_fields
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_students_normalize_fields();

DROP TRIGGER IF EXISTS students_enforce_uniqueness ON public.students;
CREATE TRIGGER students_enforce_uniqueness
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_students_enforce_uniqueness();

-- ---------------------------------------------------------------------------
-- Safe unique indexes (only when no conflicting duplicates exist)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dup_count integer;
BEGIN
  SELECT count(*) INTO v_dup_count FROM public.report_student_field_duplicates();
  IF v_dup_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_students_email_normalized
      ON public.students (public.normalize_student_email(email))
      WHERE public.normalize_student_email(email) IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_students_phone_normalized
      ON public.students (public.normalize_phone_tail(contact_number))
      WHERE public.normalize_phone_tail(contact_number) IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_students_university_roll
      ON public.students (
        public.normalize_university_key(university_name),
        public.normalize_student_roll_number(roll_number)
      )
      WHERE public.normalize_university_key(university_name) IS NOT NULL
        AND public.normalize_student_roll_number(roll_number) IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_students_university_meta_roll
      ON public.students (
        public.normalize_university_key(university_name),
        public.student_university_roll_from_meta_text(metadata::text)
      )
      WHERE public.normalize_university_key(university_name) IS NOT NULL
        AND public.student_university_roll_from_meta_text(metadata::text) IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped unique indexes: % duplicate groups found. Run SELECT * FROM public.report_student_field_duplicates();',
      v_dup_count;
  END IF;
END $$;
-- Student Data Upload: enforce global email/phone/roll/reg uniqueness (no synthetic auth emails).

CREATE OR REPLACE FUNCTION public.admin_student_data_upload_import(
  p_email text,
  p_password text,
  p_phone text,
  p_full_name text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_parent_name text DEFAULT NULL,
  p_university_name text DEFAULT NULL,
  p_college_name text DEFAULT NULL,
  p_degree text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_session text DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_registration_number text DEFAULT NULL,
  p_roll_number text DEFAULT NULL,
  p_internship_domain text DEFAULT NULL,
  p_mode text DEFAULT NULL,
  p_paid boolean DEFAULT true,
  p_upload_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email text := public.normalize_student_email(p_email);
  v_password text := trim(p_password);
  v_phone text := public.normalize_phone_tail(p_phone);
  v_name text := coalesce(nullif(trim(p_full_name), ''), 'Student');
  v_gender text := coalesce(nullif(trim(p_gender), ''), 'Other');
  v_parent text := nullif(trim(coalesce(p_parent_name, '')), '');
  v_uni text := nullif(trim(coalesce(p_university_name, '')), '');
  v_college text := nullif(trim(coalesce(p_college_name, '')), '');
  v_degree text := nullif(trim(coalesce(p_degree, '')), '');
  v_dept text := nullif(trim(coalesce(p_department, '')), '');
  v_subject text := nullif(trim(coalesce(p_subject, '')), '');
  v_session text := nullif(trim(coalesce(p_session, '')), '');
  v_semester text := nullif(trim(coalesce(p_semester, '')), '');
  v_reg text := nullif(trim(coalesce(p_registration_number, '')), '');
  v_roll text := nullif(trim(coalesce(p_roll_number, '')), '');
  v_domain text := nullif(trim(coalesce(p_internship_domain, '')), '');
  v_mode text := nullif(trim(coalesce(p_mode, '')), '');
  v_uid uuid;
  v_auth_email text;
  v_pay_id text;
  v_meta jsonb;
  v_meta_text text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin only' USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Valid email required';
  END IF;
  IF v_password IS NULL OR length(v_password) < 5 THEN
    RAISE EXCEPTION 'Password must be at least 5 characters';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Valid contact number required';
  END IF;

  IF v_reg IS NULL THEN
    RAISE EXCEPTION 'Registration Number is required';
  END IF;

  PERFORM public.assert_student_field_uniqueness(
    v_email, v_phone, v_roll, v_reg, v_uni, NULL, NULL
  );

  v_uid := gen_random_uuid();
  v_auth_email := v_email;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid, 'authenticated', 'authenticated', v_auth_email,
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
    jsonb_build_object(
      'sub', v_uid::text,
      'email', v_auth_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  v_meta := jsonb_build_object(
    'password', v_password,
    'source', 'admin_student_data_upload',
    'created_by', auth.uid()::text,
    'payment_required', (NOT p_paid),
    'bulk_upload_paid', p_paid,
    'department', v_dept,
    'subject', v_subject,
    'internship_mode', v_mode
  );
  IF p_upload_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('upload_id', p_upload_id::text);
  END IF;
  IF p_paid THEN
    v_pay_id := 'pay_admin_data_upload_' || replace(gen_random_uuid()::text, '-', '');
    v_meta := v_meta || jsonb_build_object('razorpay_payment_id', v_pay_id);
  END IF;
  v_meta_text := v_meta::text;

  INSERT INTO public.students (
    id, email, full_name, gender, parent_name, contact_number,
    university_name, college_name, course, degree, department,
    class_semester, academic_session, roll_number, internship_domain,
    status, registration_id, metadata
  ) VALUES (
    v_uid::text, v_email, v_name, v_gender, v_parent, v_phone,
    coalesce(v_uni, ''), coalesce(v_college, ''),
    coalesce(v_domain, 'Internship'),
    coalesce(v_degree, ''),
    coalesce(v_dept, ''),
    coalesce(v_semester, ''),
    coalesce(v_session, ''),
    coalesce(v_roll, ''),
    coalesce(v_domain, coalesce(v_degree, 'Internship')),
    'Active',
    v_reg,
    v_meta_text
  );

  INSERT INTO public.profiles (id, full_name, email, contact_number)
  VALUES (v_uid, v_name, v_email, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = excluded.full_name,
    email = excluded.email,
    contact_number = excluded.contact_number;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'student'::public.app_role)
  ON CONFLICT DO NOTHING;

  IF p_paid THEN
    PERFORM public.ensure_payment_success_log(jsonb_build_object(
      'user_id', v_uid::text,
      'payment_id', v_pay_id,
      'amount_paise', 50000,
      'email', v_email,
      'full_name', v_name,
      'status', 'success'
    ));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_uid::text,
    'email', v_email,
    'auth_email', v_auth_email,
    'registration_id', v_reg,
    'paid', p_paid,
    'upload_id', p_upload_id
  );
END;
$$;
