-- Company collaboration: registration, job postings, hiring pipeline

CREATE TABLE IF NOT EXISTS public.company_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  designation text,
  email text NOT NULL,
  phone text,
  company_name text NOT NULL,
  gst_number text,
  company_address text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'suspended')),
  rejection_reason text,
  email_verified_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_email_lower_idx
  ON public.company_profiles (lower(trim(email)));

CREATE TABLE IF NOT EXISTS public.company_job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  required_students integer NOT NULL DEFAULT 1 CHECK (required_students > 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'hiring_in_progress', 'completed', 'closed')),
  completion_remark text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_job_postings_company_id_idx
  ON public.company_job_postings (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_hiring_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.company_job_postings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  college_name text,
  department text,
  status text NOT NULL DEFAULT 'imported'
    CHECK (status IN ('imported', 'screening', 'interview', 'offered', 'hired', 'rejected')),
  remark text,
  imported_by uuid REFERENCES auth.users(id),
  hired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_hiring_candidates_job_id_idx
  ON public.company_hiring_candidates (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_hiring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.company_hiring_candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.company_job_postings(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_hiring_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_hiring_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._is_company_partner(p_company_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'company_partner'::public.app_role
  )
  OR EXISTS (
    SELECT 1 FROM public.company_profiles cp
    WHERE cp.id = auth.uid()
      AND cp.status = 'approved'
      AND (p_company_id IS NULL OR cp.id = p_company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public._is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

DROP POLICY IF EXISTS company_profiles_self ON public.company_profiles;
CREATE POLICY company_profiles_self ON public.company_profiles
  FOR SELECT USING (id = auth.uid() OR public._is_admin_user());

DROP POLICY IF EXISTS company_profiles_admin ON public.company_profiles;
CREATE POLICY company_profiles_admin ON public.company_profiles
  FOR ALL USING (public._is_admin_user());

DROP POLICY IF EXISTS company_jobs_owner ON public.company_job_postings;
CREATE POLICY company_jobs_owner ON public.company_job_postings
  FOR ALL USING (
    public._is_admin_user()
    OR (company_id = auth.uid() AND public._is_company_partner(company_id))
  );

DROP POLICY IF EXISTS company_candidates_owner ON public.company_hiring_candidates;
CREATE POLICY company_candidates_owner ON public.company_hiring_candidates
  FOR ALL USING (
    public._is_admin_user()
    OR (company_id = auth.uid() AND public._is_company_partner(company_id))
  );

DROP POLICY IF EXISTS company_events_read ON public.company_hiring_events;
CREATE POLICY company_events_read ON public.company_hiring_events
  FOR SELECT USING (
    public._is_admin_user()
    OR (company_id = auth.uid() AND public._is_company_partner(company_id))
  );

DROP POLICY IF EXISTS company_events_insert ON public.company_hiring_events;
CREATE POLICY company_events_insert ON public.company_hiring_events
  FOR INSERT WITH CHECK (
    public._is_admin_user()
    OR (company_id = auth.uid() AND public._is_company_partner(company_id))
  );

CREATE OR REPLACE FUNCTION public.register_company_partner(
  p_user_id uuid,
  p_contact_name text,
  p_designation text,
  p_email text,
  p_phone text,
  p_company_name text,
  p_gst_number text,
  p_company_address text,
  p_email_verified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Sign in required to complete company registration' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' OR trim(p_company_name) = '' OR trim(p_contact_name) = '' THEN
    RAISE EXCEPTION 'Name, email, and company name are required';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, contact_number)
  VALUES (
    p_user_id,
    trim(p_contact_name),
    v_email,
    COALESCE(NULLIF(trim(p_phone), ''), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    email = EXCLUDED.email,
    contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number);

  INSERT INTO public.company_profiles (
    id, contact_name, designation, email, phone,
    company_name, gst_number, company_address, status, email_verified_at
  )
  VALUES (
    p_user_id,
    trim(p_contact_name),
    NULLIF(trim(p_designation), ''),
    v_email,
    COALESCE(NULLIF(trim(p_phone), ''), ''),
    trim(p_company_name),
    NULLIF(trim(p_gst_number), ''),
    NULLIF(trim(p_company_address), ''),
    'pending_approval',
    CASE WHEN p_email_verified THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    contact_name = EXCLUDED.contact_name,
    designation = EXCLUDED.designation,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    company_name = EXCLUDED.company_name,
    gst_number = EXCLUDED.gst_number,
    company_address = EXCLUDED.company_address,
    email_verified_at = COALESCE(public.company_profiles.email_verified_at, EXCLUDED.email_verified_at),
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_company_partner(
  p_company_id uuid,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.company_profiles
  SET status = 'approved',
      rejection_reason = NULL,
      approved_at = now(),
      approved_by = COALESCE(p_reviewer_id, auth.uid()),
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_company_id, 'company_partner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', p_company_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_company_partner(
  p_company_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.company_profiles
  SET status = 'rejected',
      rejection_reason = NULLIF(trim(p_reason), ''),
      updated_at = now()
  WHERE id = p_company_id;

  DELETE FROM public.user_roles
  WHERE user_id = p_company_id AND role = 'company_partner'::public.app_role;

  RETURN jsonb_build_object('ok', true, 'id', p_company_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.company_complete_hiring(
  p_job_id uuid,
  p_remark text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.company_job_postings%ROWTYPE;
  v_hired_count integer;
BEGIN
  SELECT * INTO v_job FROM public.company_job_postings WHERE id = p_job_id;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job posting not found';
  END IF;

  IF NOT public._is_admin_user()
     AND NOT (v_job.company_id = auth.uid() AND public._is_company_partner(v_job.company_id)) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer INTO v_hired_count
  FROM public.company_hiring_candidates
  WHERE job_id = p_job_id AND status = 'hired';

  IF v_hired_count < v_job.required_students THEN
    RAISE EXCEPTION 'Need at least % hired candidates; currently %', v_job.required_students, v_hired_count;
  END IF;

  UPDATE public.company_job_postings
  SET status = 'completed',
      completion_remark = NULLIF(trim(p_remark), ''),
      completed_at = now(),
      completed_by = auth.uid(),
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'hired_count', v_hired_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_company_partner(uuid, text, text, text, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_company_partner(uuid, text, text, text, text, text, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_approve_company_partner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_company_partner(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_reject_company_partner(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_company_partner(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.company_complete_hiring(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_complete_hiring(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.account_may_use_company_login(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_profiles cp
    WHERE lower(trim(cp.email)) = lower(trim(check_email))
  );
$$;

REVOKE ALL ON FUNCTION public.account_may_use_company_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_may_use_company_login(text) TO anon, authenticated;
