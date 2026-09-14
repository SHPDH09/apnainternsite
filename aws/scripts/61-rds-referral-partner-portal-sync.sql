-- Link referral partner portal access (auth user + referral_partner role).
-- Fixes approve flow when auth_user_id was set before finalize_referral_partner_creation.

CREATE OR REPLACE FUNCTION public.link_referral_partner_portal(
  target_user_id uuid,
  p_partner_id uuid,
  partner_email text,
  partner_full_name text DEFAULT NULL,
  p_login_secret text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'staff'::public.app_role
      )
  );
BEGIN
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL OR p_partner_id IS NULL THEN
    RAISE EXCEPTION 'partner and user are required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.referral_partners
    WHERE id = p_partner_id
      AND lower(trim(email)) = lower(trim(partner_email))
  ) THEN
    RAISE EXCEPTION 'Invalid partner or email mismatch' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Auth user not found' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IN (
      'student'::public.app_role,
      'admin'::public.app_role,
      'staff'::public.app_role,
      'college_admin'::public.app_role,
      'referral_partner'::public.app_role
    );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'referral_partner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.referral_partners
  SET
    auth_user_id = target_user_id,
    partner_login_secret = COALESCE(NULLIF(trim(p_login_secret), ''), partner_login_secret),
    full_name = COALESCE(NULLIF(trim(partner_full_name), ''), full_name),
    email = lower(trim(partner_email)),
    active = true,
    updated_at = now()
  WHERE id = p_partner_id;

  BEGIN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(trim(partner_full_name), ''), full_name),
      email = lower(trim(partner_email))
    WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'partner_id', p_partner_id);
END;
$$;

REVOKE ALL ON FUNCTION public.link_referral_partner_portal(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_referral_partner_portal(uuid, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_referral_partner_portal_for_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_partner_id uuid;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT rp.id, rp.referral_code
  INTO v_partner_id, v_code
  FROM public.referral_partners rp
  WHERE rp.active = true
    AND (
      rp.auth_user_id = v_uid
      OR (v_email <> '' AND lower(trim(rp.email)) = v_email)
    )
  ORDER BY (rp.auth_user_id IS NOT DISTINCT FROM v_uid) DESC, rp.updated_at DESC NULLS LAST, rp.created_at DESC
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'no_partner');
  END IF;

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
  WHERE id = v_partner_id;

  RETURN json_build_object('ok', true, 'partner_id', v_partner_id, 'referral_code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_partner_portal_for_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_referral_partner_portal_for_session() TO authenticated;
