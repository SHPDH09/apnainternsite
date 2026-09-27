-- Same as supabase/migration-admins-premium.sql (admin_staff profile_image_url + RPC).

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS ifsc_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.staff_update_profile_image(p_profile_image_url text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.admin_staff
  SET
    profile_image_url = NULLIF(trim(COALESCE(p_profile_image_url, '')), ''),
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object('ok', true, 'profile_image_url', p_profile_image_url);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_profile_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_profile_image(text) TO authenticated;
