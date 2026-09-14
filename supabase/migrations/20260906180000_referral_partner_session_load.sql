-- Referral partner portal session load (mirrors aws/scripts/62-rds-referral-partner-session-load.sql)

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
