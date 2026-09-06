-- Partner dashboard access mode + coupon discount amount

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'both';

ALTER TABLE public.referral_partners
  DROP CONSTRAINT IF EXISTS referral_partners_access_mode_check;

ALTER TABLE public.referral_partners
  ADD CONSTRAINT referral_partners_access_mode_check
  CHECK (access_mode IN ('referral_only', 'coupon_only', 'both'));

COMMENT ON COLUMN public.referral_partners.access_mode IS
  'Controls referral dashboard sections: referral_only, coupon_only, or both.';

ALTER TABLE public.referral_coupons
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10, 2);

COMMENT ON COLUMN public.referral_coupons.coupon_amount IS
  'Optional discount amount (INR) shown to students when coupon is applied.';

-- Include access_mode in session partner load RPC
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
      'profile_image_url', v_partner.profile_image_url,
      'access_mode', COALESCE(v_partner.access_mode, 'both')
    )
  );
END;
$$;
