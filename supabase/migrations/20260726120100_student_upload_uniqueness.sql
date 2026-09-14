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
